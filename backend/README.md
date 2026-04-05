# Aqlant LMS Backend

Backend API для системы управления обучением Aqlant (Learning & Testing).

## Установка

1. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

4. Примените миграции:
```bash
python manage.py migrate
```

5. Создайте тестовые данные:
```bash
python manage.py create_demo_data
```

6. Запустите сервер разработки:
```bash
python manage.py runserver
```

API будет доступен по адресу: http://localhost:8000/api/

Документация Swagger: http://localhost:8000/api/docs/

## Тестовые пользователи

После выполнения команды `create_demo_data` будут созданы следующие тестовые пользователи:

- **Администратор**: `77771234567` / `admin123`
- **Студент 1**: `77771111111` / `student123`
- **Студент 2**: `77772222222` / `student123`
- **Студент 3**: `77773333333` / `student123`
- **Преподаватель**: `77774444444` / `teacher123`
- **Член ЭК**: `77775555555` / `pdek123`
- **Председатель ЭК**: `77776666666` / `chairman123`

## Структура проекта

```
backend/
├── config/              # Настройки Django
├── apps/                # Приложения
│   ├── accounts/        # Пользователи и аутентификация
│   ├── courses/         # Курсы, модули, уроки
│   ├── tests/          # Тесты и вопросы
│   ├── exams/          # Попытки тестирования
│   ├── protocols/      # Протоколы ЭК
│   ├── certificates/   # Сертификаты
│   ├── notifications/  # Уведомления
│   ├── analytics/      # Аналитика
│   └── files/          # Управление файлами
├── db.sqlite3          # База данных (SQLite)
└── requirements.txt
```

## API Endpoints

### Аутентификация
- `POST /api/auth/token/` - Логин
- `POST /api/auth/token/refresh/` - Обновление токена
- `POST /api/auth/register/` - Регистрация
- `POST /api/auth/logout/` - Выход
- `GET /api/auth/me/` - Текущий пользователь

### Пользователи
- `GET /api/users/` - Список пользователей
- `POST /api/users/` - Создание пользователя
- `PUT /api/users/{id}/` - Обновление пользователя
- `DELETE /api/users/{id}/` - Удаление пользователя
- `GET /api/users/export/` - Экспорт в Excel
- `POST /api/users/import_users/` - Импорт из Excel

### Курсы
- `GET /api/courses/` - Список курсов
- `GET /api/courses/{id}/` - Детали курса
- `POST /api/courses/` - Создание курса
- `PUT /api/courses/{id}/` - Обновление курса
- `DELETE /api/courses/{id}/` - Удаление курса
- `GET /api/courses/{id}/students/` - Студенты курса
- `POST /api/courses/{id}/enroll/` - Зачисление студентов
- `GET /api/courses/my_enrollments/` - Мои зачисления
- `POST /api/lessons/{id}/complete/` - Завершение урока

### Тесты
- `GET /api/tests/` - Список тестов
- `GET /api/tests/{id}/` - Детали теста
- `POST /api/tests/` - Создание теста
- `PUT /api/tests/{id}/` - Обновление теста
- `DELETE /api/tests/{id}/` - Удаление теста
- `GET /api/tests/{id}/questions/` - Вопросы теста
- `POST /api/tests/{id}/questions/` - Добавление вопроса

### Экзамены
- `POST /api/exams/start/` - Начало попытки
- `POST /api/exams/{id}/save/` - Автосохранение ответа
- `POST /api/exams/{id}/submit/` - Завершение теста
- `GET /api/exams/{id}/` - Детали попытки
- `GET /api/exams/my_attempts/` - Мои попытки

### Протоколы
- `GET /api/protocols/` - Список протоколов
- `GET /api/protocols/{id}/` - Детали протокола
- `POST /api/protocols/{id}/request_signature/` - Запрос OTP для подписания
- `POST /api/protocols/{id}/sign/` - Подписание через OTP
- `GET /api/protocols/{id}/pdf/` - Скачивание PDF

### Сертификаты
- `GET /api/certificates/` - Список сертификатов
- `GET /api/certificates/{id}/` - Детали сертификата
- `GET /api/certificates/{id}/pdf/` - Скачивание PDF
- `GET /api/certificates/verify/{qr_code}/` - Верификация по QR-коду

### Уведомления
- `GET /api/notifications/` - Список уведомлений
- `PUT /api/notifications/{id}/read/` - Отметка как прочитанное
- `POST /api/notifications/mark_all_read/` - Отметить все как прочитанные

### Аналитика
- `GET /api/analytics/stats/` - Общая статистика
- `GET /api/analytics/enrollment_trend/` - Тренд зачислений
- `GET /api/analytics/test_results_distribution/` - Распределение результатов
- `GET /api/analytics/courses_popularity/` - Популярность курсов
- `GET /api/analytics/top_students/` - Топ студентов

### Файлы
- `GET /api/files/upload/` - Список файлов
- `POST /api/files/upload/` - Загрузка файла

Полная документация доступна в Swagger UI: http://localhost:8000/api/docs/

## Интеграция с Frontend

1. Убедитесь, что frontend имеет файл `.env` с:
```
VITE_API_URL=http://localhost:8000/api
```

2. Запустите backend:
```bash
python manage.py runserver
```

3. Запустите frontend:
```bash
cd ../frontend
npm run dev
```

4. Frontend будет доступен на http://localhost:5173 и автоматически подключится к backend.

## Технологии

- Django 4.2
- Django REST Framework
- JWT Authentication (djangorestframework-simplejwt)
- SQLite (для разработки)
- PostgreSQL (рекомендуется для production)
- Swagger/OpenAPI (drf-spectacular)

## Разработка

### Создание миграций
```bash
python manage.py makemigrations
python manage.py migrate
```

### Создание суперпользователя
```bash
python manage.py createsuperuser
```

### Создание тестовых данных
```bash
python manage.py create_demo_data
```

## Production

Для production рекомендуется:
- Использовать PostgreSQL вместо SQLite
- Настроить переменные окружения через `.env`
- Настроить CORS для конкретных доменов
- Использовать WSGI сервер (gunicorn, uwsgi)
- Настроить статические файлы через nginx или CDN
