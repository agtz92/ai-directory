"""
Generate a one-time invite link so a user can claim an existing EmpresaPerfil.

Usage:
    python manage.py generar_invitacion --empresa-slug=acero-mx
    python manage.py generar_invitacion --empresa-slug=acero-mx --email=owner@company.com --dias=14
"""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from directorio.models import EmpresaPerfil, InvitacionEmpresa


class Command(BaseCommand):
    help = 'Generate a one-time claim link for an existing EmpresaPerfil'

    def add_arguments(self, parser):
        parser.add_argument('--empresa-slug', required=True, help='Slug of the EmpresaPerfil')
        parser.add_argument('--email', default='', help='Restrict invite to this email (optional)')
        parser.add_argument('--dias', type=int, default=7, help='Days until expiry (default: 7)')
        parser.add_argument('--base-url', default='http://localhost:3000', help='Frontend base URL')

    def handle(self, *args, **options):
        slug = options['empresa_slug']
        try:
            empresa = EmpresaPerfil.objects.select_related('tenant').get(slug=slug)
        except EmpresaPerfil.DoesNotExist:
            raise CommandError(f'No existe EmpresaPerfil con slug="{slug}"')

        # Warn if empresa already has an owner
        from core.models import TenantMembership
        owners = TenantMembership.objects.filter(
            tenant=empresa.tenant, role='owner', is_active=True
        ).count()
        if owners > 0:
            self.stdout.write(
                self.style.WARNING(f'  ⚠ Esta empresa ya tiene {owners} propietario(s).')
            )

        inv = InvitacionEmpresa.objects.create(
            empresa=empresa,
            email=options['email'].strip().lower(),
            expires_at=timezone.now() + timedelta(days=options['dias']),
        )

        base_url = options['base_url'].rstrip('/')
        link = f"{base_url}/reclamar/{inv.token}"

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('✓ Invitación generada'))
        self.stdout.write(f'  Empresa : {empresa.nombre_comercial}')
        self.stdout.write(f'  Email   : {inv.email or "cualquiera"}')
        self.stdout.write(f'  Expira  : {inv.expires_at.strftime("%Y-%m-%d %H:%M UTC")} ({options["dias"]} días)')
        self.stdout.write(f'  Token   : {inv.token}')
        self.stdout.write('')
        self.stdout.write(f'  Link    : {link}')
        self.stdout.write('')
