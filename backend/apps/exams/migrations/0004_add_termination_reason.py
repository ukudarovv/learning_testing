# Generated manually for test termination reason feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exams', '0003_add_video_recording'),
    ]

    operations = [
        migrations.AddField(
            model_name='testattempt',
            name='termination_reason',
            field=models.TextField(blank=True, help_text='Reason for early test termination', null=True),
        ),
    ]
