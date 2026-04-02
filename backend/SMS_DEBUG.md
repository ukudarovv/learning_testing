# Диагностика проблем с отправкой SMS

## Быстрая проверка

### 1. Проверьте настройки SMSC.kz

Убедитесь, что в файле `backend/.env` есть следующие настройки:
```bash
SMSC_LOGIN=ukudarov
SMSC_PASSWORD=Raushan1956!
SMSC_SENDER=UNICOVER
SMSC_API_URL=https://smsc.kz/sys/send.php
```

### 2. Проверьте логи Django

При попытке завершения курса или подписания протокола проверьте логи Django сервера. Вы должны увидеть:

```
INFO: Attempting to send SMS to 87075577444 for course completion X
INFO: OTP code generated: 123456
INFO: SMSC.kz configured: login=ukudarov, password=***
INFO: Normalizing phone: 87075577444 -> digits only: 87075577444
INFO: Replaced 8 with 7: 77075577444
INFO: Final normalized phone: 77075577444
INFO: Sending SMS to 77075577444 via SMSC.kz
INFO: SMS result: {'success': True, 'message': 'SMS sent successfully', 'sms_id': '1'}
```

Если видите ошибки, они будут указаны в логах.

### 3. Тестовая команда

Запустите тестовую команду для проверки отправки SMS:
```bash
cd backend
python manage.py test_sms --phone 87075577444 --message "Тест"
```

Если тест проходит успешно, но SMS не отправляется при завершении курса, проблема может быть в:
- Номере телефона пользователя в базе данных
- Логике проверки существующего OTP кода
- Ошибке при вызове SMS сервиса

### 4. Проверка номера телефона пользователя

Проверьте, что у пользователя есть номер телефона:
```bash
python manage.py shell
>>> from apps.accounts.models import User
>>> user = User.objects.get(phone='87075577444')  # или ваш номер
>>> print(f"Phone: {user.phone}, ID: {user.id}")
```

### 5. Частые проблемы

**Проблема:** SMS не отправляется, но код показывается в режиме отладки
**Решение:** Проверьте логи Django - там будет указана причина ошибки

**Проблема:** "SMS service not configured"
**Решение:** Убедитесь, что файл `.env` существует и содержит правильные настройки SMSC.kz

**Проблема:** "Rate limit exceeded"
**Решение:** Подождите 1 минуту перед повторной попыткой

**Проблема:** "User phone number is missing"
**Решение:** Убедитесь, что у пользователя указан номер телефона в профиле

### 6. Включение подробного логирования

В `settings.py` измените уровень логирования на DEBUG:
```python
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
            'level': 'DEBUG',  # Измените на DEBUG
        },
        'apps.courses': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Измените на DEBUG
        },
        'apps.protocols': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Измените на DEBUG
        },
    },
}
```

После этого перезапустите Django сервер и попробуйте снова. В логах будет видна вся информация о процессе отправки SMS.

