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
    InvitacionEmpresa, Marca, Modelo, BlogPost,
    ForoPost, ForoRespuesta, NotificacionForo,
)
from directorio.types import (
    CategoriaType, SubcategoriaType, EmpresaPerfilPublicType,
    DirectorioResultType, MarcaType, ModeloType, BlogPostType, BlogPostListResult,
    ForoPostType, ForoRespuestaType, ForoPostListResult,
)
from directorio.plan_limits import PlanInfoType, build_all_plans  # noqa: F401
from users.auth import get_user_from_request


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
    def subcategorias(
        self,
        info: Info,
        categoria_slug: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[SubcategoriaType]:
        qs = Subcategoria.objects.select_related('categoria').order_by('categoria__nombre', 'orden', 'nombre')
        if categoria_slug:
            qs = qs.filter(categoria__slug=categoria_slug)
        if search:
            qs = qs.filter(nombre__icontains=search)
        if limit:
            qs = qs[:limit]
        return list(qs)

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
    def blog_posts(
        self,
        info: Info,
        limit: int = 10,
        offset: int = 0,
    ) -> BlogPostListResult:
        """Paginated list of published industry blog posts (public)."""
        limit = min(max(limit, 1), 50)
        qs = (
            BlogPost.objects
            .filter(status='published', target='industry')
            .select_related('autor')
        )
        total = qs.count()
        posts = list(qs[offset: offset + limit])
        return BlogPostListResult(posts=posts, total=total, has_more=(offset + limit) < total)

    @strawberry.field
    def blog_post(self, info: Info, slug: str) -> Optional[BlogPostType]:
        """Single published industry blog post by slug (public)."""
        try:
            return BlogPost.objects.select_related('autor').get(
                slug=slug, status='published', target='industry'
            )
        except BlogPost.DoesNotExist:
            return None

    # ── Forum ────────────────────────────────────────────────────────────────

    @strawberry.field
    def foro_posts(
        self,
        info: Info,
        subcategoria_slug: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> ForoPostListResult:
        """Paginated list of forum posts. Optionally filtered by subcategoria slug."""
        qs = (
            ForoPost.objects
            .filter(deleted=False, moderacion_status=ForoPost.MOD_APPROVED)
            .select_related('empresa')
            .prefetch_related('subcategorias')
        )
        if subcategoria_slug:
            qs = qs.filter(subcategorias__slug=subcategoria_slug)
        total = qs.count()
        posts = list(qs[offset: offset + limit])
        return ForoPostListResult(
            posts=posts,
            total=total,
            has_more=(offset + limit) < total,
        )

    @strawberry.field
    def foro_post(self, info: Info, id: int) -> Optional[ForoPostType]:
        """Single forum post with replies."""
        try:
            return (
                ForoPost.objects
                .filter(deleted=False, moderacion_status=ForoPost.MOD_APPROVED)
                .select_related('empresa')
                .prefetch_related('subcategorias')
                .get(pk=id)
            )
        except ForoPost.DoesNotExist:
            return None

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

    # ── Forum mutations ───────────────────────────────────────────────────────

    @strawberry.mutation
    def crear_foro_post(
        self,
        info: Info,
        subcategoria_slugs: List[str],
        titulo: str,
        contenido: str,
        autor_nombre: str,
        autor_email: Optional[str] = None,
    ) -> ForoPostType:
        """
        Create a forum post. Up to 5 subcategorias. Anonymous or authenticated.
        Rate limit: 5 posts per IP per hour.
        """
        # Validate subcategorias
        slugs = list(dict.fromkeys(s.strip() for s in subcategoria_slugs if s.strip()))  # dedupe
        if not slugs:
            raise ValueError('Selecciona al menos un producto de interés.')
        if len(slugs) > 5:
            raise ValueError('Máximo 5 productos de interés por publicación.')

        subcategorias_qs = list(Subcategoria.objects.filter(slug__in=slugs))
        if len(subcategorias_qs) != len(slugs):
            found = {s.slug for s in subcategorias_qs}
            missing = [s for s in slugs if s not in found]
            raise ValueError(f'Subcategoría(s) no encontrada(s): {", ".join(missing)}')

        # Basic field validation
        titulo = titulo.strip()
        contenido = contenido.strip()
        autor_nombre = autor_nombre.strip()
        if not titulo:
            raise ValueError('El título no puede estar vacío.')
        if not contenido:
            raise ValueError('El contenido no puede estar vacío.')
        if not autor_nombre:
            raise ValueError('El nombre del autor es requerido.')

        # Get client IP for rate limiting
        request = info.context['request']
        ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR')
        )

        # Rate limit: 5 posts per IP per hour
        since = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = ForoPost.objects.filter(ip_origen=ip, created_at__gte=since).count()
        if recent_count >= 5:
            raise ValueError('Has creado demasiadas publicaciones. Intenta en una hora.')

        # Optional auth: attach empresa if user is logged in
        empresa = None
        try:
            user = get_user_from_request(info)
            if user.active_tenant_id:
                empresa = EmpresaPerfil.objects.filter(tenant=user.active_tenant).first()
                if empresa:
                    autor_nombre = empresa.nombre_comercial
        except (ValueError, Exception):
            pass  # Not authenticated — proceed anonymously

        post = ForoPost.objects.create(
            titulo=titulo,
            contenido=contenido,
            autor_nombre=autor_nombre,
            autor_email=(autor_email or '').strip(),
            empresa=empresa,
            ip_origen=ip,
        )
        post.subcategorias.set(subcategorias_qs)

        # Create notification stubs for empresas that sell in any selected subcategoria
        empresas_a_notificar = (
            EmpresaPerfil.objects
            .filter(subcategorias__in=subcategorias_qs, status=EmpresaPerfil.Status.PUBLISHED)
            .exclude(pk=empresa.pk if empresa else None)
            .distinct()
        )
        NotificacionForo.objects.bulk_create(
            [NotificacionForo(empresa=e, post=post) for e in empresas_a_notificar],
            ignore_conflicts=True,
        )

        return post

    @strawberry.mutation
    def crear_foro_respuesta(
        self,
        info: Info,
        post_id: int,
        contenido: str,
        autor_nombre: str,
        autor_email: Optional[str] = None,
    ) -> ForoRespuestaType:
        """
        Reply to a forum post. Anonymous or authenticated.
        Rate limit: 5 replies per IP per hour.
        """
        try:
            post = ForoPost.objects.get(pk=post_id, deleted=False)
        except ForoPost.DoesNotExist:
            raise ValueError('El post no existe o fue eliminado.')

        contenido = contenido.strip()
        autor_nombre = autor_nombre.strip()
        if not contenido:
            raise ValueError('El contenido no puede estar vacío.')
        if not autor_nombre:
            raise ValueError('El nombre del autor es requerido.')

        request = info.context['request']
        ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR')
        )

        since = datetime.now(timezone.utc) - timedelta(hours=1)
        recent_count = ForoRespuesta.objects.filter(ip_origen=ip, created_at__gte=since).count()
        if recent_count >= 5:
            raise ValueError('Has enviado demasiadas respuestas. Intenta en una hora.')

        empresa = None
        try:
            user = get_user_from_request(info)
            if user.active_tenant_id:
                empresa = EmpresaPerfil.objects.filter(tenant=user.active_tenant).first()
                if empresa:
                    autor_nombre = empresa.nombre_comercial
        except (ValueError, Exception):
            pass

        return ForoRespuesta.objects.create(
            post=post,
            contenido=contenido,
            autor_nombre=autor_nombre,
            autor_email=(autor_email or '').strip(),
            empresa=empresa,
            ip_origen=ip,
        )


public_schema = strawberry.Schema(query=PublicQuery, mutation=PublicMutation)
