"""
Staff GraphQL schema — mounted at /staff/graphql/

Requires a valid JWT + user.staff_role != '' (is_internal).
Three roles with escalating permissions:

  staff  → edit basic company profile only
  admin  → staff + view leads + change plan + publish/archive
  owner  → admin + manage internal team (assign roles)

All mutations log who performed the action for audit trail.
"""

import logging
from datetime import datetime
from typing import Optional, List

import strawberry
from strawberry.types import Info
from strawberry.scalars import JSON

from django.db.models import Count, Q

from users.auth import get_user_from_request
from users.models import CustomUser
from directorio.models import (
    Categoria, Subcategoria, EmpresaPerfil, SolicitudCotizacion, Producto, _unique_slug,
    Marca, Modelo, EmpresaModelo, NotificacionStaff,
    _unique_slug_within_subcategoria_marca, _unique_slug_within_marca,
)
from directorio.types import (
    EmpresaPerfilType, SolicitudCotizacionType,
    MarcaType, ModeloType, EmpresaModeloType, NotificacionStaffType,
)

logger = logging.getLogger(__name__)


# ─── Auth helpers ─────────────────────────────────────────────────────────────

def _require_internal(info) -> CustomUser:
    """Any Directorio employee (staff / admin / owner)."""
    user = get_user_from_request(info)
    if not user.is_internal:
        raise ValueError('Acceso denegado — se requiere rol de empleado')
    return user


def _require_admin(info) -> CustomUser:
    """Admin or owner only."""
    user = _require_internal(info)
    if user.staff_role not in ('admin', 'owner'):
        raise ValueError('Se requiere rol admin u owner')
    return user


def _require_owner(info) -> CustomUser:
    """Owner only."""
    user = get_user_from_request(info)
    if user.staff_role != 'owner':
        raise ValueError('Se requiere rol owner')
    return user


def _get_empresa(tenant_id: str) -> EmpresaPerfil:
    return (
        EmpresaPerfil.objects
        .prefetch_related('categorias', 'subcategorias')
        .select_related('categoria_principal', 'tenant')
        .get(tenant_id=tenant_id)
    )


# ─── Types ────────────────────────────────────────────────────────────────────

@strawberry.type
class StaffStatsType:
    total_empresas: int
    por_plan: JSON        # {'free': 10, 'starter': 3, ...}
    publicadas: int
    borradores: int
    archivadas: int


@strawberry.type
class StaffEmpresaResultType:
    empresas: List[EmpresaPerfilType]
    total: int


@strawberry.type
class EmpleadoType:
    id: strawberry.ID
    email: str
    display_name: str
    staff_role: str
    date_joined: datetime


@strawberry.type
class ProductoType:
    id: strawberry.ID
    nombre: str
    descripcion: str
    precio: Optional[float]
    unidad: str
    activo: bool
    orden: int
    created_at: datetime
    updated_at: datetime

    @strawberry.field
    def imagen_url(self) -> Optional[str]:
        if self.imagen:
            return self.imagen.url
        return None


@strawberry.type
class StaffMeType:
    id: strawberry.ID
    email: str
    display_name: str
    staff_role: str
    tenant_slug: str
    tenant_name: str
    tenant_id: strawberry.ID


# ─── Queries ──────────────────────────────────────────────────────────────────

