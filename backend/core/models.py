from django.db import models


class Tenant(models.Model):
    class Status(models.TextChoices):
        TRIAL     = 'trial',     'Trial'
        ACTIVE    = 'active',    'Activo'
        SUSPENDED = 'suspended', 'Suspendido'
        CANCELLED = 'cancelled', 'Cancelado'

    name            = models.CharField(max_length=255)
    slug            = models.SlugField(unique=True)
    color           = models.CharField(max_length=7, default='#334155')
    template        = models.CharField(max_length=50, default='modern')
    template_config = models.JSONField(default=dict, blank=True)
    modules         = models.JSONField(default=list, blank=True)
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.TRIAL)
    created_at      = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Workspace'
        verbose_name_plural = 'Workspaces'


class TenantMembership(models.Model):
    class Role(models.TextChoices):
        OWNER  = 'owner',  'Propietario'
        ADMIN  = 'admin',  'Administrador'
        EDITOR = 'editor', 'Editor'
        VIEWER = 'viewer', 'Visualizador'

    tenant    = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='memberships')
    user      = models.ForeignKey('users.CustomUser', on_delete=models.CASCADE, related_name='memberships')
    role      = models.CharField(max_length=20, choices=Role.choices, default=Role.VIEWER)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('tenant', 'user')
        verbose_name = 'Membresía'
        verbose_name_plural = 'Membresías'

    def __str__(self):
        return f'{self.user} → {self.tenant} ({self.role})'
