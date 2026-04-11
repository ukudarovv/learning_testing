import logging
import threading
from django.core.mail import send_mass_mail, send_mail
from django.conf import settings
from django.utils import timezone
from apps.accounts.models import User
from apps.courses.models import Course
from typing import List, Optional

logger = logging.getLogger(__name__)

# Защита от двойной отправки (двойной клик, два вызова подряд)
_registration_email_sent: dict = {}
_registration_email_lock = threading.Lock()
_DEDUP_SECONDS = 120


def send_registration_email(
    user: User,
    password: str,
    program_name: str = None,
    start_date: str = None,
    platform_url: str = None,
    coordinator_phone: str = None,
    coordinator_email: str = None,
    fail_silently: bool = True
) -> bool:
    """
    Отправка письма при регистрации студента с данными для входа.
    
    Args:
        user: Зарегистрированный пользователь (студент)
        password: Пароль пользователя (для отображения в письме)
        program_name: Название программы (по умолчанию "Обучение на платформе Aqlant")
        start_date: Дата начала (по умолчанию сегодня)
        platform_url: Ссылка на платформу (из FRONTEND_URL)
        coordinator_phone: Телефон координатора
        coordinator_email: Email координатора
        fail_silently: Не выбрасывать исключение при ошибке отправки
    
    Returns:
        True если письмо отправлено успешно
    """
    if not user.email or not user.email.strip():
        return False

    # Не отправлять повторно одному адресу в течение DEDUP_SECONDS (защита от двойного клика)
    email_key = user.email.strip().lower()
    now = timezone.now()
    with _registration_email_lock:
        last = _registration_email_sent.get(email_key)
        if last and (now - last).total_seconds() < _DEDUP_SECONDS:
            logger.info(f"Registration email skipped (duplicate within {_DEDUP_SECONDS}s): {user.email}")
            return True  # считаем успехом, письмо уже ушло
        _registration_email_sent[email_key] = now
    
    program_name = program_name or getattr(settings, 'REGISTRATION_PROGRAM_NAME', 'Обучение на платформе Aqlant')
    start_date = start_date or timezone.now().strftime('%d.%m.%Y')
    platform_url = platform_url or getattr(settings, 'FRONTEND_URL', 'https://aqlant.com')
    coordinator_phone = coordinator_phone or getattr(settings, 'REGISTRATION_COORDINATOR_PHONE', '')
    coordinator_email = coordinator_email or getattr(settings, 'REGISTRATION_COORDINATOR_EMAIL', '')
    
    login = user.phone or user.email
    
    message = f'''Уважаемые слушатели!

Напоминаем, что обучение по программе «{program_name}» начинается {start_date}.

Просим пройти обучение по следующей ссылке:
«{platform_url}»

Для входа используйте следующие данные:
Логин: {login}
Пароль: {password}

Рекомендуем авторизоваться заранее и проверить корректность доступа к платформе.

В случае возникновения технических вопросов вы можете обратиться к координатору программы по телефону {coordinator_phone} или по электронной почте {coordinator_email}.

Желаем успешного обучения!

С уважением,
ТОО «Aqlant»
'''.strip()
    
    subject = f'Регистрация на платформе Aqlant'
    
    # HTML-версия для лучшей доставляемости (меньше шанс попасть в спам)
    html_message = f'''
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
<p>Уважаемые слушатели!</p>
<p>Напоминаем, что обучение по программе «{program_name}» начинается {start_date}.</p>
<p>Просим пройти обучение по следующей ссылке:<br>
<a href="{platform_url}" style="color: #2563eb;">{platform_url}</a></p>
<p><strong>Данные для входа:</strong><br>
Логин: {login}<br>
Пароль: {password}</p>
<p>Рекомендуем авторизоваться заранее и проверить корректность доступа к платформе.</p>
<p>В случае возникновения технических вопросов вы можете обратиться к координатору программы по телефону {coordinator_phone} или по электронной почте {coordinator_email}.</p>
<p>Желаем успешного обучения!</p>
<p>С уважением,<br>ТОО «Aqlant»</p>
</body>
</html>
'''.strip()
    
    from_email = settings.DEFAULT_FROM_EMAIL

    try:
        result = send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=fail_silently
        )
        if result:
            logger.info(f"Registration email sent to {user.email} from {from_email}")
            return True
        else:
            logger.warning(f"Registration email failed to send to {user.email} (send_mail returned 0)")
            return False
    except Exception as e:
        logger.exception(f"Registration email ERROR to {user.email}: {e}")
        if not fail_silently:
            raise
        return False


