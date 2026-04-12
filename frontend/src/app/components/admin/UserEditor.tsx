import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Save, Eye, EyeOff, RefreshCw, Camera, Trash2, User as UserIcon } from 'lucide-react';
import { User } from '../../types/lms';
import { useTranslation } from 'react-i18next';
import { smsService } from '../../services/smsService';
import { SMSVerification } from '../lms/SMSVerification';
import type { AdminUserPayload } from '../../services/users';
import { userCategoriesService } from '../../services/userCategories';
import type { UserCategory } from '../../types/lms';
import { formatRuKzPhoneInput, normalizeRuKzPhoneDigits } from '../../utils/phoneInput';
import { ProfilePhotoEditorModal } from '../shared/ProfilePhotoEditorModal';

interface UserEditorProps {
  user?: User;
  onSave: (user: AdminUserPayload) => void | Promise<void>;
  onCancel: () => void;
}

export function UserEditor({ user, onSave, onCancel }: UserEditorProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<User & { password?: string }>>(user || {
    fullName: '',
    email: '',
    phone: '',
    role: 'student',
    iin: '',
    city: '',
    organization: '',
    verified: true,
    language: 'ru',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [clearServerPhoto, setClearServerPhoto] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoEditorSrc, setPhotoEditorSrc] = useState<string | null>(null);
  const [photoEditorOriginalName, setPhotoEditorOriginalName] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [userCategoryOptions, setUserCategoryOptions] = useState<UserCategory[]>([]);
  const [selectedUserCategoryIds, setSelectedUserCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    return () => {
      if (photoEditorSrc) URL.revokeObjectURL(photoEditorSrc);
    };
  }, [photoEditorSrc]);

  const displayPhotoUrl = useMemo(() => {
    if (photoPreviewUrl) return photoPreviewUrl;
    if (!clearServerPhoto && user?.profile_photo_url) return user.profile_photo_url;
    return null;
  }, [photoPreviewUrl, clearServerPhoto, user?.profile_photo_url]);

  // Обновляем formData при изменении user (для редактирования)
  useEffect(() => {
    userCategoriesService
      .getList()
      .then(setUserCategoryOptions)
      .catch(() => setUserCategoryOptions([]));
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || user.fullName || '',
        email: user.email || '',
        phone: formatRuKzPhoneInput(user.phone || ''),
        role: user.role || 'student',
        iin: user.iin || '',
        city: user.city || '',
        organization: user.organization || '',
        verified: user.verified !== undefined ? user.verified : true,
        is_active: user.is_active !== undefined ? user.is_active : true,
        language: user.language || 'ru',
      });
      setSelectedUserCategoryIds(
        (user.user_categories || []).map((c) => Number(c.id))
      );
    } else {
      setSelectedUserCategoryIds([]);
    }
    setPendingPhotoFile(null);
    setClearServerPhoto(false);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoEditorSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoEditorOriginalName('');
  }, [user?.id]);

  // Отслеживаем изменение номера телефона
  useEffect(() => {
    if (user) {
      const originalPhone = normalizeRuKzPhoneDigits(user.phone || '');
      const newPhone = normalizeRuKzPhoneDigits(formData.phone || '');
      setPhoneChanged(originalPhone !== newPhone && newPhone !== '');
    } else {
      setPhoneChanged(false);
    }
  }, [formData.phone, user?.phone]);

  const roles = [
    { value: 'student', label: t('forms.login.studentRole') },
    { value: 'pdek_member', label: t('forms.login.pdekMemberRole') },
    { value: 'pdek_chairman', label: t('forms.login.pdekChairmanRole') },
    { value: 'admin', label: t('forms.login.adminRole') },
  ];

  const userCategoriesSorted = useMemo(() => {
    const byId = new Map(userCategoryOptions.map((c) => [String(c.id), c]));
    const depth = (id: string): number => {
      let d = 0;
      let cur = byId.get(id);
      let guard = 0;
      while (cur && cur.parent != null && cur.parent !== '' && guard < 64) {
        d += 1;
        cur = byId.get(String(cur.parent));
        guard += 1;
      }
      return d;
    };
    return [...userCategoryOptions].sort((a, b) => {
      const da = depth(String(a.id));
      const db = depth(String(b.id));
      if (da !== db) return da - db;
      return a.order - b.order || String(a.name).localeCompare(String(b.name));
    });
  }, [userCategoryOptions]);

  const toggleUserCategory = (id: number) => {
    setSelectedUserCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const languages = [
    { value: 'ru', label: t('header.russian') },
    { value: 'kz', label: t('header.kazakh') },
    { value: 'en', label: t('header.english') },
  ];

  const buildPhotoPayload = (): Pick<AdminUserPayload, 'profile_photo' | 'clear_profile_photo'> => {
    if (pendingPhotoFile) {
      return { profile_photo: pendingPhotoFile };
    }
    if (clearServerPhoto && user?.profile_photo_url) {
      return { clear_profile_photo: true };
    }
    return {};
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError(t('admin.users.profilePhotoInvalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('admin.users.profilePhotoTooLarge'));
      return;
    }
    setError('');
    setClearServerPhoto(false);
    setPhotoEditorOriginalName(file.name);
    setPhotoEditorSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handlePhotoEditorCancel = () => {
    setPhotoEditorSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoEditorOriginalName('');
  };

  const handlePhotoEditorApply = (editedFile: File) => {
    setPhotoEditorSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoEditorOriginalName('');
    setClearServerPhoto(false);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(editedFile);
    });
    setPendingPhotoFile(editedFile);
  };

  const handleRemovePhoto = () => {
    handlePhotoEditorCancel();
    setPendingPhotoFile(null);
    setPhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (user?.profile_photo_url) {
      setClearServerPhoto(true);
    }
  };

  // Генерация случайного пароля
  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({ ...formData, password });
    setGeneratedPassword(password);
    setShowPassword(true);
  };

  const handleSave = async () => {
    setError('');
    
    // Если редактируем существующего пользователя и номер изменился, требуется SMS верификация
    if (user && phoneChanged) {
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

    // Валидация обязательных полей
    if (!formData.email?.trim()) {
      setError(t('admin.users.emailRequired') || 'Email обязателен');
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        ...formData,
        ...buildPhotoPayload(),
        user_category_ids: selectedUserCategoryIds,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSMSVerified = async (code: string) => {
    setVerificationCode(code);
    setError('');
    if (saving) return;
    setSaving(true);
    try {
      const userDataWithCode = {
        ...formData,
        verification_code: code,
        ...buildPhotoPayload(),
        user_category_ids: selectedUserCategoryIds,
      };
      await onSave(userDataWithCode);
    } finally {
      setSaving(false);
    }
  };

  const handleResendSMS = async () => {
    try {
      setSendingSMS(true);
      setError('');
      await smsService.sendVerificationCode(formData.phone || '', 'verification');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки SMS кода.');
    } finally {
      setSendingSMS(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-3xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {user ? t('admin.users.editUser') : t('admin.users.addUser')}
          </h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-6">
            {/* Personal Info */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.users.personalData')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('lms.pdek.fullName')} *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={t('admin.users.fullNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('forms.login.phone')} *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: formatRuKzPhoneInput(e.target.value) });
                      setError('');
                    }}
                    placeholder="+77751234567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  {phoneChanged && user && (
                    <p className="text-xs text-blue-600 mt-1">
                      {t('admin.users.phoneChangeWarning') || 'При изменении телефона потребуется подтверждение SMS кодом'}
                    </p>
                  )}
                </div>

                {/* Поле пароля - только при создании нового пользователя */}
                {!user && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('forms.login.password')} <span className="text-gray-500 font-normal">({t('common.optional')})</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password || ''}
                          onChange={(e) => {
                            setFormData({ ...formData, password: e.target.value });
                            setGeneratedPassword(null);
                          }}
                          placeholder={t('admin.users.passwordPlaceholder')}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={generatePassword}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        title={t('admin.users.generatePassword')}
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('admin.users.generate')}
                      </button>
                    </div>
                    {generatedPassword && (
                      <p className="mt-2 text-sm text-green-600 font-medium">
                        ✓ {t('admin.users.passwordGenerated')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      {t('admin.users.passwordHint')}
                    </p>
                  </div>
                )}

                <div className="col-span-2 p-4 border border-gray-200 rounded-lg bg-gray-50/80">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Camera className="w-4 h-4 inline mr-2 align-text-bottom" />
                    {t('admin.users.profilePhotoSection')}
                  </label>
                  <p className="text-xs text-gray-600 mb-3">{t('admin.users.profilePhotoHint')}</p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300 shrink-0 flex items-center justify-center">
                      {displayPhotoUrl ? (
                        <img src={displayPhotoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-8 h-8 text-gray-400" />
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
                        className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-fit"
                      >
                        {displayPhotoUrl
                          ? t('admin.users.profilePhotoReplace')
                          : t('admin.users.profilePhotoUpload')}
                      </button>
                      {(displayPhotoUrl || user?.profile_photo_url) && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="px-3 py-2 text-sm text-red-700 border border-red-200 rounded-lg hover:bg-red-50 inline-flex items-center gap-1 w-fit"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('admin.users.profilePhotoRemove')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('lms.pdek.iin')}
                  </label>
                  <input
                    type="text"
                    value={formData.iin || ''}
                    onChange={(e) => setFormData({ ...formData, iin: e.target.value })}
                    placeholder={t('admin.users.iinPlaceholder')}
                    maxLength={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.users.city')}
                  </label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder={t('admin.users.cityPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.users.categoriesSection')}</h3>
              <p className="text-sm text-gray-600 mb-3">{t('admin.users.categoriesHint')}</p>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/80">
                {userCategoriesSorted.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('admin.users.categoriesEmpty')}</p>
                ) : (
                  userCategoriesSorted.map((c) => {
                    const byId = new Map(userCategoryOptions.map((x) => [String(x.id), x]));
                    let depth = 0;
                    let cur: UserCategory | undefined = byId.get(String(c.id));
                    let g = 0;
                    while (cur && cur.parent != null && cur.parent !== '' && g < 64) {
                      depth += 1;
                      cur = byId.get(String(cur.parent));
                      g += 1;
                    }
                    const pad = Math.min(depth, 8) * 14;
                    const cid = Number(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                        style={{ paddingLeft: pad }}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedUserCategoryIds.includes(cid)}
                          onChange={() => toggleUserCategory(cid)}
                        />
                        <span className="text-gray-800">{c.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Work Info */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">{t('admin.users.workplace')}</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('forms.register.company')}
                  </label>
                  <input
                    type="text"
                    value={formData.organization || formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value, company: e.target.value })}
                    placeholder={t('forms.register.companyPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.users.role')} *
                  </label>
                  <select
                    value={formData.role || 'student'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('admin.users.interfaceLanguage')}
                  </label>
                  <select
                    value={formData.language || 'ru'}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {languages.map(lang => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.verified}
                      onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{t('admin.users.accountVerified')}</span>
                  </label>
                </div>

                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active !== undefined ? formData.is_active : true}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">{t('common.active')}</span>
                  </label>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={sendingSMS || saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {sendingSMS ? (t('admin.users.sendingSMS') || 'Отправка SMS...') : saving ? (t('common.saving') || 'Сохранение...') : t('common.save')}
          </button>
        </div>
      </div>

      {photoEditorSrc && (
        <ProfilePhotoEditorModal
          imageSrc={photoEditorSrc}
          originalFileName={photoEditorOriginalName || 'photo.jpg'}
          onCancel={handlePhotoEditorCancel}
          onApply={handlePhotoEditorApply}
        />
      )}

      {showSMSVerification && (
        <SMSVerification
          phone={formData.phone || ''}
          onVerified={handleSMSVerified}
          onCancel={() => {
            setShowSMSVerification(false);
            setVerificationCode(null);
          }}
          title={t('admin.users.smsVerificationTitle') || 'Подтверждение изменения телефона'}
          description={t('admin.users.smsVerificationDescription', { phone: formData.phone }) || `На номер ${formData.phone} отправлен SMS код. Введите его для подтверждения изменения телефона.`}
          purpose="verification"
          onResend={handleResendSMS}
        />
      )}
    </div>
  );
}
