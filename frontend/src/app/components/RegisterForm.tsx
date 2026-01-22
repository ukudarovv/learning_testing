import { useState } from 'react';
import { User, Mail, Lock, UserPlus, Phone, Eye, EyeOff, Hash } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService, RegisterData } from '../services/auth';
import { ApiError } from '../services/api';
import { useUser } from '../contexts/UserContext';
import { SMSVerification } from './lms/SMSVerification';
import { smsService } from '../services/smsService';

export function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useUser();
  const [formData, setFormData] = useState<RegisterData>({
    phone: '',
    password: '',
    password_confirm: '',
    full_name: '',
    email: '',
    iin: '',
    language: 'ru',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let next = value;
    if (name === 'iin') {
      next = value.replace(/\D/g, '').slice(0, 12);
    }
    setFormData(prev => ({ ...prev, [name]: next }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.password_confirm) {
      setError('Пароли не совпадают');
      return;
    }

    // Validate required fields
    if (!formData.phone || !formData.password || !formData.full_name || !formData.email || !formData.iin) {
      setError('Заполните все обязательные поля');
      return;
    }
    const iinDigits = formData.iin.replace(/\D/g, '');
    if (iinDigits.length !== 12) {
      setError('ИИН должен содержать 12 цифр');
      return;
    }

    try {
      setSendingSMS(true);
      const res = await smsService.sendVerificationCode(formData.phone, 'registration');
      setDebugCode(res.otp_code ?? null);
      setShowSMSVerification(true);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки SMS кода. Попробуйте снова.');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleSMSVerified = async (code: string) => {
    setError('');
    setLoading(true);

    try {
      // Register user with verification code
      const registerData = { ...formData, verification_code: code };
      const response = await authService.register(registerData);
      
      // Автоматически логиним пользователя после регистрации
      if (response && response.user) {
        // Обновляем контекст пользователя
        login(response.user);
        
        // Перенаправляем в зависимости от роли
        switch (response.user.role) {
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
        // Обрабатываем ошибки валидации
        if (err.data) {
          const errors = Object.values(err.data).flat();
          setError(Array.isArray(errors) ? errors.join(', ') : err.message);
        } else {
          setError(err.message || t('forms.register.registerError'));
        }
      } else {
        setError(t('forms.register.registerError'));
      }
      setShowSMSVerification(false);
    } finally {
      setLoading(false);
    }
  };

  const handleResendSMS = async () => {
    try {
      setSendingSMS(true);
      const res = await smsService.sendVerificationCode(formData.phone, 'registration');
      setDebugCode(res.otp_code ?? null);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки SMS кода.');
    } finally {
      setSendingSMS(false);
    }
  };

  return (
    <section id="register" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="text-center mb-8">
              <img 
                src="/logo.jpg" 
                alt="UNICOVER Logo" 
                className="h-16 w-auto object-contain mx-auto mb-4"
              />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {t('forms.register.title')}
              </h2>
              <p className="text-gray-600 text-sm">
                {t('forms.register.subtitle')}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.fullName')} *
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="reg-name"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder={t('forms.register.fullNamePlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    id="reg-email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder={t('forms.register.emailPlaceholder') || 'your@email.com'}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-iin" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.iin')} *
                </label>
                <div className="relative">
                  <Hash className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    id="reg-iin"
                    name="iin"
                    value={formData.iin}
                    onChange={handleChange}
                    required
                    inputMode="numeric"
                    maxLength={12}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder={t('forms.register.iinPlaceholder') || '12 цифр'}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.phone')} *
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    id="reg-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder={t('forms.register.phonePlaceholder')}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('forms.register.phoneHint')}
                </p>
              </div>

              <div>
                <label htmlFor="reg-company" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.organization')}
                </label>
                <input
                  type="text"
                  id="reg-company"
                  name="organization"
                  value={formData.organization || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                  placeholder={t('forms.register.organizationPlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.password')} *
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="reg-password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-password-confirm" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.register.confirmPassword')} *
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    id="reg-password-confirm"
                    name="password_confirm"
                    value={formData.password_confirm}
                    onChange={handleChange}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  className="mt-1 rounded"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  {t('forms.register.terms')}{' '}
                  <Link to="/terms" className="text-blue-600 hover:text-blue-700">
                    {t('forms.register.termsLink')}
                  </Link>
                  {' '}{t('forms.register.and')}{' '}
                  <Link to="/privacy" className="text-blue-600 hover:text-blue-700">
                    {t('forms.register.privacyLink')}
                  </Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || sendingSMS}
                className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-5 h-5" />
                {sendingSMS ? 'Отправка SMS...' : loading ? t('forms.register.registering') : t('forms.register.registerButton')}
              </button>
            </form>

            {showSMSVerification && (
              <SMSVerification
                phone={formData.phone}
                onVerified={handleSMSVerified}
                onCancel={() => { setShowSMSVerification(false); setDebugCode(null); }}
                title="Подтверждение регистрации"
                description={`На номер ${formData.phone} отправлен SMS код. Введите его для завершения регистрации.`}
                purpose="registration"
                onResend={handleResendSMS}
                debugCode={debugCode}
              />
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                {t('forms.register.haveAccount')}{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
                  {t('forms.register.loginLink')}
                </Link>
              </p>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>{t('forms.register.important')}</strong> {t('forms.register.importantMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}