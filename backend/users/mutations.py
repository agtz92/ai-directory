"""User and workspace mutations."""

from typing import Optional, List
import strawberry
from strawberry.types import Info
from django.utils.text import slugify

from users.auth import get_user_from_request, get_tenant_from_user
from users.models import CustomUser
from core.models import Tenant, TenantMembership
from directorio.plan_limits import PlanLimitsType, build_plan_limits  # noqa: E402


@strawberry.type
class TenantInfoType:
    id: strawberry.ID
    name: str
    slug: str
    color: str
    modules: strawberry.scalars.JSON


@strawberry.type
class MeType:
    id: strawberry.ID
    email: str
    display_name: str
    role: str
    tenant_slug: str
    tenant_name: str
    tenant_id: strawberry.ID
    tenant_color: str
    tenant_modules: strawberry.scalars.JSON
    tenants: List[TenantInfoType]
    empresa_plan: str          # 'free' | 'starter' | 'pro' | 'enterprise'
    empresa_status: str        # 'draft' | 'published' | 'archived'
    plan_limits: PlanLimitsType  # authoritative limits for the current plan
    staff_role: str            # '' | 'staff' | 'admin' | 'owner'


def _build_me(user: CustomUser) -> MeType:
    from directorio.models import EmpresaPerfil

    tenant = get_tenant_from_user(user)
    tenants = [
        TenantInfoType(
            id=str(m.tenant.pk),
            name=m.tenant.name,
            slug=m.tenant.slug,
            color=m.tenant.color,
            modules=m.tenant.modules,
        )
        for m in user.memberships.filter(is_active=True).select_related('tenant')
    ]

    # Pull plan + status from EmpresaPerfil if it exists
    try:
        empresa = EmpresaPerfil.objects.only('plan', 'status').get(tenant=tenant)
        empresa_plan = empresa.plan
        empresa_status = empresa.status
    except EmpresaPerfil.DoesNotExist:
        empresa_plan = 'free'
        empresa_status = 'draft'

    return MeType(
        id=str(user.pk),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        tenant_slug=tenant.slug,
        tenant_name=tenant.name,
        tenant_id=str(tenant.pk),
        tenant_color=tenant.color,
        tenant_modules=tenant.modules,
        tenants=tenants,
        empresa_plan=empresa_plan,
        empresa_status=empresa_status,
        plan_limits=build_plan_limits(empresa_plan),
        staff_role=user.staff_role,
    )


def _unique_tenant_slug(name: str, exclude_pk=None) -> str:
    base = slugify(name)[:40] or 'workspace'
    slug = base
    i = 1
    while True:
        qs = Tenant.objects.filter(slug=slug)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        if not qs.exists():
            return slug
        slug = f'{base}-{i}'
        i += 1


@strawberry.type
class UserQuery:

    @strawberry.field
    def me(self, info: Info) -> MeType:
        user = get_user_from_request(info)
        return _build_me(user)


@strawberry.type
class UserMutation:

    @strawberry.mutation
    def register(
        self,
        info: Info,
        email: str,
        display_name: str = '',
        nombre_empresa: str = '',
    ) -> MeType:
        """
        Called immediately after supabase.auth.signUp() when a session is available.
        Creates CustomUser + Tenant + TenantMembership(OWNER) + EmpresaPerfil(DRAFT).
        JWT must already be in the Authorization header.
        """
        user = get_user_from_request(info)  # auto-creates CustomUser if needed

        # Update display_name if provided
        if display_name and not user.display_name:
            user.display_name = display_name
            user.save(update_fields=['display_name'])

        if not user.active_tenant_id:
            empresa_nombre = nombre_empresa or display_name or email.split('@')[0]
            slug = _unique_tenant_slug(empresa_nombre)
            tenant = Tenant.objects.create(
                name=empresa_nombre,
                slug=slug,
                modules=['directorio'],
            )
            TenantMembership.objects.create(
                tenant=tenant, user=user, role=TenantMembership.Role.OWNER
            )
            user.active_tenant = tenant
            user.save(update_fields=['active_tenant'])

            # Create empresa perfil (draft) in the same step
            from directorio.models import EmpresaPerfil, _unique_slug as _emp_slug
            EmpresaPerfil.objects.create(
                tenant=tenant,
                nombre_comercial=empresa_nombre,
                slug=_emp_slug(empresa_nombre, EmpresaPerfil),
            )

        return _build_me(user)

    @strawberry.mutation
    def switch_tenant(self, info: Info, tenant_id: strawberry.ID) -> MeType:
        user = get_user_from_request(info)
        tenant = Tenant.objects.get(
            pk=tenant_id,
            memberships__user=user,
            memberships__is_active=True,
        )
        user.active_tenant = tenant
        user.save(update_fields=['active_tenant'])
        return _build_me(user)

    @strawberry.mutation
    def update_profile(self, info: Info, display_name: str) -> MeType:
        user = get_user_from_request(info)
        user.display_name = display_name
        user.save(update_fields=['display_name'])
        return _build_me(user)
