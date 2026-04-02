"""
SMS Service for SMSC.kz integration
"""
import logging
import requests
from typing import Dict, Optional
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache

logger = logging.getLogger(__name__)


class SMSCService:
    """Service for sending SMS via SMSC.kz API"""
    
    def __init__(self):
        self.login = getattr(settings, 'SMSC_LOGIN', '')
        self.password = getattr(settings, 'SMSC_PASSWORD', '')
        self.sender = getattr(settings, 'SMSC_SENDER', 'AQLANT')
        self.api_url = getattr(settings, 'SMSC_API_URL', 'https://smsc.kz/sys/send.php')
        
    def _normalize_phone(self, phone: str) -> str:
        """Normalize phone number to format 77001234567"""
        original_phone = str(phone)
        
        # Remove all non-digit characters
        phone = ''.join(filter(str.isdigit, original_phone))
        
        logger.info(f"Normalizing phone: {original_phone} -> digits only: {phone}")
        
        # If starts with 8, replace with 7 (Kazakhstan format: 8XXXXXXXXX -> 7XXXXXXXXX)
        if phone.startswith('8'):
            phone = '7' + phone[1:]
            logger.info(f"Replaced 8 with 7: {phone}")
        
        # If starts with +7, remove + (shouldn't happen after digit filter, but just in case)
        if phone.startswith('+7'):
            phone = phone[2:]
        
        # If doesn't start with 7, add 7
        if not phone.startswith('7'):
            phone = '7' + phone
            logger.info(f"Added 7 prefix: {phone}")
        
        logger.info(f"Final normalized phone: {phone} (from {original_phone})")
        
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
        
        # Normalize phone number
        normalized_phone = self._normalize_phone(phone)
        
        # Check rate limit
        if not self._check_rate_limit(normalized_phone):
            return {
                'success': False,
                'error': 'Rate limit exceeded',
                'message': 'Too many requests. Please try again later.'
            }
        
        # Prepare request parameters
        # SMSC.kz API format: https://smsc.kz/sys/send.php?login=LOGIN&psw=PASSWORD&phones=PHONE&mes=MESSAGE
        # For Cyrillic characters, SMSC.kz requires UTF-8 encoding
        # We'll use requests library which handles UTF-8 encoding correctly
        
        # SMSC.kz API parameters
        # For Cyrillic characters, SMSC.kz requires proper encoding
        # Parameter 'coding': 0=default, 1=Latin, 8=UCS-2 (Unicode) - use 8 for Cyrillic
        # charset=utf-8 ensures UTF-8 encoding in URL
        params = {
            'login': self.login,
            'psw': self.password,
            'phones': normalized_phone,
            'mes': message,  # Will be properly encoded by requests
            'charset': 'utf-8',  # UTF-8 encoding for Cyrillic characters
            'coding': '8',  # 8 = UCS-2 (Unicode) for Cyrillic support
            'fmt': '1'  # Text format (1 = text, 2 = XML, 3 = JSON)
        }
        
        # Add sender if configured
        if self.sender:
            params['sender'] = self.sender
        
        # Log the message for debugging
        logger.debug(f"Message (original): {message}")
        logger.debug(f"Message length: {len(message)} characters")
        
        try:
            logger.info(f"Sending SMS to {normalized_phone} via SMSC.kz")
            logger.info(f"Original phone: {phone}")
            logger.info(f"Normalized phone: {normalized_phone}")
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
            
            # Get response text
            result = response.text.strip()
            logger.info(f"SMSC.kz response: {result}")
            
            # Check HTTP status
            if response.status_code != 200:
                error_msg = f"HTTP {response.status_code}: {result}"
                logger.error(f"Failed to send SMS: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg,
                    'message': 'Failed to send SMS'
                }
            
            # Parse response - SMSC.kz returns different formats:
            # Success formats:
            #   - "ID=123456" - message ID
            #   - "1,1" - count,message_id (format: количество_отправленных,ID_сообщения)
            #   - "OK" - success confirmation
            #   - Numeric ID - message ID
            #   - Empty string - sometimes means success
            # Error formats:
            #   - "ERROR = код ошибки" or "ERROR=код" - error code
            #   - Error description text
            
            result_lower = result.lower().strip()
            
            # Check for error indicators (common error formats from SMSC.kz)
            error_patterns = [
                'error',
                'ошибка',
                'неверный',
                'недостаточно',
                'отказано',
                'denied',
                'invalid',
                'insufficient',
                'balance',
                'баланс'
            ]
            
            if any(pattern in result_lower for pattern in error_patterns):
                error_msg = f"SMSC.kz error: {result}"
                logger.error(f"Failed to send SMS: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg,
                    'message': 'Failed to send SMS',
                    'raw_response': result
                }
            
            # Check for success indicators
            
            # Format: "1,1" or "count,message_id" - success with count and message ID
            if ',' in result and result.replace(',', '').replace('-', '').isdigit():
                parts = result.split(',')
                if len(parts) == 2:
                    count = parts[0].strip()
                    sms_id = parts[1].strip()
                    logger.info(f"SMS sent successfully. Count: {count}, ID: {sms_id}")
                    return {
                        'success': True,
                        'message': 'SMS sent successfully',
                        'sms_id': sms_id,
                        'count': count
                    }
            
            # Format: "ID=123456" - message ID
            if result.startswith('ID='):
                sms_id = result.replace('ID=', '').strip()
                logger.info(f"SMS sent successfully. ID: {sms_id}")
                return {
                    'success': True,
                    'message': 'SMS sent successfully',
                    'sms_id': sms_id
                }
            
            # Format: "OK" - success confirmation
            if result == 'OK' or result.lower() == 'ok':
                logger.info("SMS sent successfully (OK response)")
                return {
                    'success': True,
                    'message': 'SMS sent successfully',
                    'sms_id': None
                }
            
            # Format: Numeric ID only
            if result.isdigit():
                logger.info(f"SMS sent successfully. ID: {result}")
                return {
                    'success': True,
                    'message': 'SMS sent successfully',
                    'sms_id': result
                }
            
            # Format: Empty string - sometimes means success
            if not result or result == '':
                logger.warning("Empty response from SMSC.kz - assuming success")
                return {
                    'success': True,
                    'message': 'SMS sent (empty response, assuming success)',
                    'sms_id': None,
                    'warning': 'Empty response from SMSC.kz'
                }
            
            # Unknown response format - but no error patterns found, assume success
            logger.info(f"Response from SMSC.kz: {result} (assuming success)")
            return {
                'success': True,
                'message': 'SMS sent successfully',
                'sms_id': result if result else None,
                'raw_response': result
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
        }
        
        message = purpose_messages.get(purpose, f'Ваш код подтверждения: {code}. Код действителен 10 минут.')
        
        return self.send_sms(phone, message)


# Singleton instance
sms_service = SMSCService()

