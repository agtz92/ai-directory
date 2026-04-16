"""
Split uniq_empresa_modelo_set into two partial constraints so that the
same Modelo can be linked to an empresa multiple times under different brands.

Old: unique(empresa, modelo) WHERE modelo IS NOT NULL
New:
  uniq_empresa_modelo_sin_marca — unique(empresa, modelo) WHERE modelo IS NOT NULL AND marca IS NULL
  uniq_empresa_modelo_con_marca — unique(empresa, modelo, marca) WHERE modelo IS NOT NULL AND marca IS NOT NULL
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('directorio', '0008_nullable_marca_modelo'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='empresamodelo',
            name='uniq_empresa_modelo_set',
        ),
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                fields=['empresa', 'modelo'],
                condition=models.Q(modelo__isnull=False, marca__isnull=True),
                name='uniq_empresa_modelo_sin_marca',
            ),
        ),
        migrations.AddConstraint(
            model_name='empresamodelo',
            constraint=models.UniqueConstraint(
                fields=['empresa', 'modelo', 'marca'],
                condition=models.Q(modelo__isnull=False, marca__isnull=False),
                name='uniq_empresa_modelo_con_marca',
            ),
        ),
    ]
