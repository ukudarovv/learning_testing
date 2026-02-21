# Generated manually
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_add_site_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='siteconfig',
            name='require_course_enrollment_request',
            field=models.BooleanField(default=True, verbose_name='Требовать запрос для курсов'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='require_test_enrollment_request',
            field=models.BooleanField(default=True, verbose_name='Требовать запрос для тестов'),
        ),
    ]
