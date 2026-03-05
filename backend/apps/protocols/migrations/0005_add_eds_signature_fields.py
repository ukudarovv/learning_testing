# Migration for EDS (ЭЦП) signature fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('protocols', '0004_add_protocol_file_upload'),
    ]

    operations = [
        migrations.AddField(
            model_name='protocolsignature',
            name='sign_type',
            field=models.CharField(
                choices=[('otp', 'OTP (SMS)'), ('eds', 'EDS (ЭЦП)')],
                default='otp',
                max_length=10
            ),
        ),
        migrations.AddField(
            model_name='protocolsignature',
            name='eds_signature',
            field=models.TextField(blank=True, help_text='Base64 CMS detached signature from NCALayer'),
        ),
        migrations.AddField(
            model_name='protocolsignature',
            name='eds_certificate_info',
            field=models.JSONField(blank=True, help_text='IIN, full_name from certificate for audit', null=True),
        ),
    ]