def send_bulk_email(
    subject: str,
    message: str,
    recipient_list: List[str],
    html_message: Optional[str] = None,
    fail_silently: bool = False
) -> int:
    """
    Send bulk email to multiple recipients
    
    Args:
        subject: Email subject
        message: Plain text message
        recipient_list: List of email addresses
        html_message: Optional HTML message
        fail_silently: If True, exceptions will be suppressed
    
    Returns:
        Number of emails sent
    """
    if not recipient_list:
        return 0
    
    # Use send_mass_mail for better performance with many recipients
    if len(recipient_list) > 50:
        # Split into batches for mass mail
        datatuple = [
            (subject, message, settings.DEFAULT_FROM_EMAIL, [email])
            for email in recipient_list
        ]
        return send_mass_mail(datatuple, fail_silently=fail_silently)
    else:
        # Use regular send_mail for smaller lists
        sent_count = 0
        for email in recipient_list:
            try:
                from_email = settings.DEFAULT_FROM_EMAIL
                result = send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[email],
                    html_message=html_message,
                    fail_silently=fail_silently
                )
                if result:
                    sent_count += 1
                    logger.info(f"Email sent to {email}")
                else:
                    logger.warning(f"Email to {email} returned 0 (not sent)")
            except Exception as e:
                logger.exception(f"Failed to send email to {email}: {e}")
                if not fail_silently:
                    raise e
        return sent_count


def send_course_notification(
    course: Course,
    subject: str = None,
    message: str = None,
    user_ids: Optional[List[int]] = None
) -> int:
    """
    Send email notification about a course to enrolled students
    
    Args:
        course: Course instance
        subject: Email subject (defaults to course title)
        message: Email message (defaults to course description)
        user_ids: Optional list of user IDs to send to (defaults to all enrolled students)
    
    Returns:
        Number of emails sent
    """
    if not subject:
        subject = f'Новый курс: {course.title}'
    
    if not message:
        message = f'''
Здравствуйте!

Информируем вас о новом курсе: {course.title}

{course.description or ''}

Начало курса: {course.start_date.strftime('%d.%m.%Y') if course.start_date else 'Скоро'}
Длительность: {course.duration} часов

Вы можете начать обучение в личном кабинете.

С уважением,
Команда Aqlant
        '''.strip()
    
    # Get enrolled students
    if user_ids:
        users = User.objects.filter(id__in=user_ids, email__isnull=False).exclude(email='')
    else:
        users = course.enrolled_students.filter(email__isnull=False).exclude(email='')
    
    recipient_list = list(users.values_list('email', flat=True))
    
    if not recipient_list:
        return 0
    
    return send_bulk_email(
        subject=subject,
        message=message,
        recipient_list=recipient_list
    )


def send_course_reminder(
    course: Course,
    days_before: int = 1,
    user_ids: Optional[List[int]] = None
) -> int:
    """
    Send reminder email about upcoming course
    
    Args:
        course: Course instance
        days_before: Days before course start to send reminder
        user_ids: Optional list of user IDs to send to
    
    Returns:
        Number of emails sent
    """
    if not course.start_date:
        return 0
    
    from django.utils import timezone
    from datetime import timedelta
    
    reminder_date = course.start_date - timedelta(days=days_before)
    
    # Only send if reminder date is today or in the past (for scheduled tasks)
    if reminder_date.date() > timezone.now().date():
        return 0
    
    subject = f'Напоминание: курс "{course.title}" начинается через {days_before} дн.'
    
    message = f'''
Здравствуйте!

Напоминаем, что курс "{course.title}" начинается {course.start_date.strftime('%d.%m.%Y')}.

Не забудьте подготовиться к началу обучения!

С уважением,
Команда Aqlant
    '''.strip()
    
    if user_ids:
        users = User.objects.filter(id__in=user_ids, email__isnull=False).exclude(email='')
    else:
        users = course.enrolled_students.filter(email__isnull=False).exclude(email='')
    
    recipient_list = list(users.values_list('email', flat=True))
    
    if not recipient_list:
        return 0
    
    return send_bulk_email(
        subject=subject,
        message=message,
        recipient_list=recipient_list
    )


