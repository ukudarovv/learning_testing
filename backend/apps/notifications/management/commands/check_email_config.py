"""
Проверка настроек email на сервере.
Запуск: python manage.py check_email_config
Запустите на Linux-сервере, чтобы убедиться, что .env загружен и SMTP настроен.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
import os


class Command(BaseCommand):
    help = 'Проверить настройки email (для диагностики на сервере)'

    def handle(self, *args, **options):
        backend = getattr(settings, 'EMAIL_BACKEND', '?')
        host = getattr(settings, 'EMAIL_HOST', '?')
        port = getattr(settings, 'EMAIL_PORT', '?')
        user = getattr(settings, 'EMAIL_HOST_USER', '')
        has_password = bool(getattr(settings, 'EMAIL_HOST_PASSWORD', ''))
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '?')

        self.stdout.write('=== Email config ===')
        self.stdout.write(f'  EMAIL_BACKEND: {backend}')
        self.stdout.write(f'  EMAIL_HOST: {host}')
        self.stdout.write(f'  EMAIL_PORT: {port}')
        self.stdout.write(f'  EMAIL_HOST_USER: {user or "(пусто)"}')
        self.stdout.write(f'  EMAIL_HOST_PASSWORD: {"***" if has_password else "(пусто)"}')
        self.stdout.write(f'  DEFAULT_FROM_EMAIL: {from_email}')

        # Проверка .env
        from pathlib import Path
        env_path = Path(settings.BASE_DIR) / '.env'
        env_exists = env_path.exists()
        self.stdout.write(f'\n  .env path: {env_path}')
        self.stdout.write(f'  .env exists: {env_exists}')

        if 'console' in str(backend):
            self.stdout.write(self.style.WARNING(
                '\nПисьма НЕ отправляются — используется console backend. '
                'Добавьте в .env на сервере: EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend, EMAIL_HOST=..., EMAIL_HOST_USER=..., EMAIL_HOST_PASSWORD=...'
            ))
        elif not has_password:
            self.stdout.write(self.style.WARNING('EMAIL_HOST_PASSWORD не задан — отправка может не работать'))
        else:
            self.stdout.write(self.style.SUCCESS('\nПроверьте отправку: python manage.py send_registration_test email@example.com'))
