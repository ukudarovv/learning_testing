# Generated migration for TestAssignment model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tests', '0012_change_is_standalone_default'),
    ]

    operations = [
        migrations.CreateModel(
            name='TestAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('status', models.CharField(choices=[('assigned', 'Assigned'), ('completed', 'Completed'), ('failed', 'Failed'), ('revoked', 'Revoked')], default='assigned', max_length=20)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('assigned_by', models.ForeignKey(blank=True, help_text='Admin who assigned the test', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_tests', to=settings.AUTH_USER_MODEL)),
                ('test', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='tests.test')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='test_assignments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'test_assignments',
                'ordering': ['-assigned_at'],
            },
        ),
        migrations.AddIndex(
            model_name='testassignment',
            index=models.Index(fields=['user', 'test', 'status'], name='test_assign_user_test_status_idx'),
        ),
        migrations.AddIndex(
            model_name='testassignment',
            index=models.Index(fields=['status', '-assigned_at'], name='test_assign_status_assigned_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='testassignment',
            unique_together={('user', 'test')},
        ),
    ]