def send_protocol_pdek_notification(protocol, fail_silently: bool = True) -> int:
    """
    Отправка email членам и председателям ЭК о новом протоколе для подписания.

    Args:
        protocol: Протокол (Protocol instance)
        fail_silently: Не выбрасывать исключение при ошибке отправки

    Returns:
        Количество отправленных писем
    """
    signer_ids = list(protocol.signatures.values_list('signer_id', flat=True))
    base_ec = User.objects.filter(
        role__in=['pdek_member', 'pdek_chairman'],
        email__isnull=False,
    ).exclude(email='')
    if signer_ids:
        pdek_users = base_ec.filter(pk__in=signer_ids)
    else:
        pdek_users = base_ec

    recipient_list = list(pdek_users.values_list('email', flat=True))
    
    # Логируем подписантов протокола без email
    signers_for_log = User.objects.filter(pk__in=signer_ids) if signer_ids else User.objects.filter(
        role__in=['pdek_member', 'pdek_chairman']
    )
    skipped = [u for u in signers_for_log if not (u.email and str(u.email).strip())]
    if skipped:
        logger.warning(
            f"Protocol {protocol.number}: EC users without email (no notification sent): "
            f"{[(u.full_name or u.phone, u.role) for u in skipped]}"
        )
    
    if not recipient_list:
        logger.warning(f"Protocol {protocol.number}: No EC users with email, skipping notification")
        return 0

    logger.info(f"Protocol {protocol.number}: Sending notification to: {recipient_list}")

    student_name = protocol.student.full_name or protocol.student.phone or '—'
    course_or_test = (
        protocol.course.title if protocol.course
        else (protocol.test.title if protocol.test else '—')
    )
    platform_url = getattr(settings, 'FRONTEND_URL', 'https://aqlant.com')
    dashboard_url = f"{platform_url.rstrip('/')}/pdek/dashboard"

    subject = f'Новый протокол №{protocol.number} ожидает подписания'

    message = f'''Здравствуйте!

Новый протокол №{protocol.number} ожидает подписания.

Студент: {student_name}
Курс/тест: {course_or_test}
Дата экзамена: {protocol.exam_date.strftime('%d.%m.%Y') if protocol.exam_date else '—'}

Перейдите по ссылке для подписания:
{dashboard_url}

С уважением,
ТОО «Aqlant»
'''.strip()

    html_message = f'''
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
<p>Здравствуйте!</p>
<p>Новый протокол <strong>№{protocol.number}</strong> ожидает подписания.</p>
<p><strong>Студент:</strong> {student_name}<br>
<strong>Курс/тест:</strong> {course_or_test}<br>
<strong>Дата экзамена:</strong> {protocol.exam_date.strftime('%d.%m.%Y') if protocol.exam_date else '—'}</p>
<p><a href="{dashboard_url}" style="color: #2563eb;">Перейти к подписанию</a></p>
<p>С уважением,<br>ТОО «Aqlant»</p>
</body>
</html>
'''.strip()

    try:
        sent = send_bulk_email(
            subject=subject,
            message=message,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=fail_silently
        )
        if sent:
            logger.info(f"Protocol EC notification sent to {sent} recipients for protocol {protocol.number}")
        return sent
    except Exception as e:
        logger.exception(f"Failed to send protocol EC notification for {protocol.number}: {e}")
        if not fail_silently:
            raise
        return 0

