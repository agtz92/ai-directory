import uuid

from django.db import models
from django.utils import timezone
from django.utils.text import slugify


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _unique_slug(base: str, model, slug_field: str = 'slug', exclude_pk=None) -> str:
    """Generate a globally unique slug for `model` derived from `base`."""
    slug = slugify(base)[:200] or 'sin-nombre'
    candidate = slug
    counter = 1
    qs = model.objects
    while True:
        exists_qs = qs.filter(**{slug_field: candidate})
        if exclude_pk is not None:
            exists_qs = exists_qs.exclude(pk=exclude_pk)
        if not exists_qs.exists():
            return candidate
        candidate = f'{slug}-{counter}'
        counter += 1


def _unique_slug_within_category(base: str, categoria_id, exclude_pk=None) -> str:
    """Generate a slug unique within its parent category."""
    slug = slugify(base)[:300] or 'sin-nombre'
    candidate = slug
    counter = 1
    while True:
        exists_qs = Subcategoria.objects.filter(categoria_id=categoria_id, slug=candidate)
        if exclude_pk is not None:
            exists_qs = exists_qs.exclude(pk=exclude_pk)
        if not exists_qs.exists():
            return candidate
        candidate = f'{slug}-{counter}'
        counter += 1


def _unique_slug_within_subcategoria_marca(base: str, subcategoria_id, exclude_pk=None) -> str:
    """Generate a slug unique within its parent subcategory (for Marca)."""
    slug = slugify(base)[:300] or 'sin-nombre'
    candidate = slug
    counter = 1
    while True:
        exists_qs = Marca.objects.filter(subcategoria_id=subcategoria_id, slug=candidate)
        if exclude_pk is not None:
            exists_qs = exists_qs.exclude(pk=exclude_pk)
        if not exists_qs.exists():
            return candidate
        candidate = f'{slug}-{counter}'
        counter += 1


def _unique_slug_within_marca(base: str, marca_id, exclude_pk=None) -> str:
    """Generate a slug unique within its parent brand (for Modelo with marca)."""
    slug = slugify(base)[:300] or 'sin-nombre'
    candidate = slug
    counter = 1
    while True:
        exists_qs = Modelo.objects.filter(marca_id=marca_id, slug=candidate)
        if exclude_pk is not None:
            exists_qs = exists_qs.exclude(pk=exclude_pk)
        if not exists_qs.exists():
            return candidate
        candidate = f'{slug}-{counter}'
        counter += 1


def _unique_slug_sin_marca(base: str, subcategoria_id, exclude_pk=None) -> str:
    """Generate a slug unique within a subcategory for brandless Modelos."""
    slug = slugify(base)[:300] or 'sin-nombre'
    candidate = slug
    counter = 1
    while True:
        exists_qs = Modelo.objects.filter(
            subcategoria_id=subcategoria_id, marca__isnull=True, slug=candidate
        )
        if exclude_pk is not None:
            exists_qs = exists_qs.exclude(pk=exclude_pk)
        if not exists_qs.exists():
            return candidate
        candidate = f'{slug}-{counter}'
        counter += 1


# ─────────────────────────────────────────────────────────────────────────────
# Global taxonomy — no tenant FK
# ─────────────────────────────────────────────────────────────────────────────

