"""
Тест отправки письма при регистрации.
Запуск: python manage.py send_registration_test email@example.com
"""
from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.notifications.utils import send_registration_email


class Command(BaseCommand):
    help = 'Send test registration email to given address'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Recipient email')
        parser.add_argument('--password', type=str, default='TestPass123!', help='Password to include')
        parser.add_argument('--phone', type=str, default='+77001234567', help='Phone for login')

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']
        phone = options['phone']

        # Create minimal user-like object
        class FakeUser:
            pass
        user = FakeUser()
        user.email = email
        user.phone = phone
        self.stdout.write(f"Sending registration email to {email}...")

        try:
            result = send_registration_email(user, password, fail_silently=False)
            if result:
                self.stdout.write(self.style.SUCCESS(f"Email sent successfully to {email}"))
            else:
                self.stdout.write(self.style.ERROR(f"Email failed to send (returned False)"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: {e}"))
            raise
