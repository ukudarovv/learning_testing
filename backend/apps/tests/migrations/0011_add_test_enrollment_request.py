# Generated migration for TestEnrollmentRequest model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tests', '0010_test_show_results_test_shuffle_questions'),
    ]

    operations = [
        migrations.CreateModel(
            name='TestEnrollmentRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('admin_response', models.TextField(blank=True, help_text='Admin response or rejection reason')),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('processed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='processed_test_enrollment_requests', to=settings.AUTH_USER_MODEL)),
                ('test', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='enrollment_requests', to='tests.test')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='test_enrollment_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'test_enrollment_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='testenrollmentrequest',
            index=models.Index(fields=['user', 'test', 'status'], name='test_enroll_user_id_abc123_idx'),
        ),
        migrations.AddIndex(
            model_name='testenrollmentrequest',
            index=models.Index(fields=['status', '-created_at'], name='test_enroll_status_abc123_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='testenrollmentrequest',
            unique_together={('user', 'test')},
        ),
    ]
