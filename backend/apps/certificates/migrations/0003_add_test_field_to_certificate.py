# Generated migration for making course optional and adding test field to Certificate

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0007_add_category_field'),
        ('certificates', '0002_certificatetemplate_certificate_file_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='certificate',
            name='course',
            field=models.ForeignKey(blank=True, help_text='Course for course completion certificates', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='certificates', to='courses.course'),
        ),
        migrations.AddField(
            model_name='certificate',
            name='test',
            field=models.ForeignKey(blank=True, help_text='Test for standalone test completion certificates', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='certificates', to='tests.test', db_constraint=False),
        ),
    ]
