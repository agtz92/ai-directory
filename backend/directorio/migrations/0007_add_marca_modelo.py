import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('directorio', '0006_add_producto_model'),
    ]

    operations = [
        # ── Marca ─────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Marca',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=270)),
                ('descripcion', models.TextField(blank=True)),
                ('activa', models.BooleanField(default=False)),
                ('status', models.CharField(
                    choices=[('pendiente', 'Pendiente de revisión'), ('aprobada', 'Aprobada'), ('rechazada', 'Rechazada')],
                    default='pendiente',
                    max_length=20,
                )),
                ('motivo_rechazo', models.TextField(blank=True)),
                ('orden', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('subcategoria', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='marcas',
                    to='directorio.subcategoria',
                )),
                ('creada_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='marcas_propuestas',
                    to='directorio.empresaperfil',
                )),
            ],
            options={
                'verbose_name': 'Marca',
                'verbose_name_plural': 'Marcas',
                'db_table': 'directorio_marca',
                'ordering': ['orden', 'nombre'],
            },
        ),
        migrations.AddConstraint(
            model_name='marca',
            constraint=models.UniqueConstraint(
                fields=['subcategoria', 'slug'],
                name='uniq_marca_subcategoria_slug',
            ),
        ),

        # ── Modelo ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='Modelo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=270)),
                ('descripcion', models.TextField(blank=True)),
                ('activo', models.BooleanField(default=False)),
                ('status', models.CharField(
                    choices=[('pendiente', 'Pendiente de revisión'), ('aprobado', 'Aprobado'), ('rechazado', 'Rechazado')],
                    default='pendiente',
                    max_length=20,
                )),
                ('motivo_rechazo', models.TextField(blank=True)),
                ('orden', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('subcategoria', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='modelos',
                    to='directorio.subcategoria',
                )),
                ('marca', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='modelos',
                    to='directorio.marca',
                )),
                ('creada_por', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='modelos_propuestos',
                    to='directorio.empresaperfil',
                )),
            ],
            options={
                'verbose_name': 'Modelo',
                'verbose_name_plural': 'Modelos',
                'db_table': 'directorio_modelo',
                'ordering': ['orden', 'nombre'],
            },
        ),
        migrations.AddConstraint(
            model_name='modelo',
            constraint=models.UniqueConstraint(
                fields=['marca', 'slug'],
                name='uniq_modelo_marca_slug',
            ),
        ),
        migrations.AddIndex(
            model_name='modelo',
            index=models.Index(
                fields=['subcategoria', 'activo'],
                name='modelo_subcat_activo_idx',
            ),
        ),

        # ── EmpresaModelo ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name='EmpresaModelo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('existencia', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='empresa_modelos',
                    to='directorio.empresaperfil',
                )),
                ('modelo', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='empresa_modelos',
                    to='directorio.modelo',
                )),
            ],
            options={
                'verbose_name': 'Empresa → Modelo',
                'verbose_name_plural': 'Empresas → Modelos',
                'db_table': 'directorio_empresa_modelo',
                'ordering': ['modelo__nombre'],
            },
        ),
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                fields=['empresa', 'modelo'],
                name='uniq_empresa_modelo',
            ),
        ),

        # ── NotificacionStaff ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='NotificacionStaff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(
                    choices=[('marca_nueva', 'Nueva marca propuesta'), ('modelo_nuevo', 'Nuevo modelo propuesto')],
                    max_length=30,
                )),
                ('referencia_id', models.IntegerField()),
                ('mensaje', models.CharField(max_length=400)),
                ('leida', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Notificación Staff',
                'verbose_name_plural': 'Notificaciones Staff',
                'db_table': 'directorio_notificacion_staff',
                'ordering': ['-created_at'],
            },
        ),
    ]
