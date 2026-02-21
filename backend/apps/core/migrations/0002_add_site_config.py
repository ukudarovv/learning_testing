# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SiteConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('require_sms_on_registration', models.BooleanField(default=True, verbose_name='Требовать SMS при регистрации')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Дата обновления')),
            ],
            options={
                'verbose_name': 'Настройки сайта',
                'verbose_name_plural': 'Настройки сайта',
                'db_table': 'site_config',
            },
        ),
    ]
