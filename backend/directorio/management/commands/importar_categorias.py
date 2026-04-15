"""
Management command to bulk-import categories and subcategories from CSV files.

Usage:
    python manage.py importar_categorias \
        --categorias=../categorias.csv \
        --subcategorias=../subcategorias.csv \
        --batch-size=1000

The categorias.csv format:
    slug,nombre
    b3mp,Bombas
    4chm,Acido

The subcategorias.csv format:
    categoria_slug,nombre
    b3mp,Bomba centrifuga
    b3mp,Bomba de pistón

Strategy:
  - Category slugs in the CSV are opaque codes (e.g. 'b3mp').
    We save them as `codigo` and derive a human-readable `slug` from `nombre`.
  - Subcategory slugs are generated from `nombre` using an in-memory deduplication
    set per category (avoids 161K DB round-trips).
  - Uses bulk_create with ignore_conflicts for subcategories (idempotent).
  - Reports progress every 10,000 rows.
"""

import csv
import io
import sys
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify
from django.db import transaction, connection

from directorio.models import Categoria, Subcategoria


def _make_slug_unique_global(nombre: str, seen: set) -> str:
    """Generate a slug unique across all categories (global scope)."""
    base = slugify(nombre)[:200] or 'sin-nombre'
    candidate = base
    i = 1
    while candidate in seen:
        candidate = f'{base}-{i}'
        i += 1
    seen.add(candidate)
    return candidate


def _make_slug_unique_local(nombre: str, seen_per_cat: set) -> str:
    """Generate a slug unique within a single category (local scope)."""
    base = slugify(nombre)[:300] or 'sin-nombre'
    candidate = base
    i = 1
    while candidate in seen_per_cat:
        candidate = f'{base}-{i}'
        i += 1
    seen_per_cat.add(candidate)
    return candidate


def _open_csv(path: str):
    """Open a CSV file handling BOM and encoding."""
    return open(path, 'r', encoding='utf-8-sig', newline='')


