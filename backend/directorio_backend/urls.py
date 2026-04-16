from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from django.views.decorators.csrf import csrf_exempt

from strawberry.django.views import GraphQLView

from directorio_backend.schema import schema
from directorio.public_schema import public_schema
from directorio.staff_schema import staff_schema


urlpatterns = [
    path('admin/', admin.site.urls),

    # Authenticated CMS schema (requires Authorization: Bearer <jwt>)
    path('graphql/', csrf_exempt(GraphQLView.as_view(schema=schema))),

    # Public directory schema (no auth — all published companies)
    path('public/graphql/', csrf_exempt(GraphQLView.as_view(schema=public_schema))),

    # Staff support panel (requires JWT + staff_role != '')
    path('staff/graphql/', csrf_exempt(GraphQLView.as_view(schema=staff_schema))),
]

# Serve local media files in development
if settings.DEBUG:
    urlpatterns += static(
        getattr(settings, 'MEDIA_URL', '/media/'),
        document_root=getattr(settings, 'MEDIA_ROOT', ''),
    )
