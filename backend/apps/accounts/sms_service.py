"""
SMS Service for SMSC.kz integration
"""
import json
import logging
import requests
from typing import Dict, Optional, Any
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

logger = logging.getLogger(__name__)


class SMSCService:
    """Service for sending SMS via SMSC.kz API"""
    
    def __init__(self):
        self.login = getattr(settings, 'SMSC_LOGIN', '')
        self.password = getattr(settings, 'SMSC_PASSWORD', '')
        self.sender = (getattr(settings, 'SMSC_SENDER', '') or '').strip()
        self.api_url = getattr(settings, 'SMSC_API_URL', 'https://smsc.kz/sys/send.php')
        
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone to 11 digits: 7XXXXXXXXXX (Kazakhstan / RU mobile)."""
        original_phone = str(phone)

        phone = ''.join(filter(str.isdigit, original_phone))

        logger.info(f"Normalizing phone: {original_phone} -> digits only: {phone}")

        if phone.startswith('8'):
            phone = '7' + phone[1:]
            logger.info(f"Replaced 8 with 7: {phone}")

        if not phone.startswith('7'):
            phone = '7' + phone
            logger.info(f"Added 7 prefix: {phone}")

        logger.info(f"Final normalized phone digits: {phone} (from {original_phone})")
        
        # Validate phone length (should be 11 digits for Kazakhstan: 7XXXXXXXXXX)
        if len(phone) != 11:
            logger.warning(f"Phone number length seems incorrect: {len(phone)} digits ({phone}), expected 11")
        
        return phone
    
    def _check_rate_limit(self, phone: str) -> bool:
        """Check if rate limit is exceeded (max 3 requests per minute per phone)"""
        cache_key = f'sms_rate_limit_{phone}'
        request_count = cache.get(cache_key, 0)
        
        if request_count >= 3:
            logger.warning(f"Rate limit exceeded for phone {phone}")
            return False
        
        # Increment counter and set expiration to 60 seconds
        cache.set(cache_key, request_count + 1, 60)
        return True

    def _parse_smsc_body(self, body: str) -> Optional[Dict[str, Any]]:
        """Разбор ответа SMSC.kz (fmt=3 — JSON; иначе текстовые форматы)."""
        if not body:
            return {
                'success': False,
                'error': 'Пустой ответ SMSC',
                'message': 'Failed to send SMS',
            }
        text = body.strip()
        if text.startswith('{'):
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                return None
            if not isinstance(data, dict):
                return None
            err_text = data.get('error')
            if err_text:
                code = data.get('error_code', '')
                return {
                    'success': False,
                    'error': f'SMSC.kz: {err_text}' + (f' (код {code})' if code != '' else ''),
                    'message': 'Failed to send SMS',
                    'raw_response': text,
                    'smsc': data,
                }
            if data.get('id') is not None:
                return {
                    'success': True,
                    'message': 'SMS sent successfully',
                    'sms_id': str(data.get('id')),
                    'smsc': data,
                }
            return {
                'success': False,
                'error': f'SMSC.kz: неожиданный JSON: {text[:300]}',
                'message': 'Failed to send SMS',
                'raw_response': text,
            }

        low = text.lower()
        if text.startswith('error') or ('error' in low and '=' in text):
            return {
                'success': False,
                'error': f'SMSC.kz: {text}',
                'message': 'Failed to send SMS',
                'raw_response': text,
            }
        if text == 'OK' or low == 'ok':
            return {'success': True, 'message': 'SMS sent successfully', 'sms_id': None}
        if text.startswith('ID='):
            return {
                'success': True,
                'message': 'SMS sent successfully',
                'sms_id': text.replace('ID=', '').strip(),
            }
        if text.isdigit():
            return {'success': True, 'message': 'SMS sent successfully', 'sms_id': text}
        parts = text.split(',')
        if len(parts) == 2:
            a, b = parts[0].strip(), parts[1].strip()
            # fmt=1: ошибка вида 0,-N (код N)
            if a == '0' and b.startswith('-'):
                return {
                    'success': False,
                    'error': f'SMSC.kz error code {b}',
                    'message': 'Failed to send SMS',
                    'raw_response': text,
                }
            if a.isdigit() and b.isdigit():
                return {
                    'success': True,
                    'message': 'SMS sent successfully',
                    'sms_id': b,
                    'count': a,
                }
        return None
    
    def send_sms(self, phone: str, message: str) -> Dict[str, any]:
        """
        Send SMS via SMSC.kz API
        
        Args:
            phone: Phone number (any format)
            message: SMS message text
            
        Returns:
            Dict with 'success', 'message', 'error' keys
        """
        if not self.login or not self.password:
            logger.error("SMSC.kz credentials not configured")
            return {
                'success': False,
                'error': 'SMS service not configured',
                'message': 'SMS service credentials are missing'
            }
        
        # Normalize phone number (digits only for cache/DB consistency)
        normalized_phone = self._normalize_phone(phone)
        # Документация SMSC.kz: phones=79999999999 (11 цифр, без +) — надёжнее, чем + в form-urlencoded

        # Check rate limit
        if not self._check_rate_limit(normalized_phone):
            return {
                'success': False,
                'error': 'Rate limit exceeded',
                'message': 'Too many requests. Please try again later.'
            }
        
        # https://smsc.kz/api/http/send/sms/ — fmt=3 возвращает JSON с полями id / error
        params: Dict[str, Any] = {
            'login': self.login,
            'psw': self.password,
            'phones': normalized_phone,
            'mes': message,
            'charset': 'utf-8',
            'fmt': '3',
        }
        # UCS-2 для кириллицы; без этого часть шлюзов режет текст
        params['coding'] = '8'

        if self.sender:
            params['sender'] = self.sender
        
        # Log the message for debugging
        logger.debug(f"Message (original): {message}")
        logger.debug(f"Message length: {len(message)} characters")
        
        try:
            logger.info(f"Sending SMS to {normalized_phone} via SMSC.kz")
            logger.info(f"Original phone: {phone}")
            logger.info(f"Normalized digits: {normalized_phone}")
            logger.info(f"Message: {message[:50]}...")
            logger.info(f"API URL: {self.api_url}")
            logger.info(f"Login: {self.login}")
            logger.info(f"Sender: {self.sender}")
            
            # Make request to SMSC.kz API
            # Try POST method first for better UTF-8 handling, fallback to GET if needed
            logger.info(f"Making request to SMSC.kz API...")
            logger.info(f"Message text (first 50 chars): {message[:50]}")
            
            # Try POST first (better for UTF-8), then GET as fallback
            try:
                # POST request with form data - better UTF-8 support
                response = requests.post(
                    self.api_url,
                    data=params,
                    timeout=30,
                    headers={'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'}
                )
                logger.info("Used POST method for SMS sending")
            except Exception as e:
                logger.warning(f"POST failed, trying GET: {e}")
                # Fallback to GET
                response = requests.get(
                    self.api_url,
                    params=params,
                    timeout=30
                )
                logger.info("Used GET method for SMS sending")
            
            # Log response details
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")
            
            result = response.text.strip()
            logger.info(f"SMSC.kz response: {result[:500]}")
            
            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {result}"
                logger.error(f"Failed to send SMS: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg,
                    'message': 'Failed to send SMS'
                }

            parsed = self._parse_smsc_body(result)
            if parsed is not None:
                return parsed

            logger.error(f"SMSC.kz: unrecognized response: {result}")
            return {
                'success': False,
                'error': result or 'Empty response from SMSC',
                'message': 'Failed to send SMS',
                'raw_response': result,
            }
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout while sending SMS to {normalized_phone}")
            return {
                'success': False,
                'error': 'Request timeout',
                'message': 'SMS service is temporarily unavailable'
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error while sending SMS: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Failed to connect to SMS service'
            }
        except Exception as e:
            logger.error(f"Unexpected error while sending SMS: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'An unexpected error occurred'
            }
    
    def send_verification_code(self, phone: str, code: str, purpose: str = 'verification') -> Dict[str, any]:
        """
        Send verification code SMS
        
        Args:
            phone: Phone number
            code: 6-digit verification code
            purpose: Purpose of verification (protocol_sign, registration, password_reset, etc.)
            
        Returns:
            Dict with 'success', 'message', 'error' keys
        """
        # Log the SMS code
        logger.warning(f"[SMS CODE] Sending via SMSC - Purpose: {purpose}, Phone: {phone}, Code: {code}")
        print(f"\n{'='*60}")
        print(f"⚠️  SMS CODE SENT")
        print(f"Purpose: {purpose}")
        print(f"Phone: {phone}")
        print(f"Code: {code}")
        print(f"{'='*60}\n")
        
        # Create message based on purpose
        purpose_messages = {
            'protocol_sign': f'Ваш код для подписания протокола: {code}. Код действителен 10 минут.',
            'registration': f'Ваш код подтверждения регистрации: {code}. Код действителен 10 минут.',
            'password_reset': f'Ваш код для восстановления пароля: {code}. Код действителен 10 минут.',
            'verification': f'Ваш код подтверждения: {code}. Код действителен 10 минут.',
            'profile_update': f'Ваш код подтверждения: {code}. Код действителен 10 минут.',
        }
        
        message = purpose_messages.get(purpose, f'Ваш код подтверждения: {code}. Код действителен 10 минут.')
        
        return self.send_sms(phone, message)


# Singleton instance
sms_service = SMSCService()

