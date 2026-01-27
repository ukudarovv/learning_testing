# Generated migration to change is_standalone default value and update logic

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tests', '0011_add_test_enrollment_request'),
    ]

    operations = [
        migrations.AlterField(
            model_name='test',
            name='is_standalone',
            field=models.BooleanField(default=True, help_text='If True, test can be used in courses. If False, test is standalone and will be displayed on Training Programs page'),
        ),
    ]
