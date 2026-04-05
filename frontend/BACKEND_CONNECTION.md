# Подключение к Backend

## Настройка

### 1. Файл `.env`
Убедитесь, что в корне `frontend/` есть файл `.env` с содержимым:
```
VITE_API_URL=http://localhost:8000/api
```

### 2. Запуск Backend
```bash
cd backend
python manage.py runserver
```
Backend должен быть доступен на `http://localhost:8000`

### 3. Запуск Frontend
```bash
cd frontend
npm run dev
```

## Созданные сервисы

Все сервисы находятся в `frontend/src/app/services/`:

- ✅ `api.ts` - Базовый API клиент с JWT аутентификацией
- ✅ `auth.ts` - Аутентификация (login, register, logout, getCurrentUser)
- ✅ `courses.ts` - Управление курсами (CRUD, студенты, зачисление)
- ✅ `tests.ts` - Управление тестами (CRUD, вопросы)
- ✅ `users.ts` - Управление пользователями (CRUD, экспорт/импорт)
- ✅ `analytics.ts` - Аналитика (статистика, графики, отчеты)
- ✅ `certificates.ts` - Сертификаты (просмотр, скачивание, верификация)
- ✅ `exams.ts` - Экзамены (начало, сохранение, завершение)
- ✅ `protocols.ts` - Протоколы ЭК (просмотр, подписание)
- ✅ `notifications.ts` - Уведомления (просмотр, отметка прочитанным)

## Особенности API клиента

### Автоматическая аутентификация
- JWT токен автоматически добавляется в заголовки всех запросов
- Токен сохраняется в `localStorage` как `access_token`
- Refresh token сохраняется как `refresh_token`

### Обработка ошибок
- Все ошибки оборачиваются в `ApiError` с детальной информацией
- Поддержка различных форматов ошибок Django REST Framework
- Автоматическое извлечение сообщений об ошибках

### Использование

```typescript
import { coursesService } from '../services/courses';
import { usersService } from '../services/users';
import { ApiError } from '../services/api';

try {
  const courses = await coursesService.getCourses();
  const users = await usersService.getUsers({ role: 'student' });
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message, error.status);
  }
}
```

## Проверка подключения

1. Откройте консоль браузера (F12)
2. Перейдите на страницу `/admin/dashboard`
3. Проверьте Network tab - должны быть запросы к `http://localhost:8000/api/`
4. При успешном подключении данные должны загружаться из backend

## Возможные проблемы

### CORS ошибки
Убедитесь, что в `backend/config/settings.py` настроен CORS:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]
```

### 401 Unauthorized
- Проверьте, что вы авторизованы (токен в localStorage)
- Проверьте, что токен не истек
- Попробуйте перелогиниться

### 404 Not Found
- Убедитесь, что backend запущен
- Проверьте URL в `.env` файле
- Проверьте, что endpoint существует в backend

### Network Error
- Убедитесь, что backend доступен на `http://localhost:8000`
- Проверьте firewall настройки
- Проверьте, что порт 8000 не занят другим приложением

