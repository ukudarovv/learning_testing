import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, User, Mail, Phone, Lock, Eye, EyeOff, Building2, MapPin, Globe, Camera, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { User as UserType } from '../../types/lms';
import { authService } from '../../services/auth';
import { smsService } from '../../services/smsService';
import { SMSVerification } from './SMSVerification';
import { ApiError } from '../../services/api';
import { useUser } from '../../contexts/UserContext';
import { formatRuKzPhoneInput, normalizeRuKzPhoneDigits } from '../../utils/phoneInput';

interface ProfileEditorProps {
  user: UserType;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileEditor({ user, onSave, onCancel }: ProfileEditorProps) {
  const { t } = useTranslation();
  const { refreshUser } = useUser();
  const [formData, setFormData] = useState<Partial<UserType> & { password?: string; password_confirm?: string }>({
    full_name: user.full_name || user.fullName || '',
    email: user.email || '',
    phone: formatRuKzPhoneInput(user.phone || ''),
    iin: user.iin || '',
    city: user.city || '',
    organization: user.organization || '',
    language: user.language || 'ru',
    password: '',
    password_confirm: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [clearServerPhoto, setClearServerPhoto] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  const displayPhotoUrl = useMemo(() => {
    if (photoPreviewUrl) return photoPreviewUrl;
    if (!clearServerPhoto && user.profile_photo_url) return user.profile_photo_url;
    return null;
  }, [photoPreviewUrl, clearServerPhoto, user.profile_photo_url]);

  const languages = [
    { value: 'ru', label: t('header.russian') },
    { value: 'kz', label: t('header.kazakh') },
    { value: 'en', label: t('header.english') },
  ];

  useEffect(() => {
    // Проверяем, изменился ли телефон
    const originalPhone = normalizeRuKzPhoneDigits(user.phone || '');
    const newPhone = normalizeRuKzPhoneDigits(formData.phone || '');
    setPhoneChanged(originalPhone !== newPhone && newPhone !== '');
  }, [formData.phone, user.phone]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData(prev => ({ ...prev, phone: formatRuKzPhoneInput(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setError('');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(t('lms.student.profile.photoInvalidType') || 'Допустимы только JPG, PNG или WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('lms.student.profile.photoTooLarge') || 'Файл не должен превышать 5 МБ.');
      return;
    }
    setError('');
    setClearServerPhoto(false);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPendingPhotoFile(file);
  };

  const handleRemovePhoto = () => {
    setPendingPhotoFile(null);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (user.profile_photo_url) {
      setClearServerPhoto(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация паролей
    if (formData.password) {
      if (formData.password.length < 8) {
        setError('Пароль должен содержать минимум 8 символов');
        return;
      }
      if (formData.password !== formData.password_confirm) {
        setError('Пароли не совпадают');
        return;
      }
    }

    // Если телефон изменился, требуется SMS верификация
    if (phoneChanged) {
      try {
        setSendingSMS(true);
        await smsService.sendVerificationCode(formData.phone || '', 'verification');
        setShowSMSVerification(true);
        setError('');
      } catch (err: any) {
        setError(err.message || 'Ошибка отправки SMS кода. Попробуйте снова.');
      } finally {
        setSendingSMS(false);
      }
      return;
    }

    // Если телефон не менялся, сохраняем напрямую
    await saveProfile();
  };

  const handleSMSVerified = async (code: string) => {
    await saveProfile(code);
  };

  const saveProfile = async (verificationCode?: string) => {
    try {
      setLoading(true);
      setError('');

      const updateData: any = {
        full_name: formData.full_name,
        email: formData.email,
        iin: formData.iin,
        city: formData.city,
        organization: formData.organization,
        language: formData.language,
      };

      // Если телефон изменился, добавляем его и код верификации
      if (phoneChanged && formData.phone) {
        updateData.phone = formData.phone;
        if (verificationCode) {
          updateData.verification_code = verificationCode;
        }
      }

      // Если пароль указан, добавляем его
      if (formData.password && formData.password.trim()) {
        updateData.password = formData.password;
      }

      if (pendingPhotoFile) {
        updateData.profile_photo = pendingPhotoFile;
      } else if (clearServerPhoto) {
        updateData.clear_profile_photo = true;
      }

      const updatedUser = await authService.updateProfile(updateData);

      setPendingPhotoFile(null);
      setClearServerPhoto(false);
      setPhotoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      
      // Обновляем пользователя в контексте
      await refreshUser();
      
      onSave();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.data) {
          const errors = Object.values(err.data).flat();
          setError(Array.isArray(errors) ? errors.join(', ') : err.message);
        } else {
          setError(err.message || 'Ошибка сохранения профиля');
        }
      } else {
        setError('Ошибка сохранения профиля. Попробуйте снова.');
      }
      if (showSMSVerification) {
        setShowSMSVerification(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendSMS = async () => {
    try {
      setSendingSMS(true);
      await smsService.sendVerificationCode(formData.phone || '', 'verification');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки SMS кода.');
    } finally {
      setSendingSMS(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-gray-900">
              {t('lms.student.profile.editTitle') || 'Редактирование профиля'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Profile photo (proctored tests) */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/80">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Camera className="w-4 h-4 inline mr-2 align-text-bottom" />
                  {t('lms.student.profile.photoLabel') || 'Фото для идентификации на экзамене'}
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  {t('lms.student.profile.photoHint') ||
                    'Нужно для тестов с видеозаписью: система сверяет ваше лицо с этим фото. Лицо по центру, хорошее освещение.'}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300 shrink-0 flex items-center justify-center">
                    {displayPhotoUrl ? (
                      <img src={displayPhotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handlePhotoSelect}
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {displayPhotoUrl
                        ? t('lms.student.profile.photoReplace') || 'Заменить фото'
                        : t('lms.student.profile.photoUpload') || 'Загрузить фото'}
                    </button>
                    {(displayPhotoUrl || user.profile_photo_url) && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-4 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('lms.student.profile.photoRemove') || 'Удалить фото'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.fullName') || 'ФИО'} *
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t('lms.student.profile.fullNamePlaceholder') || 'Введите ваше ФИО'}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.email') || 'Email'}
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t('lms.student.profile.emailPlaceholder') || 'your@email.com'}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.phone') || 'Телефон'} *
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t('forms.login.phonePlaceholder')}
                  />
                </div>
                {phoneChanged && (
                  <p className="text-xs text-blue-600 mt-1">
                    {t('lms.student.profile.phoneChangeWarning') || 'При изменении телефона потребуется подтверждение SMS кодом'}
                  </p>
                )}
              </div>

              {/* IIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.iin') || 'ИИН'}
                </label>
                <input
                  type="text"
                  name="iin"
                  value={formData.iin}
                  onChange={handleChange}
                  maxLength={12}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="000000000000"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.city') || 'Город'}
                </label>
                <div className="relative">
                  <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t('lms.student.profile.cityPlaceholder') || 'Введите город'}
                  />
                </div>
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('lms.student.profile.organization') || 'Компания'}
                </label>
                <div className="relative">
                  <Building2 className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t('lms.student.profile.organizationPlaceholder') || 'Название компании'}
                  />
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-2" />
                  {t('lms.student.profile.language') || 'Язык интерфейса'}
                </label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {languages.map(lang => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
                  ))}
                </select>
              </div>

              {/* Password Change Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('lms.student.profile.changePassword') || 'Изменить пароль'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t('lms.student.profile.changePasswordHint') || 'Оставьте поля пустыми, если не хотите менять пароль'}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('lms.student.profile.newPassword') || 'Новый пароль'}
                    </label>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        minLength={8}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('lms.student.profile.confirmPassword') || 'Подтвердите пароль'}
                    </label>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        minLength={8}
                        className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-4">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading || sendingSMS}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('common.cancel') || 'Отмена'}
              </button>
              <button
                type="submit"
                disabled={loading || sendingSMS}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {sendingSMS ? 'Отправка SMS...' : loading ? (t('common.saving') || 'Сохранение...') : (t('common.save') || 'Сохранить')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showSMSVerification && (
        <SMSVerification
          phone={formData.phone || ''}
          onVerified={handleSMSVerified}
          onCancel={() => setShowSMSVerification(false)}
          title={t('lms.student.profile.smsVerificationTitle') || 'Подтверждение изменения телефона'}
          description={t('lms.student.profile.smsVerificationDescription', { phone: formData.phone }) || `На номер ${formData.phone} отправлен SMS код. Введите его для подтверждения изменения телефона.`}
          purpose="verification"
          onResend={handleResendSMS}
        />
      )}
    </>
  );
}
