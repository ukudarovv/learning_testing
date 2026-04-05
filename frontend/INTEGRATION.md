# Интеграция Frontend и Backend

## Настройка

1. Создайте файл `.env` в корне `frontend/`:
```env
VITE_API_URL=http://localhost:8000/api
```

2. Убедитесь, что backend запущен на `http://localhost:8000`

## Структура интеграции

### API Клиент
- `src/app/services/api.ts` - базовый API клиент с JWT аутентификацией
- Автоматическое добавление токена в заголовки
- Обработка ошибок и refresh токенов

### Сервисы
- `src/app/services/auth.ts` - аутентификация (login, register, logout)
- `src/app/services/courses.ts` - управление курсами
- `src/app/services/tests.ts` - управление тестами
- `src/app/services/exams.ts` - прохождение экзаменов
- `src/app/services/protocols.ts` - протоколы ЭК
- `src/app/services/certificates.ts` - сертификаты
- `src/app/services/notifications.ts` - уведомления
- `src/app/services/users.ts` - управление пользователями

### Хуки
- `src/app/hooks/useCourses.ts` - загрузка курсов
- `src/app/hooks/useTests.ts` - загрузка тестов
- `src/app/hooks/useProtocols.ts` - загрузка протоколов
- `src/app/hooks/useNotifications.ts` - загрузка уведомлений

### Контекст
- `src/app/contexts/UserContext.tsx` - управление состоянием пользователя
  - Автоматическая загрузка пользователя при инициализации
  - Сохранение токена в localStorage
  - Методы login, logout, updateUser

### Адаптеры типов
- `src/app/utils/typeAdapters.ts` - преобразование данных между backend и frontend форматами

## Обновленные компоненты

### Аутентификация
- `LoginForm.tsx` - использует `authService.login()`
- `Header.tsx` - использует `useUser()` и `logout()`

### Дашборды
- `StudentDashboard.tsx` - использует хуки для загрузки данных
- `PDEKDashboard.tsx` - использует `protocolsService` для подписания протоколов
- `AdminDashboard.tsx` - готов к интеграции с API

### Страницы
- `CoursePage.tsx` - использует `useCourse()` и `coursesService.completeLesson()`
- `TestPage.tsx` - использует `examsService` для прохождения тестов
- `DocumentsPage.tsx` - использует сервисы для загрузки сертификатов и протоколов

### Компоненты
- `TestInterface.tsx` - автосохранение через `examsService.saveAnswer()`
- `SMSVerification.tsx` - готов к интеграции с `protocolsService.signProtocol()`

## Использование

### Пример загрузки данных
```typescript
import { useCourses } from '../hooks/useCourses';

function MyComponent() {
  const { courses, loading, error } = useCourses();
  
  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;
  
  return <div>{courses.map(c => <div key={c.id}>{c.title}</div>)}</div>;
}
```

### Пример вызова API
```typescript
import { coursesService } from '../services/courses';

async function handleCompleteLesson(lessonId: string) {
  try {
    await coursesService.completeLesson(lessonId);
    toast.success('Урок завершен');
  } catch (error) {
    toast.error('Ошибка при завершении урока');
  }
}
```

## Типы данных

Типы в `src/app/types/lms.ts` обновлены для поддержки как backend, так и frontend форматов:
- `full_name` (backend) / `fullName` (frontend)
- `passing_score` (backend) / `passingScore` (frontend)
- И т.д.

Адаптеры в `typeAdapters.ts` автоматически преобразуют данные.

## Обработка ошибок

Все API вызовы обрабатывают ошибки через `ApiError` класс:
```typescript
try {
  await authService.login({ phone, password });
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message, error.status);
  }
}
```

## JWT Токены

- Access token сохраняется в localStorage как `access_token`
- Refresh token сохраняется в localStorage как `refresh_token`
- Токен автоматически добавляется в заголовки всех запросов
- При истечении токена можно использовать `authService.refreshToken()`

