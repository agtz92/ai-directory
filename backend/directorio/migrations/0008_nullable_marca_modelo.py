"""
Make Modelo.marca nullable and restructure EmpresaModelo to support
entries with only subcategoria, only subcategoria+marca, or full
subcategoria+marca+modelo.

Data migration: populate new subcategoria/marca columns from existing
modelo FK before making subcategoria NOT NULL.
"""
from django.db import migrations, models
import django.db.models.deletion


def populate_subcategoria_marca(apps, schema_editor):
    EmpresaModelo = apps.get_model('directorio', 'EmpresaModelo')
    for em in EmpresaModelo.objects.select_related(
        'modelo__subcategoria', 'modelo__marca'
    ).all():
        if em.modelo_id:
            em.subcategoria_id = em.modelo.subcategoria_id
            em.marca_id = em.modelo.marca_id  # may be None after this migration
            em.save(update_fields=['subcategoria_id', 'marca_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('directorio', '0007_add_marca_modelo'),
    ]

    operations = [
        # ── 1. Modelo.marca → nullable ────────────────────────────────────
        migrations.AlterField(
            model_name='modelo',
            name='marca',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='modelos',
                to='directorio.marca',
            ),
        ),

        # ── 2. Drop old Modelo unique constraint (marca, slug) ────────────
        migrations.RemoveConstraint(
            model_name='modelo',
            name='uniq_modelo_marca_slug',
        ),

        # ── 3. Add new Modelo partial constraints ─────────────────────────
        migrations.AddConstraint(
            model_name='modelo',
            constraint=models.UniqueConstraint(
                condition=models.Q(marca__isnull=False),
                fields=['marca', 'slug'],
                name='uniq_modelo_marca_slug',
            ),
        ),
        migrations.AddConstraint(
            model_name='modelo',
            constraint=models.UniqueConstraint(
                condition=models.Q(marca__isnull=True),
                fields=['subcategoria', 'slug'],
                name='uniq_modelo_subcategoria_slug_sin_marca',
            ),
        ),

        # ── 4. Add subcategoria FK (nullable for now) to EmpresaModelo ────
        migrations.AddField(
            model_name='empresamodelo',
            name='subcategoria',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='empresa_modelos',
                to='directorio.subcategoria',
            ),
        ),

        # ── 5. Add marca FK (nullable) to EmpresaModelo ───────────────────
        migrations.AddField(
            model_name='empresamodelo',
            name='marca',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='empresa_modelos',
                to='directorio.marca',
            ),
        ),

        # ── 6. Populate subcategoria + marca from existing modelo FK ──────
        migrations.RunPython(
            code=populate_subcategoria_marca,
            reverse_code=migrations.RunPython.noop,
        ),

        # ── 7. Make subcategoria NOT NULL ─────────────────────────────────
        migrations.AlterField(
            model_name='empresamodelo',
            name='subcategoria',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='empresa_modelos',
                to='directorio.subcategoria',
            ),
        ),

        # ── 8. Make modelo nullable ───────────────────────────────────────
        migrations.AlterField(
            model_name='empresamodelo',
            name='modelo',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='empresa_modelos',
                to='directorio.modelo',
            ),
        ),

        # ── 9. Drop old EmpresaModelo unique constraint ───────────────────
        migrations.RemoveConstraint(
            model_name='empresamodelo',
            name='uniq_empresa_modelo',
        ),

        # ── 10. Add new partial unique constraints ────────────────────────
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                condition=models.Q(modelo__isnull=False),
                fields=['empresa', 'modelo'],
                name='uniq_empresa_modelo_set',
            ),
        ),
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                condition=models.Q(modelo__isnull=True, marca__isnull=False),
                fields=['empresa', 'marca'],
                name='uniq_empresa_marca_sin_modelo',
            ),
        ),
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                condition=models.Q(modelo__isnull=True, marca__isnull=True),
                fields=['empresa', 'subcategoria'],
                name='uniq_empresa_subcategoria_solo',
            ),
        ),

        # ── 11. Update ordering meta (no DB op, just state) ───────────────
        migrations.AlterModelOptions(
            name='empresamodelo',
            options={
                'ordering': ['subcategoria__nombre', 'marca__nombre', 'modelo__nombre'],
                'verbose_name': 'Empresa → Catálogo',
                'verbose_name_plural': 'Empresas → Catálogo',
            },
        ),
    ]
