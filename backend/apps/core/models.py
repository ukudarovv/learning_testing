from django.db import models
from django.utils import timezone


class ContentPage(models.Model):
    """Model for storing editable content pages like Terms and Privacy Policy"""
    
    PAGE_TYPE_CHOICES = [
        ('terms', 'Terms of Use'),
        ('privacy', 'Privacy Policy'),
    ]
    
    page_type = models.CharField(max_length=20, choices=PAGE_TYPE_CHOICES, unique=True, verbose_name='Тип страницы')
    content_ru = models.TextField(verbose_name='Содержание (русский)')
    content_kz = models.TextField(blank=True, verbose_name='Содержание (казахский)')
    content_en = models.TextField(blank=True, verbose_name='Содержание (английский)')
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')
    
    class Meta:
        db_table = 'content_pages'
        verbose_name = 'Контентная страница'
        verbose_name_plural = 'Контентные страницы'
        ordering = ['page_type']
    
    def __str__(self):
        return f"{self.get_page_type_display()}"
    
    def get_content(self, lang='ru'):
        """Get content for specified language with fallback to Russian"""
        if lang == 'ru':
            return self.content_ru
        elif lang == 'kz':
            return self.content_kz or self.content_ru
        elif lang == 'en':
            return self.content_en or self.content_ru
        return self.content_ru


class SiteConfig(models.Model):
    """Singleton model for site-wide settings"""
    require_sms_on_registration = models.BooleanField(
        default=True,
        verbose_name='Требовать SMS при регистрации'
    )
    require_course_enrollment_request = models.BooleanField(
        default=True,
        verbose_name='Требовать запрос для курсов'
    )
    require_test_enrollment_request = models.BooleanField(
        default=True,
        verbose_name='Требовать запрос для тестов'
    )
    default_protocol_sign_method = models.CharField(
        max_length=10,
        choices=[('both', 'SMS и ЭЦП'), ('sms', 'Только SMS'), ('eds', 'Только ЭЦП')],
        default='both',
        verbose_name='Способ подписания протоколов по умолчанию'
    )
    require_sms_for_course_completion = models.BooleanField(
        default=True,
        verbose_name='Требовать SMS для завершения курса',
    )
    require_sms_for_test_completion = models.BooleanField(
        default=True,
        verbose_name='Требовать SMS для завершения отдельного теста',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Дата обновления')

    class Meta:
        db_table = 'site_config'
        verbose_name = 'Настройки сайта'
        verbose_name_plural = 'Настройки сайта'

    def __str__(self):
        return 'Site Configuration'


def get_site_config():
    """Get or create the singleton SiteConfig instance"""
    config, _ = SiteConfig.objects.get_or_create(
        pk=1,
        defaults={
            'require_sms_on_registration': True,
            'require_course_enrollment_request': True,
            'require_test_enrollment_request': True,
            'default_protocol_sign_method': 'both',
            'require_sms_for_course_completion': True,
            'require_sms_for_test_completion': True,
        }
    )
    return config
