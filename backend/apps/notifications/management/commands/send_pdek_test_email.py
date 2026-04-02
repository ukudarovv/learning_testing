"""
Отправка тестовых писем на почты членов и председателей ПДЭК.
Запуск: python manage.py send_pdek_test_email
"""
import time
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Отправить тестовое письмо на почты всех членов и председателей ПДЭК'

    def handle(self, *args, **options):
        pdek_users = User.objects.filter(
            role__in=['pdek_member', 'pdek_chairman'],
            email__isnull=False
        ).exclude(email='')

        recipient_list = list(pdek_users.values_list('email', flat=True))

        if not recipient_list:
            self.stdout.write(self.style.WARNING('Нет пользователей ПДЭК с указанным email'))
            return

        self.stdout.write(f"Отправка тестовых писем на: {recipient_list}")

        subject = 'Тестовое письмо Aqlant'
        message = '''Здравствуйте!

Это тестовое письмо от платформы Aqlant.

Если вы получили это письмо, настройки email работают корректно.
Уведомления о новых протоколах для подписания будут приходить на эту почту.

С уважением,
ТОО «Aqlant»
'''.strip()

        html_message = '''
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
<p>Здравствуйте!</p>
<p>Это тестовое письмо от платформы Aqlant.</p>
<p>Если вы получили это письмо, настройки email работают корректно.<br>
Уведомления о новых протоколах для подписания будут приходить на эту почту.</p>
<p>С уважением,<br>ТОО «Aqlant»</p>
</body>
</html>
'''.strip()

        from_email = settings.DEFAULT_FROM_EMAIL

        sent = 0
        for i, email in enumerate(recipient_list):
            if i > 0:
                time.sleep(1)  # пауза между письмами, чтобы не сработал rate limit
            try:
                result = send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[email],
                    html_message=html_message,
                    fail_silently=False
                )
                if result:
                    sent += 1
                    self.stdout.write(self.style.SUCCESS(f"  Отправлено на {email}"))
                else:
                    self.stdout.write(self.style.ERROR(f"  Не отправлено на {email} (result=0)"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Ошибка для {email}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"\nИтого отправлено: {sent} из {len(recipient_list)}"))
