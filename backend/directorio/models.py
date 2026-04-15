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
