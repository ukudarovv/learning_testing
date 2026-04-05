# Руководство по интеграции Frontend и Backend

## Быстрый старт

### 1. Запуск Backend

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py create_admin --phone +77075577444 --full-name "Admin User"
python manage.py runserver
```

Backend будет доступен на `http://localhost:8000`
- API: `http://localhost:8000/api/`
- Swagger: `http://localhost:8000/api/docs/`
- Admin: `http://localhost:8000/admin/`

### 2. Запуск Frontend

```bash
cd frontend
npm install
# Создайте .env файл
echo "VITE_API_URL=http://localhost:8000/api" > .env
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

## Структура интеграции

### API Клиент (`frontend/src/app/services/api.ts`)
- Автоматическое добавление JWT токена в заголовки
- Обработка ошибок через `ApiError`
- Поддержка загрузки файлов

### Сервисы
Все сервисы находятся в `frontend/src/app/services/`:
- `auth.ts` - аутентификация
- `courses.ts` - курсы
- `tests.ts` - тесты
- `exams.ts` - экзамены
- `protocols.ts` - протоколы ЭК
- `certificates.ts` - сертификаты
- `notifications.ts` - уведомления
- `users.ts` - пользователи

### Хуки
React хуки для удобной работы с данными в `frontend/src/app/hooks/`:
- `useCourses()` - загрузка курсов
- `useCourse(id)` - загрузка одного курса
- `useTests()` - загрузка тестов
- `useTest(id)` - загрузка одного теста
- `useProtocols()` - загрузка протоколов
- `useNotifications()` - загрузка уведомлений

### Контекст пользователя
`UserContext` (`frontend/src/app/contexts/UserContext.tsx`):
- Автоматическая загрузка пользователя при инициализации
- Сохранение токена в localStorage
- Методы: `login()`, `logout()`, `updateUser()`, `refreshUser()`

## Обновленные компоненты

### Аутентификация
- ✅ `LoginForm.tsx` - использует `authService.login()`
- ✅ `Header.tsx` - использует `useUser()` и `logout()`

### Дашборды
- ✅ `StudentDashboard.tsx` - использует хуки для загрузки данных
- ✅ `PDEKDashboard.tsx` - использует `protocolsService` для подписания протоколов
- ⚠️ `AdminDashboard.tsx` - частично интегрирован (требуется доработка)

### Страницы
- ✅ `CoursePage.tsx` - использует `useCourse()` и `coursesService.completeLesson()`
- ✅ `TestPage.tsx` - использует `examsService` для прохождения тестов
- ✅ `DocumentsPage.tsx` - использует сервисы для загрузки сертификатов и протоколов

### Компоненты
- ✅ `TestInterface.tsx` - автосохранение через `examsService.saveAnswer()`
- ✅ `SMSVerification.tsx` - готов к интеграции с `protocolsService.signProtocol()`

## Примеры использования

### Загрузка данных через хук
```typescript
import { useCourses } from '../hooks/useCourses';

function MyComponent() {
  const { courses, loading, error, refetch } = useCourses();
  
  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  
  return (
    <div>
      {courses.map(course => (
        <div key={course.id}>{course.title}</div>
      ))}
    </div>
  );
}
```

### Прямой вызов API
```typescript
import { coursesService } from '../services/courses';
import { toast } from 'sonner';

async function handleCompleteLesson(lessonId: string) {
  try {
    await coursesService.completeLesson(lessonId);
    toast.success('Урок завершен');
  } catch (error) {
    if (error instanceof ApiError) {
      toast.error(error.message);
    }
  }
}
```

### Работа с аутентификацией
```typescript
import { useUser } from '../contexts/UserContext';

function MyComponent() {
  const { user, login, logout, loading } = useUser();
  
  const handleLogin = async () => {
    try {
      await login('+77081234567', 'password');
      // Пользователь автоматически сохраняется
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  if (loading) return <div>Загрузка...</div>;
  
  return (
    <div>
      {user ? (
        <div>Привет, {user.full_name || user.fullName}!</div>
      ) : (
        <button onClick={handleLogin}>Войти</button>
      )}
    </div>
  );
}
```

## Типы данных

Типы в `frontend/src/app/types/lms.ts` поддерживают оба формата:
- Backend формат: `full_name`, `passing_score`, `created_at`
- Frontend формат: `fullName`, `passingScore`, `createdAt`

Адаптеры в `frontend/src/app/utils/typeAdapters.ts` автоматически преобразуют данные.

## Обработка ошибок

Все API вызовы обрабатывают ошибки:
```typescript
import { ApiError } from '../services/api';

try {
  await someService.someMethod();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message, error.status);
    // error.data содержит дополнительные данные
  } else {
    console.error('Unknown error:', error);
  }
}
```

## JWT Токены

- Access token сохраняется в `localStorage` как `access_token`
- Refresh token сохраняется в `localStorage` как `refresh_token`
- Токен автоматически добавляется в заголовки всех запросов
- При истечении токена используйте `authService.refreshToken()`

## CORS

Backend настроен для работы с frontend на:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (альтернативный порт)

Если используете другой порт, добавьте его в `backend/config/settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:YOUR_PORT",  # Добавьте свой порт
]
```

## Демо-аккаунты

После создания демо-пользователей через `python manage.py create_demo_users`, можно использовать:
- Студент: `+77081234567` / `student123`
- Член ЭК: `+77082345678` / `pdek123`
- Председатель ЭК: `+77083456789` / `chairman123`
- Администратор: `+77770000001` / `admin123`

## Следующие шаги

1. ✅ API клиент и сервисы созданы
2. ✅ Хуки для загрузки данных созданы
3. ✅ Основные компоненты обновлены
4. ⚠️ Требуется доработка `AdminDashboard` для полной интеграции
5. ⚠️ Требуется тестирование всех функций

## Полезные ссылки

- Backend API документация: `http://localhost:8000/api/docs/`
- Frontend интеграция: `frontend/INTEGRATION.md`
- Backend README: `backend/README.md`

