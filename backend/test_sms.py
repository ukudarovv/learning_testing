#!/usr/bin/env python
"""
Test script for SMSC.kz SMS sending
"""
import os
import sys
import django

# Setup Django
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.sms_service import sms_service
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

if __name__ == '__main__':
    # Test phone number (replace with your test number)
    test_phone = '77001234567'  # Replace with actual test number
    test_message = 'Тестовое сообщение от Aqlant'
    
    print("=" * 50)
    print("Testing SMSC.kz SMS Service")
    print("=" * 50)
    print(f"Login: {sms_service.login}")
    print(f"Password: {'*' * len(sms_service.password) if sms_service.password else 'Not set'}")
    print(f"Sender: {sms_service.sender}")
    print(f"API URL: {sms_service.api_url}")
    print(f"Test phone: {test_phone}")
    print(f"Test message: {test_message}")
    print("=" * 50)
    
    # Test sending SMS
    result = sms_service.send_sms(test_phone, test_message)
    
    print("\nResult:")
    print(f"Success: {result.get('success')}")
    print(f"Message: {result.get('message')}")
    if result.get('error'):
        print(f"Error: {result.get('error')}")
    if result.get('sms_id'):
        print(f"SMS ID: {result.get('sms_id')}")

