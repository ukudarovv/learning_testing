# Generated manually

from django.db import migrations, models
import django.db.models.deletion


def create_default_categories_and_migrate_data(apps, schema_editor):
    """Create default license categories and migrate existing data"""
    LicenseCategory = apps.get_model('licenses', 'LicenseCategory')
    License = apps.get_model('licenses', 'License')
    
    # Create default categories
    categories_map = {
        'surveying': {
            'name': 'Изыскания и проектирование',
            'name_kz': 'Зерттеулер және жобалау',
            'name_en': 'Surveying and Design',
            'slug': 'surveying',
        },
        'construction': {
            'name': 'Строительство',
            'name_kz': 'Құрылыс',
            'name_en': 'Construction',
            'slug': 'construction',
        },
        'other': {
            'name': 'Прочее',
            'name_kz': 'Басқа',
            'name_en': 'Other',
            'slug': 'other',
        },
    }
    
    db_alias = schema_editor.connection.alias
    created_categories = {}
    for old_slug, data in categories_map.items():
        category = LicenseCategory.objects.using(db_alias).create(
            name=data['name'],
            name_kz=data['name_kz'],
            name_en=data['name_en'],
            slug=data['slug'],
            is_active=True,
            order=len(created_categories),
        )
        created_categories[old_slug] = category
    
    # Migrate existing licenses (access old category field before it's removed)
    # Note: At this point, 'category' is still a CharField, so we access it as string
    for license in License.objects.using(db_alias).all():
        # Access the old CharField value directly from the database
        # Using db_alias ensures we're working with the right database
        old_category_value = getattr(license, 'category', None)
        if old_category_value and old_category_value in created_categories:
            license.category_new_id = created_categories[old_category_value].id
            license.save(update_fields=['category_new_id'])


def reverse_migrate_data(apps, schema_editor):
    """Reverse migration - convert back to choices"""
    # Nothing to do - the reverse will restore the old field structure
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('licenses', '0002_alter_license_valid_until'),
    ]

    operations = [
        # Create LicenseCategory model
        migrations.CreateModel(
            name='LicenseCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Название (русский)')),
                ('name_kz', models.CharField(blank=True, max_length=100, verbose_name='Название (казахский)')),
                ('name_en', models.CharField(blank=True, max_length=100, verbose_name='Название (английский)')),
                ('slug', models.SlugField(max_length=50, unique=True, verbose_name='URL-слаг')),
                ('description', models.TextField(blank=True, verbose_name='Описание')),
                ('order', models.IntegerField(default=0, help_text='Порядок отображения', verbose_name='Порядок')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активна')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Дата обновления')),
            ],
            options={
                'verbose_name': 'Категория лицензий',
                'verbose_name_plural': 'Категории лицензий',
                'db_table': 'license_categories',
                'ordering': ['order', 'name'],
            },
        ),
        # Add category ForeignKey to License (nullable for data migration)
        migrations.AddField(
            model_name='license',
            name='category_new',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='licenses', to='licenses.licensecategory', verbose_name='Категория'),
        ),
        # Data migration: create default categories and migrate data
        migrations.RunPython(
            code=create_default_categories_and_migrate_data,
            reverse_code=reverse_migrate_data,
        ),
        # Remove old category CharField
        migrations.RemoveField(
            model_name='license',
            name='category',
        ),
        # Rename category_new to category
        migrations.RenameField(
            model_name='license',
            old_name='category_new',
            new_name='category',
        ),
    ]
