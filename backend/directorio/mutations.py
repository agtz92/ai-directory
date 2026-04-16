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
    _unique_slug, Marca, Modelo, EmpresaModelo, NotificacionStaff,
)
from directorio.types import (
    CategoriaType, SubcategoriaType, EmpresaPerfilType, SolicitudCotizacionType,
    MarcaType, ModeloType, EmpresaModeloType,
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
            new_count = len(subcategoria_ids)
            current_count = empresa.subcategorias.count()
            # Only block if the user is ADDING beyond the plan limit.
            # Always allow reductions (even when currently over-limit after a downgrade).
            if new_count > current_count:
                enforce_max(empresa, 'max_subcategorias', new_count, 'subcategorías')
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
    def subir_csf(self, info: Info, file: Upload) -> EmpresaPerfilType:
        """
        Upload a Constancia de Situación Fiscal for verification.
        Available from Starter plan onwards (badge_verificado limit).
        Sets csf_status = 'pendiente' for admin review.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        enforce_bool(empresa, 'badge_verificado', 'verificación de empresa')
        if empresa.csf_documento:
            empresa.csf_documento.delete(save=False)
        empresa.csf_documento.save(file.name, file, save=False)
        empresa.csf_status = EmpresaPerfil.CsfStatus.PENDIENTE
        empresa.save(update_fields=['csf_documento', 'csf_status'])
        return (
            EmpresaPerfil.objects
            .prefetch_related('categorias', 'subcategorias')
            .select_related('categoria_principal')
            .get(pk=empresa.pk)
        )

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

    @strawberry.mutation
    def cambiar_plan(self, info: Info, plan: str) -> MeType:
        """
        Change the empresa's plan immediately.
        No payment gate here — add Stripe/paywall before this in production.
        Returns MeType so the frontend can refresh planLimits in the auth store.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        if plan not in EmpresaPerfil.Plan.values:
            raise ValueError(
                f'Plan "{plan}" no válido. Opciones: {", ".join(EmpresaPerfil.Plan.values)}'
            )
        empresa.plan = plan
        empresa.save(update_fields=['plan'])
        return _build_me(user)

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

    # ── Marca / Modelo (tenant proposals) ────────────────────────────────

    @strawberry.mutation
    def solicitar_marca(
        self,
        info: Info,
        subcategoria_id: strawberry.ID,
        nombre: str,
        descripcion: str = '',
    ) -> MarcaType:
        """
        Propose a new brand under a subcategory.
        Creates with status='pendiente'; staff must approve before it becomes visible.
        Raises ValueError if an identical name already exists in that subcategory.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        subcategoria = Subcategoria.objects.select_related('categoria').get(pk=subcategoria_id)

        if Marca.objects.filter(
            subcategoria=subcategoria,
            nombre__iexact=nombre.strip(),
        ).exists():
            raise ValueError(
                f'Ya existe una marca con el nombre "{nombre}" en esa subcategoría.'
            )

        marca = Marca.objects.create(
            subcategoria=subcategoria,
            nombre=nombre.strip(),
            descripcion=descripcion,
            creada_por=empresa,
        )
        NotificacionStaff.objects.create(
            tipo=NotificacionStaff.Tipo.MARCA_NUEVA,
            referencia_id=marca.pk,
            mensaje=(
                f'{empresa.nombre_comercial} propuso la marca '
                f'"{nombre}" en {subcategoria.nombre}'
            ),
        )
        return marca

    @strawberry.mutation
    def solicitar_modelo(
        self,
        info: Info,
        marca_id: strawberry.ID,
        nombre: str,
        descripcion: str = '',
    ) -> ModeloType:
        """
        Propose a new model under an already-approved brand.
        Raises ValueError if the brand is not yet approved.
        Raises ValueError if an identical name already exists under that brand.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        marca = Marca.objects.select_related('subcategoria').get(pk=marca_id)

        if marca.status != Marca.Status.APROBADA:
            raise ValueError(
                'Solo puedes proponer modelos para marcas ya aprobadas. '
                f'Esta marca está en estado "{marca.get_status_display()}".'
            )

        if Modelo.objects.filter(
            marca=marca,
            nombre__iexact=nombre.strip(),
        ).exists():
            raise ValueError(
                f'Ya existe un modelo con el nombre "{nombre}" en esa marca.'
            )

        modelo = Modelo.objects.create(
            subcategoria=marca.subcategoria,
            marca=marca,
            nombre=nombre.strip(),
            descripcion=descripcion,
            creada_por=empresa,
        )
        NotificacionStaff.objects.create(
            tipo=NotificacionStaff.Tipo.MODELO_NUEVO,
            referencia_id=modelo.pk,
            mensaje=(
                f'{empresa.nombre_comercial} propuso el modelo '
                f'"{nombre}" (marca {marca.nombre})'
            ),
        )
        return modelo

    @strawberry.mutation
    def agregar_empresa_modelo(
        self,
        info: Info,
        modelo_id: strawberry.ID,
        existencia: bool = True,
    ) -> EmpresaModeloType:
        """
        Link an approved Modelo to the authenticated tenant's company profile.
        Raises ValueError if the model is not approved or already linked.
        """
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        modelo = Modelo.objects.select_related('marca', 'subcategoria').get(pk=modelo_id)

        if modelo.status != Modelo.Status.APROBADO:
            raise ValueError(
                'Solo puedes vincular modelos aprobados. '
                f'Este modelo está en estado "{modelo.get_status_display()}".'
            )

        # Enforce per-subcategoria plan limit
        current = EmpresaModelo.objects.filter(
            empresa=empresa,
            modelo__subcategoria=modelo.subcategoria,
        ).count()
        from directorio.plan_limits import enforce_max
        enforce_max(
            empresa,
            'max_modelos_por_subcategoria',
            current,
            f'modelos en "{modelo.subcategoria.nombre}"',
        )

        em, created = EmpresaModelo.objects.get_or_create(
            empresa=empresa,
            modelo=modelo,
            defaults={'existencia': existencia},
        )
        if not created:
            raise ValueError(
                'Este modelo ya está vinculado a tu empresa. '
                'Usa actualizarEmpresaModelo para cambiar la existencia.'
            )
        return em

    @strawberry.mutation
    def actualizar_empresa_modelo(
        self,
        info: Info,
        empresa_modelo_id: strawberry.ID,
        existencia: bool,
    ) -> EmpresaModeloType:
        """Update the existencia flag on an existing EmpresaModelo entry."""
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        em = EmpresaModelo.objects.select_related(
            'modelo__marca', 'modelo__subcategoria'
        ).get(pk=empresa_modelo_id, empresa=empresa)
        em.existencia = existencia
        em.save(update_fields=['existencia', 'updated_at'])
        return em

    @strawberry.mutation
    def eliminar_empresa_modelo(
        self,
        info: Info,
        empresa_modelo_id: strawberry.ID,
    ) -> bool:
        """Remove a Modelo from the authenticated tenant's company profile."""
        user = get_user_from_request(info)
        tenant = get_tenant_from_user(user)
        empresa = EmpresaPerfil.objects.get(tenant=tenant)
        deleted, _ = EmpresaModelo.objects.filter(
            pk=empresa_modelo_id,
            empresa=empresa,
        ).delete()
        return deleted > 0

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
