"""Authenticated GraphQL queries for the directorio app."""

from typing import Optional, List
import strawberry
from strawberry.types import Info

from users.auth import get_user_from_request, get_tenant_from_user
from directorio.models import Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion
from directorio.types import (
    CategoriaType, SubcategoriaType, EmpresaPerfilType,
    SolicitudCotizacionType, DashboardStats,
)


@strawberry.type
class DirectorioQuery:

    @strawberry.field
    def categorias(
        self,
        info: Info,
        search: str = '',
        activas_only: bool = True,
    ) -> List[CategoriaType]:
        """Global — no tenant filter."""
        qs = Categoria.objects.all()
        if activas_only:
            qs = qs.filter(activa=True)
        if search:
            qs = qs.filter(nombre__icontains=search)
        return list(qs)

    @strawberry.field
    def categoria(self, info: Info, id: strawberry.ID) -> Optional[CategoriaType]:
        try:
            return Categoria.objects.get(pk=id)
        except Categoria.DoesNotExist:
            return None

    @strawberry.field
    def subcategorias(
        self,
        info: Info,
        categoria_id: strawberry.ID,
        search: str = '',
    ) -> List[SubcategoriaType]:
        """Global — no tenant filter, scoped only to parent category."""
        qs = Subcategoria.objects.filter(categoria_id=categoria_id)
        if search:
            qs = qs.filter(nombre__icontains=search)
        return list(qs)

    @strawberry.field
    def mi_empresa(self, info: Info) -> Optional[EmpresaPerfilType]:
        """Return the EmpresaPerfil for the current user's active tenant."""
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        try:
            return (
                EmpresaPerfil.objects
                .prefetch_related('categorias', 'subcategorias')
                .select_related('categoria_principal')
                .get(tenant=tenant)
            )
        except EmpresaPerfil.DoesNotExist:
            return None

    @strawberry.field
    def solicitudes_cotizacion(
        self,
        info: Info,
        status: str = '',
        limit: int = 20,
        offset: int = 0,
    ) -> List[SolicitudCotizacionType]:
        """
        Returns leads for the current tenant's empresa.
        For Free plan: mensaje and email_contacto are blanked out.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        try:
            empresa = EmpresaPerfil.objects.get(tenant=tenant)
        except EmpresaPerfil.DoesNotExist:
            return []

        qs = SolicitudCotizacion.objects.filter(empresa=empresa)
        if status:
            qs = qs.filter(status=status)
        solicitudes = list(qs[offset: offset + limit])

        # Plan gate: mask content for free plan
        if empresa.plan == EmpresaPerfil.Plan.FREE:
            for s in solicitudes:
                s.mensaje = ''
                s.email_contacto = ''
        return solicitudes

    @strawberry.field
    def dashboard_stats(self, info: Info) -> DashboardStats:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        try:
            empresa = EmpresaPerfil.objects.get(tenant=tenant)
        except EmpresaPerfil.DoesNotExist:
            return DashboardStats(
                total_vistas=0, total_leads=0, leads_nuevos=0,
                score_completitud=0, plan='free', empresa_publicada=False,
            )

        total_leads = SolicitudCotizacion.objects.filter(empresa=empresa).count()
        leads_nuevos = SolicitudCotizacion.objects.filter(empresa=empresa, status='nueva').count()

        return DashboardStats(
            total_vistas=0,   # Phase 2: analytics integration
            total_leads=total_leads,
            leads_nuevos=leads_nuevos,
            score_completitud=empresa.score_completitud,
            plan=empresa.plan,
            empresa_publicada=empresa.status == EmpresaPerfil.Status.PUBLISHED,
        )