class Command(BaseCommand):
    help = 'Import categories and subcategories from CSV files'

    def add_arguments(self, parser):
        parser.add_argument('--categorias', required=True, help='Path to categorias.csv')
        parser.add_argument('--subcategorias', required=True, help='Path to subcategorias.csv')
        parser.add_argument('--batch-size', type=int, default=200, help='Rows per INSERT (keep low for Supabase pooler)')
        parser.add_argument('--reconnect-every', type=int, default=10, help='Force DB reconnect every N batches')
        parser.add_argument('--skip-subcategorias', action='store_true', help='Skip subcategory import')
        parser.add_argument('--solo-subcategorias', action='store_true', help='Skip category import, only import subcategories')

    def handle(self, *args, **options):
        cat_path = options['categorias']
        sub_path = options['subcategorias']
        batch_size = options['batch_size']

        codigo_to_pk: dict = {}  # codigo → pk, built in Phase A, used in Phase B

        # ── Phase A: Categorias ─────────────────────────────────────────────
        if options['solo_subcategorias']:
            # Skip CSV processing — just load existing categories into memory
            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Cargando Categorías existentes (--solo-subcategorias) ==='))
            for cat in Categoria.objects.only('pk', 'codigo'):
                codigo_to_pk[cat.codigo] = cat.pk
            self.stdout.write(self.style.SUCCESS(f'  {len(codigo_to_pk):,} categorías cargadas en memoria.'))
        else:
            self.stdout.write(self.style.MIGRATE_HEADING('\n=== Importando Categorías ==='))

            if not Path(cat_path).exists():
                raise CommandError(f'Archivo no encontrado: {cat_path}')

            # Load ALL existing categories in a single query → no per-row DB round-trips
            existing_slugs: set = set()
            existing_by_codigo: dict = {}  # codigo → Categoria instance
            for cat in Categoria.objects.all():
                existing_slugs.add(cat.slug)
                existing_by_codigo[cat.codigo] = cat

            to_create: list[Categoria] = []
            to_update: list[Categoria] = []  # instances with changed nombre

            with _open_csv(cat_path) as f:
                reader = csv.DictReader(f)
                for row in reader:
                    codigo = row.get('slug', '').strip()
                    nombre = row.get('nombre', '').strip()
                    if not codigo or not nombre:
                        continue

                    if codigo in existing_by_codigo:
                        cat = existing_by_codigo[codigo]
                        if cat.nombre != nombre:
                            cat.nombre = nombre
                            to_update.append(cat)
                    else:
                        slug = _make_slug_unique_global(nombre, existing_slugs)
                        to_create.append(Categoria(codigo=codigo, nombre=nombre, slug=slug))

            if to_create:
                created_cats = Categoria.objects.bulk_create(to_create)
                for cat in created_cats:
                    existing_by_codigo[cat.codigo] = cat

            if to_update:
                Categoria.objects.bulk_update(to_update, ['nombre'])

            for codigo, cat in existing_by_codigo.items():
                codigo_to_pk[codigo] = cat.pk

            self.stdout.write(
                self.style.SUCCESS(
                    f'  Categorías: {len(to_create)} creadas, {len(to_update)} actualizadas. '
                    f'Total en DB: {len(existing_by_codigo)}'
                )
            )

        if options['skip_subcategorias']:
            return

        # ── Phase B: Subcategorias ───────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Importando Subcategorías ==='))

        if not Path(sub_path).exists():
            raise CommandError(f'Archivo no encontrado: {sub_path}')

        # In-memory slug deduplication: categoria_pk → set of slugs
        seen_slugs_per_cat: dict[int, set] = {}

        # Pre-load existing subcategory slugs to make command idempotent
        self.stdout.write('  Cargando slugs existentes en memoria...')
        for cat_pk, slug in Subcategoria.objects.values_list('categoria_id', 'slug'):
            seen_slugs_per_cat.setdefault(cat_pk, set()).add(slug)
        # Also track existing (categoria_id, nombre) pairs to skip duplicates
        existing_pairs: set = set(
            Subcategoria.objects.values_list('categoria_id', 'nombre')
        )

        batch: list[Subcategoria] = []
        total_created = 0
        total_skipped = 0
        row_count = 0
        batch_count = 0
        reconnect_every = options['reconnect_every']

        with _open_csv(sub_path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                row_count += 1
                cat_codigo = row.get('categoria_slug', '').strip()
                nombre = row.get('nombre', '').strip()

                if not cat_codigo or not nombre:
                    total_skipped += 1
                    continue

                cat_pk = codigo_to_pk.get(cat_codigo)
                if cat_pk is None:
                    total_skipped += 1
                    continue

                # Skip if this (categoria, nombre) pair already exists
                if (cat_pk, nombre) in existing_pairs:
                    total_skipped += 1
                    continue

                seen = seen_slugs_per_cat.setdefault(cat_pk, set())
                slug = _make_slug_unique_local(nombre, seen)

                batch.append(Subcategoria(
                    categoria_id=cat_pk,
                    nombre=nombre,
                    slug=slug,
                ))
                existing_pairs.add((cat_pk, nombre))

                if len(batch) >= batch_size:
                    Subcategoria.objects.bulk_create(batch, ignore_conflicts=True)
                    total_created += len(batch)
                    batch = []
                    batch_count += 1

                    # Reconnect periodically to avoid Supabase pooler timeouts
                    if batch_count % reconnect_every == 0:
                        connection.close()

                if row_count % 10000 == 0:
                    self.stdout.write(
                        f'  ... {row_count:,} filas procesadas, '
                        f'{total_created:,} subcategorías creadas'
                    )

        # Insert remaining batch
        if batch:
            connection.close()  # fresh connection for final batch
            Subcategoria.objects.bulk_create(batch, ignore_conflicts=True)
            total_created += len(batch)

        self.stdout.write(
            self.style.SUCCESS(
                f'\n  Subcategorías: {total_created:,} creadas, {total_skipped:,} omitidas. '
                f'Total en DB: {Subcategoria.objects.count():,}'
            )
        )
        self.stdout.write(self.style.SUCCESS('\n¡Importación completada!'))
