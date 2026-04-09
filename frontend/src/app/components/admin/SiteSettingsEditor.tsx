import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Save } from 'lucide-react';
import { settingsService, SiteConfig } from '../../services/settings';
import { toast } from 'sonner';

export function SiteSettingsEditor() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requireSmsOnRegistration, setRequireSmsOnRegistration] = useState(true);
  const [requireCourseEnrollmentRequest, setRequireCourseEnrollmentRequest] = useState(true);
  const [requireTestEnrollmentRequest, setRequireTestEnrollmentRequest] = useState(true);
  const [defaultProtocolSignMethod, setDefaultProtocolSignMethod] = useState<'both' | 'sms' | 'eds' | 'none'>('both');
  const [requireSmsForCourseCompletion, setRequireSmsForCourseCompletion] = useState(true);
  const [requireSmsForTestCompletion, setRequireSmsForTestCompletion] = useState(true);

  useEffect(() => {
    settingsService.getSettings()
      .then((data) => {
        setConfig(data);
        setRequireSmsOnRegistration(data.require_sms_on_registration);
        setRequireCourseEnrollmentRequest(data.require_course_enrollment_request ?? true);
        setRequireTestEnrollmentRequest(data.require_test_enrollment_request ?? true);
        setDefaultProtocolSignMethod((data.default_protocol_sign_method as 'both' | 'sms' | 'eds' | 'none') || 'both');
        setRequireSmsForCourseCompletion(data.require_sms_for_course_completion ?? true);
        setRequireSmsForTestCompletion(data.require_sms_for_test_completion ?? true);
      })
      .catch(() => toast.error(t('admin.settings.loadError') || 'Ошибка загрузки настроек'))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await settingsService.updateSettings({
        require_sms_on_registration: requireSmsOnRegistration,
        require_course_enrollment_request: requireCourseEnrollmentRequest,
        require_test_enrollment_request: requireTestEnrollmentRequest,
        default_protocol_sign_method: defaultProtocolSignMethod,
        require_sms_for_course_completion: requireSmsForCourseCompletion,
        require_sms_for_test_completion: requireSmsForTestCompletion,
      });
      setConfig(updated);
      toast.success(t('admin.settings.saveSuccess') || 'Настройки сохранены');
    } catch (error: any) {
      toast.error(error.message || t('admin.settings.saveError') || 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {t('admin.settings.title') || 'Настройки системы'}
          </h2>
          <p className="text-sm text-gray-500">
            {t('admin.settings.description') || 'При включении пользователи должны подтвердить номер телефона SMS-кодом при регистрации'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={requireSmsOnRegistration}
              onChange={(e) => setRequireSmsOnRegistration(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                {t('admin.settings.requireSmsOnRegistration') || 'Требовать SMS при регистрации'}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.settings.requireSmsHint') || 'При включении пользователи должны подтвердить номер телефона SMS-кодом при регистрации'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-start gap-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={requireCourseEnrollmentRequest}
              onChange={(e) => setRequireCourseEnrollmentRequest(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                {t('admin.settings.requireCourseEnrollmentRequest') || 'Требовать запрос администратора для доступа к курсам'}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.settings.requireCourseEnrollmentRequestHint') || 'При включении студенты должны подать запрос, администратор одобряет доступ'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-start gap-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={requireTestEnrollmentRequest}
              onChange={(e) => setRequireTestEnrollmentRequest(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                {t('admin.settings.requireTestEnrollmentRequest') || 'Требовать запрос администратора для доступа к тестам'}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.settings.requireTestEnrollmentRequestHint') || 'При включении студенты должны подать запрос или получить назначение от администратора'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-start gap-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={requireSmsForCourseCompletion}
              onChange={(e) => setRequireSmsForCourseCompletion(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                {t('admin.settings.requireSmsForCourseCompletion') || 'Требовать SMS для завершения курса'}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.settings.requireSmsForCourseCompletionHint') || 'При включении для завершения курса и создания протокола нужен код из SMS'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex items-start gap-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={requireSmsForTestCompletion}
              onChange={(e) => setRequireSmsForTestCompletion(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">
                {t('admin.settings.requireSmsForTestCompletion') || 'Требовать SMS для завершения отдельного теста'}
              </span>
              <p className="text-sm text-gray-500 mt-1">
                {t('admin.settings.requireSmsForTestCompletionHint') || 'При включении после сдачи теста из программы обучения нужен код из SMS для протокола'}
              </p>
            </div>
          </label>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <label className="block text-sm font-medium text-gray-700">
            {t('admin.settings.defaultProtocolSignMethod') || 'Способ подписания протоколов'}
          </label>
          <select
            value={defaultProtocolSignMethod}
            onChange={(e) => setDefaultProtocolSignMethod(e.target.value as 'both' | 'sms' | 'eds' | 'none')}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="both">{t('admin.settings.protocolSignBoth') || 'SMS и ЭЦП'}</option>
            <option value="sms">{t('admin.settings.protocolSignSms') || 'Только SMS'}</option>
            <option value="eds">{t('admin.settings.protocolSignEds') || 'Только ЭЦП'}</option>
            <option value="none">{t('admin.settings.protocolSignNone') || 'Без SMS и ЭЦП'}</option>
          </select>
          <p className="text-sm text-gray-500">
            {t('admin.settings.defaultProtocolSignMethodHint') || 'Способ подписания протоколов для членов ЭК'}
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? (t('common.saving') || 'Сохранение...') : (t('common.save') || 'Сохранить')}
          </button>
        </div>
      </div>
    </div>
  );
}
