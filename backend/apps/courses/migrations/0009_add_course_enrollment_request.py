# Generated migration for CourseEnrollmentRequest model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('courses', '0008_lesson_ppt_url_alter_lesson_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='CourseEnrollmentRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('admin_response', models.TextField(blank=True, help_text='Admin response or rejection reason')),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='enrollment_requests', to='courses.course')),
                ('processed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='processed_course_enrollment_requests', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='course_enrollment_requests', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'course_enrollment_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='courseenrollmentrequest',
            index=models.Index(fields=['user', 'course', 'status'], name='course_enro_user_id_abc123_idx'),
        ),
        migrations.AddIndex(
            model_name='courseenrollmentrequest',
            index=models.Index(fields=['status', '-created_at'], name='course_enro_status_abc123_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='courseenrollmentrequest',
            unique_together={('user', 'course')},
        ),
    ]
