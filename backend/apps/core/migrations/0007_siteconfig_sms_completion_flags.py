# Generated manually for SMS completion toggles

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_remove_allow_eds_without_cert_iin'),
    ]

    operations = [
        migrations.AddField(
            model_name='siteconfig',
            name='require_sms_for_course_completion',
            field=models.BooleanField(default=True, verbose_name='Требовать SMS для завершения курса'),
        ),
        migrations.AddField(
            model_name='siteconfig',
            name='require_sms_for_test_completion',
            field=models.BooleanField(default=True, verbose_name='Требовать SMS для завершения отдельного теста'),
        ),
    ]
