"""
Django settings for Aqlant LMS project.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from backend/.env
load_dotenv(BASE_DIR / '.env')


def _env_csv(name: str) -> list:
    raw = os.getenv(name, '').strip()
    if not raw:
        return []
    return [x.strip() for x in raw.split(',') if x.strip()]


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-this-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = [
    "aqlant.com",
    "www.aqlant.com",
    "api.aqlant.com",
    "api.elearning.aqlant.com",
    "elearning.aqlant.com",
    "www.elearning.aqlant.com",
    "localhost",
    "127.0.0.1",
] + _env_csv('DJANGO_ALLOWED_HOSTS') + _env_csv('ALLOWED_HOSTS')

CORS_ALLOWED_ORIGINS = [
    "https://aqlant.com",
    "https://www.aqlant.com",
    "https://elearning.aqlant.com",
    "https://www.elearning.aqlant.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:3000",
] + _env_csv('DJANGO_CORS_ALLOWED_ORIGINS')

# Любой https-поддомен aqlant.com (в т.ч. вложенные), если Origin не попал в список выше
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://([\w-]+\.)*aqlant\.com$",
]

CSRF_TRUSTED_ORIGINS = [
    "https://aqlant.com",
    "https://www.aqlant.com",
    "https://api.aqlant.com",
    "https://api.elearning.aqlant.com",
    "https://elearning.aqlant.com",
    "https://www.elearning.aqlant.com",
] + _env_csv('DJANGO_CSRF_TRUSTED_ORIGINS')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'drf_spectacular',
    'django_filters',
    
    # Local apps
    'apps.core',
    'apps.accounts',
    'apps.courses',
    'apps.tests',
    'apps.exams',
    'apps.protocols',
    'apps.certificates',
    'apps.notifications',
    'apps.analytics',
    'apps.files',
    'apps.licenses',
    'apps.vacancies',
    'apps.contacts',
    'apps.projects',
    'apps.news',
    'apps.partners',
    'apps.telegram_bot',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.PDFFrameOptionsMiddleware',  # Allow PDF embedding in iframes
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Asia/Almaty'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# X-Frame-Options settings - default to DENY for security
# PDF files will be handled by PDFFrameOptionsMiddleware to allow embedding
X_FRAME_OPTIONS = 'DENY'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PARSER_CLASSES': (
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),   # 24 часа
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),  # 30 дней
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# CORS settings


CORS_ALLOW_CREDENTIALS = True

# CORS additional settings
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Swagger/OpenAPI settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Aqlant LMS API',
    'DESCRIPTION': 'API для системы управления обучением Aqlant',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': '/api/',
}

# SMS Settings (Twilio) - Legacy, kept for backward compatibility
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER', '')

# SMS Settings (SMSC.kz)
SMSC_LOGIN = os.getenv('SMSC_LOGIN', '')
SMSC_PASSWORD = os.getenv('SMSC_PASSWORD', '')
# Имя отправителя только если зарегистрировано в кабинете SMSC.kz; иначе оставьте пустым
SMSC_SENDER = os.getenv('SMSC_SENDER', '').strip()
SMSC_API_URL = os.getenv('SMSC_API_URL', 'https://smsc.kz/sys/send.php')

# Email Settings
# SendGrid: стабильная доставка в Gmail, list.ru и др. Бесплатно 100 писем/день.
# Если задан SENDGRID_API_KEY — используем SendGrid SMTP вместо mail.aqlant.com
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY', '')
SENDGRID_FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', '')  # Должен быть верифицирован в SendGrid

if SENDGRID_API_KEY:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = 'smtp.sendgrid.net'
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = 'apikey'
    EMAIL_HOST_PASSWORD = SENDGRID_API_KEY
    DEFAULT_FROM_EMAIL = SENDGRID_FROM_EMAIL or os.getenv('DEFAULT_FROM_EMAIL', 'noreply@aqlant.com')
else:
    # Если EMAIL_HOST задан в .env — используем SMTP. Иначе console (письма только в лог)
    _email_host = os.getenv('EMAIL_HOST', '')
    _default_backend = (
        'django.core.mail.backends.smtp.EmailBackend'
        if _email_host
        else 'django.core.mail.backends.console.EmailBackend'
    )
    EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', _default_backend)
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
    EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False') == 'True'  # порт 465 (Mail.ru)
    EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True' if not EMAIL_USE_SSL else False
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@aqlant.com')

SERVER_EMAIL = DEFAULT_FROM_EMAIL

# Registration email (рассылка при регистрации студента)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://aqlant.com')
REGISTRATION_PROGRAM_NAME = os.getenv('REGISTRATION_PROGRAM_NAME', 'Обучение на платформе Aqlant')
REGISTRATION_COORDINATOR_PHONE = os.getenv('REGISTRATION_COORDINATOR_PHONE', '')
REGISTRATION_COORDINATOR_EMAIL = os.getenv('REGISTRATION_COORDINATOR_EMAIL', '')
# Адрес отправителя (для SendGrid — верифицированный в панели; для SMTP — обычно совпадает с логином)
REGISTRATION_FROM_EMAIL = os.getenv('REGISTRATION_FROM_EMAIL', '') or DEFAULT_FROM_EMAIL

# Celery Configuration (optional for async tasks)
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'apps.accounts': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'apps.protocols': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'apps.notifications': {
            'handlers': ['console'],
            'level': 'INFO',
        },
    },
}

