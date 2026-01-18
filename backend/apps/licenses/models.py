from django.db import models
from django.conf import settings
import os


def license_upload_to(instance, filename):
    """Generate upload path for license files"""
    if instance.category:
        category_slug = instance.category.slug
    else:
        category_slug = 'other'
    return f"licenses/{category_slug}/{filename}"


class LicenseCategory(models.Model):
    """License category model with multilingual support"""
    
    name = models.CharField(max_length=100, verbose_name='Название (русский)')
    name_kz = models.CharField(max_length=100, blank=True, verbose_name='Название (казахский)')
    name_en = models.CharField(max_length=100, blank=True, verbose_name='Название (английский)')
    slug = models.SlugField(max_length=50, unique=True, verbose_name='URL-слаг')
    description = models.TextField(blank=True, verbose_name='Описание')
    order = models.IntegerField(default=0, help_text='Порядок отображения', verbose_name='Порядок')
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        db_table = 'license_categories'
        verbose_name = 'Категория лицензий'
        verbose_name_plural = 'Категории лицензий'
        ordering = ['order', 'name']
    
    def __str__(self):
        return self.name
    
    def get_name(self, lang='ru'):
        """Get name for specified language with fallback to Russian"""
        if lang == 'ru':
            return self.name
        elif lang == 'kz':
            return self.name_kz or self.name
        elif lang == 'en':
            return self.name_en or self.name
        return self.name


class License(models.Model):
    """License model for construction company licenses"""
    
    title = models.CharField(max_length=255, verbose_name='Название лицензии')
    number = models.CharField(max_length=100, unique=True, verbose_name='Номер лицензии')
    category = models.ForeignKey('LicenseCategory', related_name='licenses', on_delete=models.PROTECT, null=True, blank=True, verbose_name='Категория')
    description = models.TextField(blank=True, verbose_name='Описание')
    file = models.FileField(upload_to=license_upload_to, blank=True, null=True, verbose_name='Файл')
    issued_date = models.DateField(verbose_name='Дата выдачи')
    valid_until = models.DateField(verbose_name='Действует до', null=True, blank=True)
    is_active = models.BooleanField(default=True, verbose_name='Активна')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='created_licenses', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'licenses'
        ordering = ['-issued_date']
        verbose_name = 'Лицензия'
        verbose_name_plural = 'Лицензии'
    
    def __str__(self):
        return f"{self.title} ({self.number})"
    
    def delete(self, *args, **kwargs):
        """Delete file when license is deleted"""
        if self.file:
            self.file.delete()
        super().delete(*args, **kwargs)

