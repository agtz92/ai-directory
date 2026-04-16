"""
Public GraphQL schema for the global directory.
Mounted at /public/graphql/ — no auth required.
Serves all published companies, global categories/subcategories.
"""

from typing import Optional, List
from datetime import datetime, timezone, timedelta

import strawberry
from strawberry.types import Info

from directorio.models import (
    Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion,
    InvitacionEmpresa, Marca, Modelo,
)
from directorio.types import (
    CategoriaType, SubcategoriaType, EmpresaPerfilPublicType,
    DirectorioResultType, MarcaType, ModeloType,
)
from directorio.plan_limits import PlanInfoType, build_all_plans  # noqa: F401


@strawberry.type
class InvitacionInfoType:
    empresa_nombre: str
    empresa_slug: str
    valid: bool
    email_restringido: bool  # True if the invite is locked to a specific email


@strawberry.type
class PublicQuery:

    @strawberry.field
    def planes(self) -> list[PlanInfoType]:
        """
        Returns all available plans with their limits and prices.
        Use this on the pricing page or upgrade modal — no auth required.
        """
        return build_all_plans()

    @strawberry.field
    def directorio(
        self,
        info: Info,
        categoria_slug: str = '',
        subcategoria_slug: str = '',
        ciudad: str = '',
        estado: str = '',
        search: str = '',
        limit: int = 20,
        offset: int = 0,
    ) -> DirectorioResultType:
        """Paginated list of published companies — sorted by verified, plan rank, score."""
        from django.db.models import Case, When, IntegerField, Value

        qs = (
            EmpresaPerfil.objects
            .filter(status=EmpresaPerfil.Status.PUBLISHED)
            .prefetch_related('categorias')
            .select_related('categoria_principal')
        )

        if categoria_slug:
            qs = qs.filter(categorias__slug=categoria_slug)
        if subcategoria_slug:
            qs = qs.filter(subcategorias__slug=subcategoria_slug)
        if ciudad:
            qs = qs.filter(ciudad__icontains=ciudad)
        if estado:
            qs = qs.filter(estado__icontains=estado)
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(nombre_comercial__icontains=search) |
                Q(descripcion__icontains=search) |
                Q(categorias__nombre__icontains=search) |
                Q(subcategorias__nombre__icontains=search) |
                Q(subcategorias__keywords__icontains=search)
            )

        qs = qs.annotate(
            plan_rank=Case(
                When(plan='enterprise', then=Value(3)),
                When(plan='pro', then=Value(2)),
                When(plan='starter', then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ).order_by('-verified', '-plan_rank', '-score_completitud').distinct()

        total = qs.count()
        empresas = list(qs[offset: offset + limit])
        return DirectorioResultType(
            empresas=empresas,
            total=total,
            has_more=(offset + limit) < total,
        )

    @strawberry.field
    def empresa(self, info: Info, slug: str) -> Optional[EmpresaPerfilPublicType]:
        """Public company profile by slug."""
        try:
            return (
                EmpresaPerfil.objects
                .filter(status=EmpresaPerfil.Status.PUBLISHED)
                .prefetch_related('categorias', 'subcategorias')
                .select_related('categoria_principal')
                .get(slug=slug)
            )
        except EmpresaPerfil.DoesNotExist:
            return None

    @strawberry.field
    def categorias(self, info: Info, activas_only: bool = True) -> List[CategoriaType]:
        qs = Categoria.objects.all()
        if activas_only:
            qs = qs.filter(activa=True)
        return list(qs)

    @strawberry.field
    def subcategorias(self, info: Info, categoria_slug: str) -> List[SubcategoriaType]:
        return list(
            Subcategoria.objects
            .filter(categoria__slug=categoria_slug)
            .order_by('orden', 'nombre')
        )

    @strawberry.field
    def marcas(self, info: Info, subcategoria_slug: str) -> List[MarcaType]:
        """Returns all approved brands for a given subcategory slug."""
        return list(
            Marca.objects
            .filter(subcategoria__slug=subcategoria_slug, status='aprobada')
            .select_related('subcategoria')
            .order_by('orden', 'nombre')
        )

    @strawberry.field
    def modelos(
        self,
        info: Info,
        subcategoria_slug: str,
        marca_id: Optional[strawberry.ID] = None,
    ) -> List[ModeloType]:
        """Returns all approved models for a subcategory, optionally filtered by brand."""
        qs = (
            Modelo.objects
            .filter(subcategoria__slug=subcategoria_slug, status='aprobado')
            .select_related('marca', 'subcategoria')
            .order_by('orden', 'nombre')
        )
        if marca_id is not None:
            qs = qs.filter(marca_id=marca_id)
        return list(qs)

    @strawberry.field
    def invitacion(self, info: Info, token: str) -> Optional[InvitacionInfoType]:
        """
        Public query to preview an invite before the user creates an account.
        Returns empresa name + validity — never exposes email or sensitive data.
        """
        try:
            inv = InvitacionEmpresa.objects.select_related('empresa').get(token=token)
            return InvitacionInfoType(
                empresa_nombre=inv.empresa.nombre_comercial,
                empresa_slug=inv.empresa.slug,
                valid=inv.is_valid,
                email_restringido=bool(inv.email),
            )
        except InvitacionEmpresa.DoesNotExist:
            return None


@strawberry.type
class PublicMutation:

    @strawberry.mutation
    def enviar_solicitud_cotizacion(
        self,
        info: Info,
        empresa_slug: str,
        nombre_contacto: str,
        email_contacto: str,
        telefono: str = '',
        empresa_compradora: str = '',
        mensaje: str = '',
    ) -> bool:
        """
        Submit a quote request. Rate limit: 3 per email per empresa per 24h.
        Free-plan companies: oculto_free=True (count visible, content hidden in CMS).
        """
        try:
            empresa = EmpresaPerfil.objects.filter(
                status=EmpresaPerfil.Status.PUBLISHED
            ).get(slug=empresa_slug)
        except EmpresaPerfil.DoesNotExist:
            return False

        since = datetime.now(timezone.utc) - timedelta(hours=24)
        recent = SolicitudCotizacion.objects.filter(
            empresa=empresa,
            email_contacto=email_contacto,
            created_at__gte=since,
        ).count()
        if recent >= 3:
            raise ValueError('Has enviado demasiadas solicitudes. Intenta mañana.')

        SolicitudCotizacion.objects.create(
            empresa=empresa,
            nombre_contacto=nombre_contacto,
            email_contacto=email_contacto,
            telefono=telefono,
            empresa_compradora=empresa_compradora,
            mensaje=mensaje,
            oculto_free=(empresa.plan == EmpresaPerfil.Plan.FREE),
        )
        return True


public_schema = strawberry.Schema(query=PublicQuery, mutation=PublicMutation)
