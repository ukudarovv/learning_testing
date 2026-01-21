import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Lock, Phone, Eye, EyeOff } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { ApiError } from '../services/api';

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useUser();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(phone, password);
      
      // Проверяем, есть ли параметр returnTo для перенаправления после входа
      const returnTo = (location.state as any)?.returnTo;
      
      if (returnTo) {
        // Перенаправляем на запрошенную страницу
        navigate(returnTo);
        return;
      }
      
      // Получаем пользователя из localStorage для определения роли
      const userStr = localStorage.getItem('unicover_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        
        // Перенаправляем в зависимости от роли
        switch (user.role) {
          case 'student':
            navigate('/student/dashboard');
            break;
          case 'pdek_member':
          case 'pdek_chairman':
            navigate('/pdek/dashboard');
            break;
          case 'admin':
            navigate('/admin/dashboard');
            break;
          default:
            navigate('/dashboard');
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Показываем детали ошибки из backend
        let errorMessage = err.message;
        
        // Если есть детали ошибки в data, показываем их
        if (err.data) {
          // Обрабатываем non_field_errors
          if (err.data.non_field_errors) {
            errorMessage = Array.isArray(err.data.non_field_errors) 
              ? err.data.non_field_errors.join(', ')
              : err.data.non_field_errors;
          }
          // Обрабатываем ошибки полей
          else {
            const fieldErrors = Object.entries(err.data)
              .map(([field, errors]) => {
                const errorList = Array.isArray(errors) ? errors : [errors];
                return `${field}: ${errorList.join(', ')}`;
              })
              .join('; ');
            if (fieldErrors) {
              errorMessage = fieldErrors;
            }
          }
        }
        
        setError(errorMessage || 'Неверный телефон или пароль');
      } else {
        setError('Ошибка при входе. Попробуйте снова.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <img 
              src="/logo.jpg" 
              alt="UNICOVER Logo" 
              className="h-16 w-auto object-contain mx-auto mb-4"
            />
            <h2 className="text-3xl font-bold text-gray-900">{t('forms.login.title')}</h2>
            <p className="text-gray-600 mt-2">{t('forms.login.subtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('forms.login.phone')}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('forms.login.phonePlaceholder')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t('forms.login.password')}
                </label>
                <Link to="/password-reset" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  {t('forms.login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('forms.login.passwordPlaceholder')}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('forms.login.loggingIn') : t('forms.login.loginButton')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/register" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              {t('forms.login.noAccount')} {t('forms.login.register')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}