class Categoria(models.Model):
    """
    Global category — shared across all tenants.
    `codigo` preserves the original CSV identifier (e.g. 'b3mp').
    `slug` is the human-readable URL slug derived from `nombre`.
    """
    codigo      = models.CharField(max_length=100, unique=True, db_index=True)
    nombre      = models.CharField(max_length=200)
    slug        = models.SlugField(max_length=220, unique=True)
    descripcion = models.TextField(blank=True)
    icono       = models.CharField(max_length=100, blank=True)   # Lucide icon name
    orden       = models.IntegerField(default=0)
    activa      = models.BooleanField(default=True)

    class Meta:
        db_table = 'directorio_categoria'
        ordering = ['orden', 'nombre']
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(self.nombre, Categoria, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre


class Subcategoria(models.Model):
    """
    Global subcategory — scoped to a Categoria, no tenant FK.
    Slug is unique within its parent category.
    """
    categoria   = models.ForeignKey(
        Categoria,
        on_delete=models.CASCADE,
        related_name='subcategorias',
    )
    nombre      = models.CharField(max_length=300)
    slug        = models.SlugField(max_length=320)
    descripcion = models.TextField(blank=True)
    keywords    = models.JSONField(default=list, blank=True)
    orden       = models.IntegerField(default=0)

    class Meta:
        db_table = 'directorio_subcategoria'
        ordering = ['orden', 'nombre']
        constraints = [
            models.UniqueConstraint(
                fields=['categoria', 'slug'],
                name='uniq_subcategoria_cat_slug',
            )
        ]
        indexes = [
            models.Index(fields=['nombre'], name='subcategoria_nombre_idx'),
        ]
        verbose_name = 'Subcategoría'
        verbose_name_plural = 'Subcategorías'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug_within_category(
                self.nombre, self.categoria_id, exclude_pk=self.pk
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.categoria.nombre} / {self.nombre}'


class Marca(models.Model):
    """
    A product brand, scoped to a Subcategoria.
    Global (no tenant FK) — proposed by tenants, approved by staff.
    Slug is unique within its parent subcategory.
    """

    class Status(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente de revisión'
        APROBADA  = 'aprobada',  'Aprobada'
        RECHAZADA = 'rechazada', 'Rechazada'

    subcategoria   = models.ForeignKey(
        Subcategoria,
        on_delete=models.CASCADE,
        related_name='marcas',
    )
    nombre         = models.CharField(max_length=255)
    slug           = models.SlugField(max_length=270)
    descripcion    = models.TextField(blank=True)
    activa         = models.BooleanField(default=False)   # True only once approved
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDIENTE)
    motivo_rechazo = models.TextField(blank=True)
    creada_por     = models.ForeignKey(
        'EmpresaPerfil',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='marcas_propuestas',
    )
    orden          = models.IntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'directorio_marca'
        ordering = ['orden', 'nombre']
        constraints = [
            models.UniqueConstraint(
                fields=['subcategoria', 'slug'],
                name='uniq_marca_subcategoria_slug',
            )
        ]
        verbose_name = 'Marca'
        verbose_name_plural = 'Marcas'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug_within_subcategoria_marca(
                self.nombre, self.subcategoria_id, exclude_pk=self.pk
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.subcategoria.nombre} / {self.nombre}'


class Modelo(models.Model):
    """
    A specific product model, scoped to a Subcategoria + Marca.
    Global (no tenant FK) — proposed by tenants, approved by staff.
    subcategoria is denormalized from marca.subcategoria for efficient queries.
    Slug is unique within its parent brand.
    """

    class Status(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente de revisión'
        APROBADO  = 'aprobado',  'Aprobado'
        RECHAZADO = 'rechazado', 'Rechazado'

    subcategoria   = models.ForeignKey(
        Subcategoria,
        on_delete=models.CASCADE,
        related_name='modelos',
    )
    marca          = models.ForeignKey(
        Marca,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='modelos',
    )
    nombre         = models.CharField(max_length=255)
    slug           = models.SlugField(max_length=270)
    descripcion    = models.TextField(blank=True)
    activo         = models.BooleanField(default=False)   # True only once approved
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDIENTE)
    motivo_rechazo = models.TextField(blank=True)
    creada_por     = models.ForeignKey(
        'EmpresaPerfil',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='modelos_propuestos',
    )
    orden          = models.IntegerField(default=0)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'directorio_modelo'
        ordering = ['orden', 'nombre']
        constraints = [
            # When brand is set: slug unique within brand
            models.UniqueConstraint(
                fields=['marca', 'slug'],
                condition=models.Q(marca__isnull=False),
                name='uniq_modelo_marca_slug',
            ),
            # When no brand: slug unique within subcategory
            models.UniqueConstraint(
                fields=['subcategoria', 'slug'],
                condition=models.Q(marca__isnull=True),
                name='uniq_modelo_subcategoria_slug_sin_marca',
            ),
        ]
        indexes = [
            models.Index(fields=['subcategoria', 'activo'], name='modelo_subcat_activo_idx'),
        ]
        verbose_name = 'Modelo'
        verbose_name_plural = 'Modelos'

    def save(self, *args, **kwargs):
        if not self.slug:
            if self.marca_id:
                self.slug = _unique_slug_within_marca(
                    self.nombre, self.marca_id, exclude_pk=self.pk
                )
            else:
                self.slug = _unique_slug_sin_marca(
                    self.nombre, self.subcategoria_id, exclude_pk=self.pk
                )
        super().save(*args, **kwargs)

    def __str__(self):
        marca_str = self.marca.nombre if self.marca_id else 'Sin marca'
        return f'{marca_str} / {self.nombre}'


# ─────────────────────────────────────────────────────────────────────────────
# Tenant-scoped entities
# ─────────────────────────────────────────────────────────────────────────────

def _calcular_score(empresa: 'EmpresaPerfil') -> int:
    """Calculate profile completeness score (0–100)."""
    score = 0
    if empresa.nombre_comercial:
        score += 10
    if empresa.descripcion and len(empresa.descripcion) > 100:
        score += 15
    if empresa.logo:
        score += 15
    if empresa.portada:
        score += 10
    if empresa.telefono:
        score += 10
    if empresa.email_contacto:
        score += 10
    if empresa.sitio_web:
        score += 5
    if empresa.ciudad and empresa.estado:
        score += 10
    # M2M requires the instance to be saved first
    try:
        if empresa.pk and empresa.categorias.exists():
            score += 10
        if empresa.pk and empresa.subcategorias.exists():
            score += 5
    except Exception:
        pass
    return score


class EmpresaPerfil(models.Model):
    """
    A company's profile in the directory.
    One EmpresaPerfil per Tenant (OneToOne).
    """

    class Plan(models.TextChoices):
        FREE       = 'free',       'Gratuito'
        STARTER    = 'starter',    'Starter $299/mes'
        PRO        = 'pro',        'Pro $799/mes'
        ENTERPRISE = 'enterprise', 'Enterprise'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Borrador'
        PUBLISHED = 'published', 'Publicado'
        ARCHIVED  = 'archived',  'Archivado'

    # Identity
    tenant           = models.OneToOneField(
        'core.Tenant',
        on_delete=models.CASCADE,
        related_name='empresa_perfil',
    )
    nombre_comercial = models.CharField(max_length=255)
    slug             = models.SlugField(max_length=270, unique=True)

    # Description & media
    descripcion      = models.TextField(blank=True)
    logo             = models.ImageField(upload_to='logos/', null=True, blank=True)
    portada          = models.ImageField(upload_to='portadas/', null=True, blank=True)

    # Location
    ciudad           = models.CharField(max_length=100, blank=True)
    estado           = models.CharField(max_length=100, blank=True)
    pais             = models.CharField(max_length=100, default='México')

    # Contact
    telefono         = models.CharField(max_length=30, blank=True)
    email_contacto   = models.EmailField(blank=True)
    sitio_web        = models.URLField(blank=True)
    whatsapp         = models.CharField(max_length=30, blank=True)

    # Plan & status
    plan             = models.CharField(max_length=20, choices=Plan.choices, default=Plan.FREE)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # Categories (global M2M)
    categorias          = models.ManyToManyField(Categoria, blank=True, related_name='empresas')
    categoria_principal = models.ForeignKey(
        Categoria,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='empresas_principal',
    )
    subcategorias       = models.ManyToManyField(Subcategoria, blank=True, related_name='empresas')

    # Quality signals
    score_completitud   = models.IntegerField(default=0)
    verified            = models.BooleanField(default=False)

    # Verification via Constancia de Situación Fiscal (CSF)
    class CsfStatus(models.TextChoices):
        SIN_ENVIAR = 'sin_enviar', 'Sin enviar'
        PENDIENTE  = 'pendiente',  'En revisión'
        APROBADO   = 'aprobado',   'Aprobado'
        RECHAZADO  = 'rechazado',  'Rechazado'

    csf_documento = models.FileField(upload_to='csf/', null=True, blank=True)
    csf_status    = models.CharField(
        max_length=20,
        choices=CsfStatus.choices,
        default=CsfStatus.SIN_ENVIAR,
    )

    # Timestamps
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)
    published_at        = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'directorio_empresa_perfil'
        verbose_name = 'Empresa / Perfil'
        verbose_name_plural = 'Empresas / Perfiles'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(self.nombre_comercial, EmpresaPerfil, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre_comercial


class SolicitudCotizacion(models.Model):
    """
    A buyer's lead / quote request directed at one company.
    Free-plan companies see the count but not the content (oculto_free=True).
    """

    class Status(models.TextChoices):
        NUEVA      = 'nueva',      'Nueva'
        VISTA      = 'vista',      'Vista'
        RESPONDIDA = 'respondida', 'Respondida'
        ARCHIVADA  = 'archivada',  'Archivada'

    empresa            = models.ForeignKey(
        EmpresaPerfil,
        on_delete=models.CASCADE,
        related_name='solicitudes',
    )
    nombre_contacto    = models.CharField(max_length=200)
    email_contacto     = models.EmailField()
    telefono           = models.CharField(max_length=30, blank=True)
    empresa_compradora = models.CharField(max_length=255, blank=True)
    mensaje            = models.TextField()
    status             = models.CharField(max_length=20, choices=Status.choices, default=Status.NUEVA)
    oculto_free        = models.BooleanField(default=False)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'directorio_solicitud_cotizacion'
        ordering = ['-created_at']
        verbose_name = 'Solicitud de Cotización'
        verbose_name_plural = 'Solicitudes de Cotización'

    def __str__(self):
        return f'{self.nombre_contacto} → {self.empresa.nombre_comercial}'


# ─────────────────────────────────────────────────────────────────────────────
# Signals
# ─────────────────────────────────────────────────────────────────────────────

from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver


@receiver(post_save, sender=EmpresaPerfil)
def _actualizar_score_post_save(sender, instance, **kwargs):
    """Recalculate score_completitud after every save (avoids recursion via update())."""
    new_score = _calcular_score(instance)
    if new_score != instance.score_completitud:
        EmpresaPerfil.objects.filter(pk=instance.pk).update(score_completitud=new_score)


@receiver(m2m_changed, sender=EmpresaPerfil.categorias.through)
@receiver(m2m_changed, sender=EmpresaPerfil.subcategorias.through)
def _actualizar_score_m2m(sender, instance, action, **kwargs):
    if action in ('post_add', 'post_remove', 'post_clear'):
        new_score = _calcular_score(instance)
        EmpresaPerfil.objects.filter(pk=instance.pk).update(score_completitud=new_score)


# ─────────────────────────────────────────────────────────────────────────────
# Invite / Claim system
# ─────────────────────────────────────────────────────────────────────────────

class InvitacionEmpresa(models.Model):
    """
    One-time link to claim an existing EmpresaPerfil.

    Generated via:
        python manage.py generar_invitacion --empresa-slug=acero-mx --email=owner@company.com

    The claim page (/reclamar/<token>) lets a user register or log in
    and then be linked as owner of the empresa's tenant.
    """
    empresa    = models.ForeignKey(
        EmpresaPerfil,
        on_delete=models.CASCADE,
        related_name='invitaciones',
    )
    token      = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    email      = models.EmailField(blank=True)   # if set, only this email can claim
    expires_at = models.DateTimeField()
    used_at    = models.DateTimeField(null=True, blank=True)
    used_by    = models.ForeignKey(
        'users.CustomUser',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='invitaciones_usadas',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Invitación de empresa'
        verbose_name_plural = 'Invitaciones de empresa'

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f'Invitación → {self.empresa.nombre_comercial} ({self.token})'


class Producto(models.Model):
    """
    A product or service offered by a company.
    Multiple products per EmpresaPerfil.
    """
    empresa     = models.ForeignKey(
        EmpresaPerfil,
        on_delete=models.CASCADE,
        related_name='productos',
    )
    nombre      = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True)
    precio      = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    unidad      = models.CharField(max_length=50, blank=True)   # 'kg', 'ton', 'pieza', 'servicio'
    imagen      = models.ImageField(upload_to='productos/', null=True, blank=True)
    activo      = models.BooleanField(default=True)
    orden       = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'directorio_producto'
        ordering = ['orden', 'nombre']
        verbose_name = 'Producto / Servicio'
        verbose_name_plural = 'Productos / Servicios'

    def __str__(self):
        return f'{self.empresa.nombre_comercial} / {self.nombre}'


class EmpresaModelo(models.Model):
    """
    Per-tenant record linking an EmpresaPerfil to a product entry.
    At minimum a Subcategoria is required. Marca and Modelo are optional:
      - subcategoria only       → sells generic products in that line
      - subcategoria + marca    → sells a brand but no specific model
      - subcategoria + modelo   → sells a specific model (marca derived from modelo)
    `existencia` indicates whether the item is currently in stock.
    """
    empresa      = models.ForeignKey(
        EmpresaPerfil,
        on_delete=models.CASCADE,
        related_name='empresa_modelos',
    )
    subcategoria = models.ForeignKey(
        Subcategoria,
        on_delete=models.CASCADE,
        related_name='empresa_modelos',
    )
    marca        = models.ForeignKey(
        Marca,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='empresa_modelos',
    )
    modelo       = models.ForeignKey(
        Modelo,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='empresa_modelos',
    )
    existencia   = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'directorio_empresa_modelo'
        ordering = ['subcategoria__nombre', 'marca__nombre', 'modelo__nombre']
        constraints = [
            # modelo set + no brand override: one brandless entry per (empresa, modelo)
            models.UniqueConstraint(
                fields=['empresa', 'modelo'],
                condition=models.Q(modelo__isnull=False, marca__isnull=True),
                name='uniq_empresa_modelo_sin_marca',
            ),
            # modelo set + brand: one entry per (empresa, modelo, marca)
            models.UniqueConstraint(
                fields=['empresa', 'modelo', 'marca'],
                condition=models.Q(modelo__isnull=False, marca__isnull=False),
                name='uniq_empresa_modelo_con_marca',
            ),
            # One entry per (empresa, marca) when marca set but no modelo
            models.UniqueConstraint(
                fields=['empresa', 'marca'],
                condition=models.Q(modelo__isnull=True, marca__isnull=False),
                name='uniq_empresa_marca_sin_modelo',
            ),
            # One entry per (empresa, subcategoria) when only subcategoria
            models.UniqueConstraint(
                fields=['empresa', 'subcategoria'],
                condition=models.Q(modelo__isnull=True, marca__isnull=True),
                name='uniq_empresa_subcategoria_solo',
            ),
        ]
        verbose_name = 'Empresa → Catálogo'
        verbose_name_plural = 'Empresas → Catálogo'

    def __str__(self):
        modelo_str = self.modelo.nombre if self.modelo_id else 'Sin modelo'
        marca_str  = self.marca.nombre  if self.marca_id  else 'Sin marca'
        estado = 'en existencia' if self.existencia else 'sin existencia'
        return f'{self.empresa.nombre_comercial} / {self.subcategoria.nombre} / {marca_str} / {modelo_str} ({estado})'


class NotificacionStaff(models.Model):
    """
    Global staff inbox notification.
    Created automatically when a tenant submits a Marca or Modelo for approval.
    All staff roles share the same inbox (no per-user routing).
    """

    class Tipo(models.TextChoices):
        MARCA_NUEVA  = 'marca_nueva',  'Nueva marca propuesta'
        MODELO_NUEVO = 'modelo_nuevo', 'Nuevo modelo propuesto'

    tipo          = models.CharField(max_length=30, choices=Tipo.choices)
    referencia_id = models.IntegerField()           # pk of Marca or Modelo
    mensaje       = models.CharField(max_length=400)
    leida         = models.BooleanField(default=False)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'directorio_notificacion_staff'
        ordering = ['-created_at']
        verbose_name = 'Notificación Staff'
        verbose_name_plural = 'Notificaciones Staff'

    def __str__(self):
        estado = 'leída' if self.leida else 'no leída'
        return f'[{self.tipo}] ref={self.referencia_id} ({estado})'


# ─────────────────────────────────────────────────────────────────────────────
# Blog
# ─────────────────────────────────────────────────────────────────────────────

class BlogPost(models.Model):
    """
    A blog article written by staff.
    target='industry' → published on /website/blog (public, industry news).
    target='business' → published on /frontend/recursos (authenticated, sales/partnerships).
    content is stored as Markdown.
    """

    class Target(models.TextChoices):
        INDUSTRY = 'industry', 'Industria (sitio público)'
        BUSINESS = 'business', 'Negocios (panel empresa)'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Borrador'
        PUBLISHED = 'published', 'Publicado'
        ARCHIVED  = 'archived',  'Archivado'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    titulo         = models.CharField(max_length=200)
    slug           = models.SlugField(max_length=220, unique=True)
    extracto       = models.CharField(max_length=400, blank=True)
    contenido      = models.TextField()
    imagen_portada = models.URLField(blank=True)
    target         = models.CharField(max_length=20, choices=Target.choices, default=Target.INDUSTRY)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    autor          = models.ForeignKey(
        'users.CustomUser',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='blog_posts',
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    published_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'directorio_blog_post'
        ordering = ['-published_at', '-created_at']
        verbose_name = 'Blog Post'
        verbose_name_plural = 'Blog Posts'

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = _unique_slug(self.titulo, BlogPost, exclude_pk=self.pk)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'[{self.target}] {self.titulo}'


# ─────────────────────────────────────────────────────────────────────────────
# Foro (Forum)
# ─────────────────────────────────────────────────────────────────────────────

class ForoPost(models.Model):
    MOD_PENDING  = 'pending'
    MOD_APPROVED = 'approved'
    MOD_REJECTED = 'rejected'
    MOD_CHOICES  = [
        (MOD_PENDING,  'Pendiente'),
        (MOD_APPROVED, 'Aprobado'),
        (MOD_REJECTED, 'Rechazado'),
    ]

    subcategorias     = models.ManyToManyField(
        'Subcategoria', related_name='foro_posts', blank=False
    )
    titulo            = models.CharField(max_length=300)
    contenido         = models.TextField()
    autor_nombre      = models.CharField(max_length=150)
    autor_email       = models.EmailField(blank=True)          # never exposed publicly
    empresa           = models.ForeignKey(
        'EmpresaPerfil', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='foro_posts'
    )
    ip_origen         = models.GenericIPAddressField(null=True, blank=True)
    moderacion_status = models.CharField(
        max_length=20, choices=MOD_CHOICES, default=MOD_APPROVED
    )
    deleted           = models.BooleanField(default=False)
    deleted_by        = models.ForeignKey(
        'users.CustomUser', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='foro_posts_deleted'
    )
    deleted_at        = models.DateTimeField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table    = 'directorio_foro_post'
        ordering    = ['-created_at']
        indexes     = [models.Index(fields=['-created_at'], name='directorio__created_e6eebb_idx')]
        verbose_name        = 'Foro Post'
        verbose_name_plural = 'Foro Posts'

    def __str__(self):
        return self.titulo


class ForoRespuesta(models.Model):
    post         = models.ForeignKey(
        ForoPost, on_delete=models.CASCADE, related_name='respuestas'
    )
    contenido    = models.TextField()
    autor_nombre = models.CharField(max_length=150)
    autor_email  = models.EmailField(blank=True)
    empresa      = models.ForeignKey(
        'EmpresaPerfil', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='foro_respuestas'
    )
    ip_origen    = models.GenericIPAddressField(null=True, blank=True)
    deleted      = models.BooleanField(default=False)
    deleted_by   = models.ForeignKey(
        'users.CustomUser', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='foro_respuestas_deleted'
    )
    deleted_at   = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table    = 'directorio_foro_respuesta'
        ordering    = ['created_at']
        verbose_name        = 'Foro Respuesta'
        verbose_name_plural = 'Foro Respuestas'

    def __str__(self):
        return f'Respuesta de {self.autor_nombre} en "{self.post.titulo}"'


class NotificacionForo(models.Model):
    """Stub for future customer notification when their subcategoria is mentioned."""
    empresa    = models.ForeignKey(
        'EmpresaPerfil', on_delete=models.CASCADE, related_name='notificaciones_foro'
    )
    post       = models.ForeignKey(ForoPost, on_delete=models.CASCADE)
    leida      = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table        = 'directorio_notificacion_foro'
        unique_together = [('empresa', 'post')]
        verbose_name        = 'Notificacion Foro'
        verbose_name_plural = 'Notificaciones Foro'

    def __str__(self):
        return f'Notif foro → {self.empresa} post#{self.post_id}'
