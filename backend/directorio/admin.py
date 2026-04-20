from django.contrib import admin

from .models import ForoPost, ForoRespuesta, NotificacionForo


@admin.register(ForoPost)
class ForoPostAdmin(admin.ModelAdmin):
    list_display    = ['titulo', 'autor_nombre', 'moderacion_status', 'deleted', 'created_at']
    list_filter     = ['moderacion_status', 'deleted']
    search_fields   = ['titulo', 'contenido', 'autor_nombre', 'autor_email']
    readonly_fields = ['ip_origen', 'created_at', 'updated_at', 'deleted_by', 'deleted_at']


@admin.register(ForoRespuesta)
class ForoRespuestaAdmin(admin.ModelAdmin):
    list_display    = ['post', 'autor_nombre', 'deleted', 'created_at']
    list_filter     = ['deleted']
    search_fields   = ['contenido', 'autor_nombre', 'autor_email']
    readonly_fields = ['ip_origen', 'created_at', 'deleted_by', 'deleted_at']


@admin.register(NotificacionForo)
class NotificacionForoAdmin(admin.ModelAdmin):
    list_display = ['empresa', 'post', 'leida', 'created_at']
    list_filter  = ['leida']