@strawberry.type
class StaffQuery:

    @strawberry.field
    def me(self, info: Info) -> StaffMeType:
        """Current authenticated user info — no role guard (used at login to verify access)."""
        user = get_user_from_request(info)
        from users.auth import get_tenant_from_user
        tenant = get_tenant_from_user(user)
        return StaffMeType(
            id=str(user.pk),
            email=user.email,
            display_name=user.display_name,
            staff_role=user.staff_role,
            tenant_slug=tenant.slug if tenant else '',
            tenant_name=tenant.name if tenant else '',
            tenant_id=str(tenant.pk) if tenant else '',
        )

    @strawberry.field
    def staff_stats(self, info: Info) -> StaffStatsType:
        """Global empresa statistics. Available to all internal roles."""
        _require_internal(info)
        total = EmpresaPerfil.objects.count()
        por_plan = dict(
            EmpresaPerfil.objects
            .values('plan')
            .annotate(n=Count('id'))
            .values_list('plan', 'n')
        )
        publicadas = EmpresaPerfil.objects.filter(status=EmpresaPerfil.Status.PUBLISHED).count()
        borradores = EmpresaPerfil.objects.filter(status=EmpresaPerfil.Status.DRAFT).count()
        archivadas = EmpresaPerfil.objects.filter(status=EmpresaPerfil.Status.ARCHIVED).count()
        return StaffStatsType(
            total_empresas=total,
            por_plan=por_plan,
            publicadas=publicadas,
            borradores=borradores,
            archivadas=archivadas,
        )

    @strawberry.field
    def staff_empresas(
        self,
        info: Info,
        search: str = '',
        plan: str = '',
        status: str = '',
        limit: int = 20,
        offset: int = 0,
    ) -> StaffEmpresaResultType:
        """Paginated list of all empresas. Available to all internal roles."""
        _require_internal(info)
        qs = (
            EmpresaPerfil.objects
            .prefetch_related('categorias', 'subcategorias')
            .select_related('categoria_principal', 'tenant')
            .order_by('-created_at')
        )
        if search:
            qs = qs.filter(
                Q(nombre_comercial__icontains=search) |
                Q(tenant__name__icontains=search) |
                Q(ciudad__icontains=search)
            )
        if plan:
            qs = qs.filter(plan=plan)
        if status:
            qs = qs.filter(status=status)
        total = qs.count()
        return StaffEmpresaResultType(
            empresas=list(qs[offset: offset + limit]),
            total=total,
        )

    @strawberry.field
    def staff_empresa(self, info: Info, tenant_id: strawberry.ID) -> EmpresaPerfilType:
        """Full empresa detail for a given tenant. Available to all internal roles."""
        _require_internal(info)
        return _get_empresa(str(tenant_id))

    @strawberry.field
    def staff_solicitudes(
        self,
        info: Info,
        tenant_id: strawberry.ID,
        status: str = '',
        limit: int = 20,
        offset: int = 0,
    ) -> List[SolicitudCotizacionType]:
        """Full lead content — NO plan masking. Requires admin or owner."""
        _require_admin(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        qs = SolicitudCotizacion.objects.filter(empresa=empresa)
        if status:
            qs = qs.filter(status=status)
        return list(qs[offset: offset + limit])

    @strawberry.field
    def staff_productos(self, info: Info, tenant_id: strawberry.ID) -> List[ProductoType]:
        """All products for a company. Available to all internal roles."""
        _require_internal(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        return list(Producto.objects.filter(empresa=empresa))

    @strawberry.field
    def staff_empleados(self, info: Info) -> List[EmpleadoType]:
        """List all internal employees. Owner only."""
        _require_owner(info)
        users = CustomUser.objects.filter(
            staff_role__in=('staff', 'admin', 'owner')
        ).order_by('staff_role', 'email')
        return [
            EmpleadoType(
                id=str(u.pk),
                email=u.email,
                display_name=u.display_name,
                staff_role=u.staff_role,
                date_joined=u.date_joined,
            )
            for u in users
        ]

    @strawberry.field
    def staff_notificaciones(
        self,
        info: Info,
        solo_no_leidas: bool = True,
    ) -> List[NotificacionStaffType]:
        """Global staff inbox. Returns all notifications, optionally filtered to unread only."""
        _require_internal(info)
        qs = NotificacionStaff.objects.all()
        if solo_no_leidas:
            qs = qs.filter(leida=False)
        return [
            NotificacionStaffType(
                id=str(n.pk),
                tipo=n.tipo,
                referencia_id=n.referencia_id,
                mensaje=n.mensaje,
                leida=n.leida,
                created_at=n.created_at,
            )
            for n in qs
        ]

    @strawberry.field
    def staff_marcas_pendientes(self, info: Info) -> List[MarcaType]:
        """All brands awaiting approval. Available to all internal roles."""
        _require_internal(info)
        return list(
            Marca.objects
            .filter(status='pendiente')
            .select_related('subcategoria', 'creada_por')
            .order_by('created_at')
        )

    @strawberry.field
    def staff_modelos_pendientes(self, info: Info) -> List[ModeloType]:
        """All models awaiting approval. Available to all internal roles."""
        _require_internal(info)
        return list(
            Modelo.objects
            .filter(status='pendiente')
            .select_related('marca__subcategoria', 'subcategoria', 'creada_por')
            .order_by('created_at')
        )

    @strawberry.field
    def staff_marcas(
        self,
        info: Info,
        subcategoria_id: strawberry.ID,
        status: str = '',
    ) -> List[MarcaType]:
        """All brands for a subcategory (any status). Available to all internal roles."""
        _require_internal(info)
        qs = (
            Marca.objects
            .filter(subcategoria_id=subcategoria_id)
            .select_related('subcategoria', 'creada_por')
            .order_by('orden', 'nombre')
        )
        if status:
            qs = qs.filter(status=status)
        return list(qs)

    @strawberry.field
    def staff_modelos(
        self,
        info: Info,
        marca_id: strawberry.ID,
        status: str = '',
    ) -> List[ModeloType]:
        """All models for a brand (any status). Available to all internal roles."""
        _require_internal(info)
        qs = (
            Modelo.objects
            .filter(marca_id=marca_id)
            .select_related('marca', 'subcategoria', 'creada_por')
            .order_by('orden', 'nombre')
        )
        if status:
            qs = qs.filter(status=status)
        return list(qs)

    @strawberry.field
    def staff_buscar_usuario(self, info: Info, email: str) -> Optional[EmpleadoType]:
        """
        Search a user by exact email. Owner only.
        Used to find a user before assigning them a staff role.
        Returns None if no account exists (user needs to register first).
        """
        _require_owner(info)
        try:
            u = CustomUser.objects.get(email__iexact=email.strip())
            return EmpleadoType(
                id=str(u.pk),
                email=u.email,
                display_name=u.display_name,
                staff_role=u.staff_role,
                date_joined=u.date_joined,
            )
        except CustomUser.DoesNotExist:
            return None


# ─── Mutations ────────────────────────────────────────────────────────────────

@strawberry.type
class StaffMutation:

    @strawberry.mutation
    def staff_actualizar_empresa(
        self,
        info: Info,
        tenant_id: strawberry.ID,
        nombre_comercial: str = '',
        descripcion: str = '',
        ciudad: str = '',
        estado: str = '',
        pais: str = '',
        telefono: str = '',
        email_contacto: str = '',
        sitio_web: str = '',
        whatsapp: str = '',
        categoria_principal_id: Optional[strawberry.ID] = None,
        categoria_ids: Optional[List[strawberry.ID]] = strawberry.UNSET,
        subcategoria_ids: Optional[List[strawberry.ID]] = strawberry.UNSET,
    ) -> EmpresaPerfilType:
        """Edit basic company profile. Available to all internal roles."""
        actor = _require_internal(info)
        empresa = _get_empresa(str(tenant_id))

        if nombre_comercial:
            empresa.nombre_comercial = nombre_comercial
        if descripcion is not None:
            empresa.descripcion = descripcion
        if ciudad is not None:
            empresa.ciudad = ciudad
        if estado is not None:
            empresa.estado = estado
        if pais:
            empresa.pais = pais
        if telefono is not None:
            empresa.telefono = telefono
        if email_contacto is not None:
            empresa.email_contacto = email_contacto
        if sitio_web is not None:
            empresa.sitio_web = sitio_web
        if whatsapp is not None:
            empresa.whatsapp = whatsapp
        empresa.save()

        if categoria_principal_id is not None:
            empresa.categoria_principal = (
                Categoria.objects.get(pk=categoria_principal_id)
                if categoria_principal_id else None
            )
            empresa.save(update_fields=['categoria_principal'])

        if categoria_ids is not strawberry.UNSET and categoria_ids is not None:
            empresa.categorias.set(Categoria.objects.filter(pk__in=categoria_ids))

        if subcategoria_ids is not strawberry.UNSET and subcategoria_ids is not None:
            empresa.subcategorias.set(Subcategoria.objects.filter(pk__in=subcategoria_ids))

        logger.info(
            f'[STAFF] {actor.email} ({actor.staff_role}) editó empresa '
            f'tenant={tenant_id} nombre="{empresa.nombre_comercial}"'
        )
        return _get_empresa(str(tenant_id))

    @strawberry.mutation
    def staff_cambiar_plan(
        self,
        info: Info,
        tenant_id: strawberry.ID,
        plan: str,
    ) -> EmpresaPerfilType:
        """Change empresa plan. Requires admin or owner."""
        actor = _require_admin(info)
        if plan not in EmpresaPerfil.Plan.values:
            raise ValueError(f'Plan inválido: {plan!r}. Opciones: {EmpresaPerfil.Plan.values}')
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        old_plan = empresa.plan
        empresa.plan = plan
        empresa.save(update_fields=['plan'])
        logger.info(
            f'[STAFF] {actor.email} ({actor.staff_role}) cambió plan '
            f'tenant={tenant_id} {old_plan!r} → {plan!r}'
        )
        return _get_empresa(str(tenant_id))

    @strawberry.mutation
    def staff_publicar_empresa(self, info: Info, tenant_id: strawberry.ID) -> EmpresaPerfilType:
        """Publish empresa. Requires admin or owner."""
        from datetime import timezone
        actor = _require_admin(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        empresa.status = EmpresaPerfil.Status.PUBLISHED
        if not empresa.published_at:
            from datetime import datetime as dt
            empresa.published_at = dt.now(timezone.utc)
        empresa.save(update_fields=['status', 'published_at'])
        logger.info(f'[STAFF] {actor.email} publicó empresa tenant={tenant_id}')
        return _get_empresa(str(tenant_id))

    @strawberry.mutation
    def staff_archivar_empresa(self, info: Info, tenant_id: strawberry.ID) -> EmpresaPerfilType:
        """Archive empresa. Requires admin or owner."""
        actor = _require_admin(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        empresa.status = EmpresaPerfil.Status.ARCHIVED
        empresa.save(update_fields=['status'])
        logger.info(f'[STAFF] {actor.email} archivó empresa tenant={tenant_id}')
        return _get_empresa(str(tenant_id))

    @strawberry.mutation
    def staff_despublicar_empresa(self, info: Info, tenant_id: strawberry.ID) -> EmpresaPerfilType:
        """Set empresa back to draft. Requires admin or owner."""
        actor = _require_admin(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        empresa.status = EmpresaPerfil.Status.DRAFT
        empresa.save(update_fields=['status'])
        logger.info(f'[STAFF] {actor.email} despublicó empresa tenant={tenant_id}')
        return _get_empresa(str(tenant_id))

    @strawberry.mutation
    def staff_marcar_solicitud(
        self,
        info: Info,
        tenant_id: strawberry.ID,
        solicitud_id: strawberry.ID,
        status: str,
    ) -> SolicitudCotizacionType:
        """Change a lead's status. Requires admin or owner."""
        actor = _require_admin(info)
        if status not in SolicitudCotizacion.Status.values:
            raise ValueError(f'Status inválido: {status!r}')
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        sol = SolicitudCotizacion.objects.get(pk=solicitud_id, empresa=empresa)
        sol.status = status
        sol.save(update_fields=['status'])
        logger.info(
            f'[STAFF] {actor.email} cambió solicitud {solicitud_id} → {status!r} '
            f'tenant={tenant_id}'
        )
        return sol

    @strawberry.mutation
    def staff_crear_producto(
        self,
        info: Info,
        tenant_id: strawberry.ID,
        nombre: str,
        descripcion: str = '',
        precio: Optional[float] = None,
        unidad: str = '',
        activo: bool = True,
        orden: int = 0,
    ) -> ProductoType:
        """Create a product for a company. Available to all internal roles."""
        actor = _require_internal(info)
        empresa = EmpresaPerfil.objects.get(tenant_id=tenant_id)
        producto = Producto.objects.create(
            empresa=empresa,
            nombre=nombre,
            descripcion=descripcion,
            precio=precio,
            unidad=unidad,
            activo=activo,
            orden=orden,
        )
        logger.info(f'[STAFF] {actor.email} creó producto "{nombre}" tenant={tenant_id}')
        return producto

    @strawberry.mutation
    def staff_actualizar_producto(
        self,
        info: Info,
        producto_id: strawberry.ID,
        nombre: Optional[str] = None,
        descripcion: Optional[str] = None,
        precio: Optional[float] = strawberry.UNSET,
        unidad: Optional[str] = None,
        activo: Optional[bool] = None,
        orden: Optional[int] = None,
    ) -> ProductoType:
        """Update a product. Available to all internal roles."""
        actor = _require_internal(info)
        producto = Producto.objects.get(pk=producto_id)
        if nombre is not None:
            producto.nombre = nombre
        if descripcion is not None:
            producto.descripcion = descripcion
        if precio is not strawberry.UNSET:
            producto.precio = precio
        if unidad is not None:
            producto.unidad = unidad
        if activo is not None:
            producto.activo = activo
        if orden is not None:
            producto.orden = orden
        producto.save()
        logger.info(f'[STAFF] {actor.email} actualizó producto {producto_id}')
        return producto

    @strawberry.mutation
    def staff_eliminar_producto(
        self,
        info: Info,
        producto_id: strawberry.ID,
    ) -> bool:
        """Delete a product. Available to all internal roles."""
        actor = _require_internal(info)
        producto = Producto.objects.get(pk=producto_id)
        nombre = producto.nombre
        empresa_id = producto.empresa.tenant_id
        producto.delete()
        logger.info(f'[STAFF] {actor.email} eliminó producto "{nombre}" tenant={empresa_id}')
        return True

    # ── Marca / Modelo approval ────────────────────────────────────────────

    @strawberry.mutation
    def staff_aprobar_marca(self, info: Info, marca_id: strawberry.ID) -> MarcaType:
        """Approve a pending brand. Available to all internal roles."""
        actor = _require_internal(info)
        marca = Marca.objects.select_related('subcategoria').get(pk=marca_id)
        marca.status = Marca.Status.APROBADA
        marca.activa = True
        marca.motivo_rechazo = ''
        marca.save(update_fields=['status', 'activa', 'motivo_rechazo'])
        NotificacionStaff.objects.filter(
            tipo=NotificacionStaff.Tipo.MARCA_NUEVA, referencia_id=marca.pk
        ).update(leida=True)
        logger.info(f'[STAFF] {actor.email} aprobó marca "{marca.nombre}" id={marca_id}')
        return marca

    @strawberry.mutation
    def staff_rechazar_marca(
        self,
        info: Info,
        marca_id: strawberry.ID,
        motivo: str = '',
    ) -> MarcaType:
        """Reject a pending brand. Available to all internal roles."""
        actor = _require_internal(info)
        marca = Marca.objects.select_related('subcategoria').get(pk=marca_id)
        marca.status = Marca.Status.RECHAZADA
        marca.activa = False
        marca.motivo_rechazo = motivo
        marca.save(update_fields=['status', 'activa', 'motivo_rechazo'])
        NotificacionStaff.objects.filter(
            tipo=NotificacionStaff.Tipo.MARCA_NUEVA, referencia_id=marca.pk
        ).update(leida=True)
        logger.info(f'[STAFF] {actor.email} rechazó marca "{marca.nombre}" id={marca_id}')
        return marca

    @strawberry.mutation
    def staff_aprobar_modelo(self, info: Info, modelo_id: strawberry.ID) -> ModeloType:
        """Approve a pending model. Available to all internal roles."""
        actor = _require_internal(info)
        modelo = Modelo.objects.select_related('marca', 'subcategoria').get(pk=modelo_id)
        modelo.status = Modelo.Status.APROBADO
        modelo.activo = True
        modelo.motivo_rechazo = ''
        modelo.save(update_fields=['status', 'activo', 'motivo_rechazo'])
        NotificacionStaff.objects.filter(
            tipo=NotificacionStaff.Tipo.MODELO_NUEVO, referencia_id=modelo.pk
        ).update(leida=True)
        logger.info(f'[STAFF] {actor.email} aprobó modelo "{modelo.nombre}" id={modelo_id}')
        return modelo

    @strawberry.mutation
    def staff_rechazar_modelo(
        self,
        info: Info,
        modelo_id: strawberry.ID,
        motivo: str = '',
    ) -> ModeloType:
        """Reject a pending model. Available to all internal roles."""
        actor = _require_internal(info)
        modelo = Modelo.objects.select_related('marca', 'subcategoria').get(pk=modelo_id)
        modelo.status = Modelo.Status.RECHAZADO
        modelo.activo = False
        modelo.motivo_rechazo = motivo
        modelo.save(update_fields=['status', 'activo', 'motivo_rechazo'])
        NotificacionStaff.objects.filter(
            tipo=NotificacionStaff.Tipo.MODELO_NUEVO, referencia_id=modelo.pk
        ).update(leida=True)
        logger.info(f'[STAFF] {actor.email} rechazó modelo "{modelo.nombre}" id={modelo_id}')
        return modelo

    @strawberry.mutation
    def staff_marcar_notificacion_leida(
        self,
        info: Info,
        notificacion_id: strawberry.ID,
    ) -> NotificacionStaffType:
        """Mark a single staff notification as read."""
        _require_internal(info)
        notif = NotificacionStaff.objects.get(pk=notificacion_id)
        notif.leida = True
        notif.save(update_fields=['leida'])
        return NotificacionStaffType(
            id=str(notif.pk),
            tipo=notif.tipo,
            referencia_id=notif.referencia_id,
            mensaje=notif.mensaje,
            leida=notif.leida,
            created_at=notif.created_at,
        )

    @strawberry.mutation
    def staff_marcar_todas_leidas(self, info: Info) -> bool:
        """Mark all unread staff notifications as read."""
        _require_internal(info)
        NotificacionStaff.objects.filter(leida=False).update(leida=True)
        return True

    # ── Marca CRUD ────────────────────────────────────────────────────────

    @strawberry.mutation
    def staff_crear_marca(
        self,
        info: Info,
        subcategoria_id: strawberry.ID,
        nombre: str,
        descripcion: str = '',
    ) -> MarcaType:
        """Create a brand directly (auto-approved). Available to all internal roles."""
        actor = _require_internal(info)
        subcategoria = Subcategoria.objects.get(pk=subcategoria_id)
        marca = Marca.objects.create(
            subcategoria=subcategoria,
            nombre=nombre.strip(),
            descripcion=descripcion,
            status=Marca.Status.APROBADA,
            activa=True,
            creada_por=None,
        )
        logger.info(
            f'[STAFF] {actor.email} creó marca "{nombre}" subcategoria={subcategoria_id}'
        )
        return Marca.objects.select_related('subcategoria').get(pk=marca.pk)

    @strawberry.mutation
    def staff_actualizar_marca(
        self,
        info: Info,
        marca_id: strawberry.ID,
        nombre: Optional[str] = None,
        descripcion: Optional[str] = None,
        status: Optional[str] = None,
        orden: Optional[int] = None,
    ) -> MarcaType:
        """Update a brand's fields. Available to all internal roles."""
        actor = _require_internal(info)
        marca = Marca.objects.select_related('subcategoria').get(pk=marca_id)
        update_fields = []
        if nombre is not None:
            marca.nombre = nombre.strip()
            marca.slug = _unique_slug_within_subcategoria_marca(
                nombre.strip(), marca.subcategoria_id, exclude_pk=marca.pk
            )
            update_fields += ['nombre', 'slug']
        if descripcion is not None:
            marca.descripcion = descripcion
            update_fields.append('descripcion')
        if status is not None:
            if status not in Marca.Status.values:
                raise ValueError(f'Status inválido: {status!r}')
            marca.status = status
            marca.activa = (status == Marca.Status.APROBADA)
            update_fields += ['status', 'activa']
        if orden is not None:
            marca.orden = orden
            update_fields.append('orden')
        if update_fields:
            marca.save(update_fields=update_fields)
        logger.info(f'[STAFF] {actor.email} actualizó marca id={marca_id} fields={update_fields}')
        return marca

    @strawberry.mutation
    def staff_eliminar_marca(self, info: Info, marca_id: strawberry.ID) -> bool:
        """Hard-delete a brand (cascades to Modelo and EmpresaModelo). Requires admin."""
        actor = _require_admin(info)
        marca = Marca.objects.get(pk=marca_id)
        nombre = marca.nombre
        marca.delete()
        logger.info(f'[STAFF] {actor.email} eliminó marca "{nombre}" id={marca_id}')
        return True

    # ── Modelo CRUD ───────────────────────────────────────────────────────

    @strawberry.mutation
    def staff_crear_modelo(
        self,
        info: Info,
        marca_id: strawberry.ID,
        nombre: str,
        descripcion: str = '',
    ) -> ModeloType:
        """Create a model directly (auto-approved). Available to all internal roles."""
        actor = _require_internal(info)
        marca = Marca.objects.select_related('subcategoria').get(pk=marca_id)
        modelo = Modelo.objects.create(
            marca=marca,
            subcategoria=marca.subcategoria,
            nombre=nombre.strip(),
            descripcion=descripcion,
            status=Modelo.Status.APROBADO,
            activo=True,
            creada_por=None,
        )
        logger.info(
            f'[STAFF] {actor.email} creó modelo "{nombre}" marca={marca_id}'
        )
        return Modelo.objects.select_related('marca', 'subcategoria').get(pk=modelo.pk)

    @strawberry.mutation
    def staff_actualizar_modelo(
        self,
        info: Info,
        modelo_id: strawberry.ID,
        nombre: Optional[str] = None,
        descripcion: Optional[str] = None,
        status: Optional[str] = None,
        orden: Optional[int] = None,
    ) -> ModeloType:
        """Update a model's fields. Available to all internal roles."""
        actor = _require_internal(info)
        modelo = Modelo.objects.select_related('marca', 'subcategoria').get(pk=modelo_id)
        update_fields = []
        if nombre is not None:
            modelo.nombre = nombre.strip()
            modelo.slug = _unique_slug_within_marca(
                nombre.strip(), modelo.marca_id, exclude_pk=modelo.pk
            )
            update_fields += ['nombre', 'slug']
        if descripcion is not None:
            modelo.descripcion = descripcion
            update_fields.append('descripcion')
        if status is not None:
            if status not in Modelo.Status.values:
                raise ValueError(f'Status inválido: {status!r}')
            modelo.status = status
            modelo.activo = (status == Modelo.Status.APROBADO)
            update_fields += ['status', 'activo']
        if orden is not None:
            modelo.orden = orden
            update_fields.append('orden')
        if update_fields:
            modelo.save(update_fields=update_fields)
        logger.info(f'[STAFF] {actor.email} actualizó modelo id={modelo_id} fields={update_fields}')
        return modelo

    @strawberry.mutation
    def staff_eliminar_modelo(self, info: Info, modelo_id: strawberry.ID) -> bool:
        """Hard-delete a model (cascades to EmpresaModelo). Requires admin."""
        actor = _require_admin(info)
        modelo = Modelo.objects.get(pk=modelo_id)
        nombre = modelo.nombre
        modelo.delete()
        logger.info(f'[STAFF] {actor.email} eliminó modelo "{nombre}" id={modelo_id}')
        return True

    # ── EmpresaModelo management ──────────────────────────────────────────

    @strawberry.mutation
    def staff_actualizar_empresa_modelo(
        self,
        info: Info,
        empresa_modelo_id: strawberry.ID,
        existencia: bool,
    ) -> EmpresaModeloType:
        """Toggle existencia on a tenant's linked model. Available to all internal roles."""
        actor = _require_internal(info)
        em = EmpresaModelo.objects.select_related('modelo__marca', 'modelo__subcategoria').get(
            pk=empresa_modelo_id
        )
        em.existencia = existencia
        em.save(update_fields=['existencia'])
        logger.info(
            f'[STAFF] {actor.email} actualizó EmpresaModelo id={empresa_modelo_id} '
            f'existencia={existencia}'
        )
        return em

    @strawberry.mutation
    def staff_eliminar_empresa_modelo(
        self,
        info: Info,
        empresa_modelo_id: strawberry.ID,
    ) -> bool:
        """Remove a model link from a tenant's profile. Available to all internal roles."""
        actor = _require_internal(info)
        em = EmpresaModelo.objects.select_related('modelo', 'empresa').get(pk=empresa_modelo_id)
        modelo_nombre = em.modelo.nombre
        tenant_id = em.empresa.tenant_id
        em.delete()
        logger.info(
            f'[STAFF] {actor.email} eliminó EmpresaModelo "{modelo_nombre}" '
            f'tenant={tenant_id}'
        )
        return True

    @strawberry.mutation
    def staff_asignar_rol(
        self,
        info: Info,
        user_id: strawberry.ID,
        role: str,
    ) -> EmpleadoType:
        """
        Assign or remove an internal role. Owner only.
        Valid roles: '' (remove access), 'staff', 'admin'.
        Cannot demote another owner (safety guard).
        """
        actor = _require_owner(info)
        valid_assignable = ('', 'staff', 'admin')
        if role not in valid_assignable:
            raise ValueError(
                f'Rol inválido: {role!r}. Asignables: {valid_assignable}'
            )
        target = CustomUser.objects.get(pk=user_id)
        if target.staff_role == 'owner' and target.pk != actor.pk:
            raise ValueError('No puedes modificar el rol de otro owner.')
        old_role = target.staff_role
        target.staff_role = role
        target.save(update_fields=['staff_role'])
        logger.info(
            f'[STAFF] {actor.email} asignó rol {old_role!r} → {role!r} '
            f'a usuario {target.email}'
        )
        return EmpleadoType(
            id=str(target.pk),
            email=target.email,
            display_name=target.display_name,
            staff_role=target.staff_role,
            date_joined=target.date_joined,
        )


# ─── Schema ───────────────────────────────────────────────────────────────────

staff_schema = strawberry.Schema(query=StaffQuery, mutation=StaffMutation)
