#!/usr/bin/env python
"""
Тестовый скрипт отправки письма через SMTP.
Запуск: python send_test_email.py [email_получателя]
Пример: python send_test_email.py ukudarovv@gmail.com
"""
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

def main():
    recipient = sys.argv[1] if len(sys.argv) > 1 else 'ukudarovv@gmail.com'
    
    print("Otpravka testovogo pis'ma...")
    print(f"  SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
    print(f"  Ot: {settings.DEFAULT_FROM_EMAIL}")
    print(f"  Komu: {recipient}")
    print()
    
    html_message = '''
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
<p>Это тестовое письмо от платформы UNICOVER.</p>
<p>Если вы получили это письмо, настройки SMTP работают корректно.</p>
<p>С уважением,<br>ТОО "Unicover"</p>
</body>
</html>
'''.strip()

    try:
        result = send_mail(
            subject='Тестовое письмо UNICOVER',
            message='''Это тестовое письмо от платформы UNICOVER.

Если вы получили это письмо, настройки SMTP работают корректно.

С уважением,
ТОО "Unicover"
''',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_message,
            fail_silently=False,
        )
        print(f"[OK] Pis\'mo uspeshno otpravleno! (result: {result})")
    except Exception as e:
        print(f"[ERROR] Oshibka otpravki: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
