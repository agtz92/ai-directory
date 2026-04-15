from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    display_name = models.CharField(max_length=200, blank=True)
    role         = models.CharField(max_length=20, default='owner')
    supabase_id  = models.CharField(max_length=100, unique=True, null=True, blank=True)
    active_tenant = models.ForeignKey(
        'core.Tenant',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='active_users',
    )

    def __str__(self):
        return self.email or self.username

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
