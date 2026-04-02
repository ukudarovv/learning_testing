"""
Django management command to test SMS sending via SMSC.kz
"""
from django.core.management.base import BaseCommand
from apps.accounts.sms_service import sms_service
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test SMS sending via SMSC.kz'

    def add_arguments(self, parser):
        parser.add_argument(
            '--phone',
            type=str,
            required=True,
            help='Phone number to send SMS to (e.g., 77001234567)',
        )
        parser.add_argument(
            '--message',
            type=str,
            default='Тестовое сообщение от Aqlant',
            help='Message text to send',
        )

    def handle(self, *args, **options):
        phone = options['phone']
        message = options['message']
        
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Testing SMSC.kz SMS Service'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f"Login: {sms_service.login}")
        self.stdout.write(f"Password: {'*' * len(sms_service.password) if sms_service.password else 'Not set'}")
        self.stdout.write(f"Sender: {sms_service.sender}")
        self.stdout.write(f"API URL: {sms_service.api_url}")
        self.stdout.write(f"Phone: {phone}")
        self.stdout.write(f"Message: {message}")
        self.stdout.write(self.style.SUCCESS('=' * 60))
        
        # Send SMS
        result = sms_service.send_sms(phone, message)
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Result:'))
        self.stdout.write(f"Success: {result.get('success')}")
        self.stdout.write(f"Message: {result.get('message')}")
        
        if result.get('error'):
            self.stdout.write(self.style.ERROR(f"Error: {result.get('error')}"))
        else:
            self.stdout.write(self.style.SUCCESS('No errors'))
            
        if result.get('sms_id'):
            self.stdout.write(self.style.SUCCESS(f"SMS ID: {result.get('sms_id')}"))

