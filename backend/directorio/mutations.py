"""Authenticated GraphQL mutations for the directorio app."""

from typing import Optional, List

from users.mutations import MeType, _build_me
from datetime import datetime, timezone

import strawberry
from strawberry.types import Info
from strawberry.file_uploads import Upload

from django.utils.text import slugify

from users.auth import get_user_from_request, get_tenant_from_user
from directorio.models import (
    Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion,
    _unique_slug,
)
from directorio.types import (
    CategoriaType, SubcategoriaType, EmpresaPerfilType, SolicitudCotizacionType,
)
from directorio.plan_limits import enforce_max, enforce_bool


@strawberry.type
class DirectorioMutation:

    # ── Category mutations (global — no tenant check) ─────────────────────

    @strawberry.mutation
    def crear_categoria(
        self,
        info: Info,
        nombre: str,
        codigo: str = '',
        icono: str = '',
        descripcion: str = '',
        orden: int = 0,
    ) -> CategoriaType:
        get_user_from_request(info)
        slug = _unique_slug(nombre, Categoria)
        return Categoria.objects.create(
            nombre=nombre,
            slug=slug,
            codigo=codigo or slug[:20],
            icono=icono,
            descripcion=descripcion,
            orden=orden,
        )

    @strawberry.mutation
    def actualizar_categoria(
        self,
        info: Info,
        id: strawberry.ID,
        nombre: str = '',
        icono: str = '',
        descripcion: str = '',
        orden: int = -1,
        activa: Optional[bool] = None,
    ) -> CategoriaType:
        get_user_from_request(info)
        cat = Categoria.objects.get(pk=id)
        if nombre:
            cat.nombre = nombre
        if icono is not None:
            cat.icono = icono
        if descripcion is not None:
            cat.descripcion = descripcion
        if orden >= 0:
            cat.orden = orden
        if activa is not None:
            cat.activa = activa
        cat.save()
        return cat

    @strawberry.mutation
    def eliminar_categoria(self, info: Info, id: strawberry.ID) -> bool:
        get_user_from_request(info)
        deleted, _ = Categoria.objects.filter(pk=id).delete()
        return deleted > 0

    @strawberry.mutation
    def crear_subcategoria(
        self,
        info: Info,
        nombre: str,
        categoria_id: strawberry.ID,
        descripcion: str = '',
    ) -> SubcategoriaType:
        get_user_from_request(info)
        categoria = Categoria.objects.get(pk=categoria_id)
        slug = slugify(nombre)[:300] or 'sin-nombre'
        counter = 1
        base = slug
        while Subcategoria.objects.filter(categoria=categoria, slug=slug).exists():
            slug = f'{base}-{counter}'
            counter += 1
        return Subcategoria.objects.create(
            categoria=categoria,
            nombre=nombre,
            slug=slug,
            descripcion=descripcion,
        )

    @strawberry.mutation
    def actualizar_subcategoria(
        self,
        info: Info,
        id: strawberry.ID,
        nombre: str = '',
        descripcion: str = '',
    ) -> SubcategoriaType:
        get_user_from_request(info)
        sub = Subcategoria.objects.get(pk=id)
        if nombre:
            sub.nombre = nombre
        if descripcion is not None:
            sub.descripcion = descripcion
        sub.save()
        return sub

    @strawberry.mutation
    def eliminar_subcategoria(self, info: Info, id: strawberry.ID) -> bool:
        get_user_from_request(info)
        deleted, _ = Subcategoria.objects.filter(pk=id).delete()
        return deleted > 0

    # ── EmpresaPerfil mutations (tenant-scoped) ────────────────────────────

    @strawberry.mutation
    def crear_empresa_perfil(
        self,
        info: Info,
        nombre_comercial: str,
        ciudad: str = '',
        estado: str = '',
    ) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        if EmpresaPerfil.objects.filter(tenant=tenant).exists():
            raise ValueError('Este workspace ya tiene un perfil de empresa')
        slug = _unique_slug(nombre_comercial, EmpresaPerfil)
        return EmpresaPerfil.objects.create(
            tenant=tenant,
            nombre_comercial=nombre_comercial,
            slug=slug,
            ciudad=ciudad,
            estado=estado,
        )

    @strawberry.mutation
    def actualizar_empresa_perfil(
        self,
        info: Info,
        nombre_comercial: Optional[str] = strawberry.UNSET,
        descripcion: Optional[str] = strawberry.UNSET,
        ciudad: Optional[str] = strawberry.UNSET,
        estado: Optional[str] = strawberry.UNSET,
        pais: Optional[str] = strawberry.UNSET,
        telefono: Optional[str] = strawberry.UNSET,
        email_contacto: Optional[str] = strawberry.UNSET,
        sitio_web: Optional[str] = strawberry.UNSET,
        whatsapp: Optional[str] = strawberry.UNSET,
        categoria_principal_id: Optional[strawberry.ID] = None,
        categoria_ids: Optional[List[strawberry.ID]] = strawberry.UNSET,
        subcategoria_ids: Optional[List[strawberry.ID]] = strawberry.UNSET,
        status: Optional[str] = strawberry.UNSET,
    ) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)

        UNSET = strawberry.UNSET
        if nombre_comercial is not UNSET and nombre_comercial:
            empresa.nombre_comercial = nombre_comercial
        if descripcion is not UNSET:
            empresa.descripcion = descripcion or ''
        if ciudad is not UNSET:
            empresa.ciudad = ciudad or ''
        if estado is not UNSET:
            empresa.estado = estado or ''
        if pais is not UNSET and pais:
            empresa.pais = pais
        if telefono is not UNSET:
            empresa.telefono = telefono or ''
        if email_contacto is not UNSET:
            empresa.email_contacto = email_contacto or ''
        if sitio_web is not UNSET:
            empresa.sitio_web = sitio_web or ''
        if whatsapp is not UNSET:
            empresa.whatsapp = whatsapp or ''
        if status is not UNSET and status and status in EmpresaPerfil.Status.values:
            empresa.status = status
            if status == EmpresaPerfil.Status.PUBLISHED and not empresa.published_at:
                empresa.published_at = datetime.now(timezone.utc)

        empresa.save()

        if subcategoria_ids is not strawberry.UNSET and subcategoria_ids is not None:
            enforce_max(empresa, 'max_subcategorias', len(subcategoria_ids), 'subcategorías')
            subs = list(
                Subcategoria.objects
                .filter(pk__in=subcategoria_ids)
                .select_related('categoria')
            )
            empresa.subcategorias.set(subs)

            # Auto-derive categories from selected subcategories (preserves insertion order)
            cats = list(dict.fromkeys(s.categoria for s in subs))
            empresa.categorias.set(cats)
            empresa.categoria_principal = cats[0] if cats else None
            empresa.save(update_fields=['categoria_principal'])

        return (
            EmpresaPerfil.objects
            .prefetch_related('categorias', 'subcategorias')
            .select_related('categoria_principal')
            .get(pk=empresa.pk)
        )

    @strawberry.mutation
    def subir_logo(self, info: Info, file: Upload) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        if empresa.logo:
            empresa.logo.delete(save=False)
        empresa.logo.save(file.name, file, save=True)
        return empresa

    @strawberry.mutation
    def subir_portada(self, info: Info, file: Upload) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        enforce_bool(empresa, 'puede_subir_portada', 'subir imagen de portada')
        if empresa.portada:
            empresa.portada.delete(save=False)
        empresa.portada.save(file.name, file, save=True)
        return empresa

    @strawberry.mutation
    def eliminar_logo(self, info: Info) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        empresa.logo.delete(save=True)
        return empresa

    @strawberry.mutation
    def publicar_empresa(self, info: Info) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        empresa.status = EmpresaPerfil.Status.PUBLISHED
        if not empresa.published_at:
            empresa.published_at = datetime.now(timezone.utc)
        empresa.save(update_fields=['status', 'published_at'])
        return empresa

    @strawberry.mutation
    def archivar_empresa(self, info: Info) -> EmpresaPerfilType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        empresa.status = EmpresaPerfil.Status.ARCHIVED
        empresa.save(update_fields=['status'])
        return empresa

    # ── Claim mutations ───────────────────────────────────────────────────

    @strawberry.mutation
    def reclamar_empresa(self, info: Info, token: str) -> MeType:
        """
        Links the authenticated user as OWNER of an existing empresa via invite token.
        Used in Scenario 2: empresa already exists, user claims it via a special link.
        """
        from directorio.models import InvitacionEmpresa
        from core.models import TenantMembership
        from django.utils import timezone as tz

        user = get_user_from_request(info)

        try:
            inv = InvitacionEmpresa.objects.select_related('empresa__tenant').get(token=token)
        except InvitacionEmpresa.DoesNotExist:
            raise ValueError('Invitación no válida o no encontrada')

        if not inv.is_valid:
            raise ValueError('Esta invitación ya fue usada o expiró')

        if inv.email and inv.email.lower() != user.email.lower():
            raise ValueError(f'Esta invitación es exclusiva para {inv.email}')

        if TenantMembership.objects.filter(user=user, is_active=True).exists():
            raise ValueError('Tu cuenta ya tiene una empresa asociada')

        tenant = inv.empresa.tenant
        TenantMembership.objects.create(
            tenant=tenant,
            user=user,
            role=TenantMembership.Role.OWNER,
            is_active=True,
        )
        user.active_tenant = tenant
        user.save(update_fields=['active_tenant'])

        inv.used_at = tz.now()
        inv.used_by = user
        inv.save(update_fields=['used_at', 'used_by'])

        return _build_me(user)

    # ── Lead mutations ─────────────────────────────────────────────────────

    @strawberry.mutation
    def marcar_solicitud_vista(self, info: Info, id: strawberry.ID) -> SolicitudCotizacionType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        sol = SolicitudCotizacion.objects.get(pk=id, empresa=empresa)
        sol.status = SolicitudCotizacion.Status.VISTA
        sol.save(update_fields=['status'])
        return sol

    @strawberry.mutation
    def marcar_solicitud_respondida(self, info: Info, id: strawberry.ID) -> SolicitudCotizacionType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        sol = SolicitudCotizacion.objects.get(pk=id, empresa=empresa)
        sol.status = SolicitudCotizacion.Status.RESPONDIDA
        sol.save(update_fields=['status'])
        return sol

    @strawberry.mutation
    def archivar_solicitud(self, info: Info, id: strawberry.ID) -> SolicitudCotizacionType:
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        sol = SolicitudCotizacion.objects.get(pk=id, empresa=empresa)
        sol.status = SolicitudCotizacion.Status.ARCHIVADA
        sol.save(update_fields=['status'])
        return sol
