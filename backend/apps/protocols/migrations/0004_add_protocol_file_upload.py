# Generated migration for protocol file upload

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('protocols', '0003_make_course_optional_add_test'),
    ]

    operations = [
        migrations.AddField(
            model_name='protocol',
            name='file',
            field=models.FileField(blank=True, help_text='Uploaded protocol file in any format', null=True, upload_to='protocols/files/'),
        ),
        migrations.AddField(
            model_name='protocol',
            name='uploaded_by',
            field=models.ForeignKey(blank=True, help_text='Admin who uploaded the file', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='uploaded_protocols', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='protocol',
            name='uploaded_at',
            field=models.DateTimeField(blank=True, help_text='When the file was uploaded', null=True),
        ),
    ]
