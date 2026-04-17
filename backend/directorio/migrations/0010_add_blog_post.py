import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('directorio', '0009_empresa_modelo_por_marca'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BlogPost',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('titulo', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=220, unique=True)),
                ('extracto', models.CharField(blank=True, max_length=400)),
                ('contenido', models.TextField()),
                ('imagen_portada', models.URLField(blank=True)),
                ('target', models.CharField(
                    choices=[('industry', 'Industria (sitio público)'), ('business', 'Negocios (panel empresa)')],
                    default='industry',
                    max_length=20,
                )),
                ('status', models.CharField(
                    choices=[('draft', 'Borrador'), ('published', 'Publicado'), ('archived', 'Archivado')],
                    default='draft',
                    max_length=20,
                )),
                ('autor', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='blog_posts',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={
                'verbose_name': 'Blog Post',
                'verbose_name_plural': 'Blog Posts',
                'db_table': 'directorio_blog_post',
                'ordering': ['-published_at', '-created_at'],
            },
        ),
    ]
