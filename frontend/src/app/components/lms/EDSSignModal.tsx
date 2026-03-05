import { useState, useEffect } from 'react';
import { Shield, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Protocol } from '../../types/lms';
import { protocolsService } from '../../services/protocols';

// NCALayer client - loaded dynamically for ESM/CommonJS compatibility
async function loadNCALayerClient() {
  const mod = await import('ncalayer-js-client');
  const NCALayerClient = (mod as Record<string, unknown>).NCALayerClient ?? (mod as { default?: Record<string, unknown> }).default?.NCALayerClient;
  if (!NCALayerClient || typeof NCALayerClient !== 'function') {
    throw new Error('NCALayerClient не найден в модуле');
  }
  return NCALayerClient as new () => {
    connect: () => Promise<string>;
    basicsSignCMS: (
      storage: string,
      data: string,
      params: string,
      signer: string
    ) => Promise<string>;
  };
}

interface EDSSignModalProps {
  protocol: Protocol;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Convert Blob to Base64 string */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g. "data:application/pdf;base64,")
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function EDSSignModal({ protocol, onSuccess, onCancel }: EDSSignModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'idle' | 'loading' | 'connecting' | 'signing' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => setStep('idle');
  }, []);

  const handleSign = async () => {
    setError(null);
    setStep('loading');

    try {
      // 1. Fetch protocol file
      const blob = await protocolsService.fetchProtocolFileForEDS(protocol.id);
      const documentBase64 = await blobToBase64(blob);

      if (!documentBase64) {
        throw new Error('Не удалось прочитать файл протокола');
      }

      setStep('connecting');

      // 2. Load and connect to NCALayer
      const NCALayerClientClass = await loadNCALayerClient();
      const ncalayerClient = new NCALayerClientClass();
      await ncalayerClient.connect();

      setStep('signing');

      // 3. Sign with NCALayer (static constants on NCALayerClient class)
      const Cls = NCALayerClientClass as unknown as {
        basicsStorageAll: string;
        basicsCMSParamsDetached: string;
        basicsSignerSignAny: string;
      };
      const signatureBase64 = await ncalayerClient.basicsSignCMS(
        Cls.basicsStorageAll,
        documentBase64,
        Cls.basicsCMSParamsDetached,
        Cls.basicsSignerSignAny
      );

      if (!signatureBase64 || typeof signatureBase64 !== 'string') {
        throw new Error('Подпись не получена от NCALayer');
      }

      setStep('uploading');

      // 4. Send signature to backend
      await protocolsService.signProtocolEDS(protocol.id, signatureBase64);

      setStep('success');
      setTimeout(() => onSuccess(), 800);
    } catch (err: unknown) {
      const e = err as { canceledByUser?: boolean; message?: string };
      if (e?.canceledByUser) {
        setError('Подписание отменено пользователем');
      } else {
        setError(e?.message || 'Ошибка подписания ЭЦП');
      }
      setStep('error');
    }
  };

  const isLoading = ['loading', 'connecting', 'signing', 'uploading'].includes(step);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl ring-4 ring-white ring-opacity-50 max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('lms.pdek.signEDS') || 'Подписать ЭЦП'}
          </h2>
          <p className="text-gray-600 text-sm mb-2">
            {t('lms.pdek.protocolNumber', { number: protocol.number })}
          </p>
          <p className="text-gray-500 text-sm">
            {t('lms.pdek.edsDescription') || 'Убедитесь, что NCALayer запущен. Выберите сертификат и введите PIN.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {step === 'success' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {t('lms.pdek.signSuccess') || 'Протокол успешно подписан'}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={isLoading}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSign}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {step === 'loading' && (t('lms.pdek.edsLoading') || 'Загрузка...')}
                {step === 'connecting' && (t('lms.pdek.edsConnecting') || 'Подключение к NCALayer...')}
                {step === 'signing' && (t('lms.pdek.edsSigning') || 'Выберите сертификат в NCALayer...')}
                {step === 'uploading' && (t('lms.pdek.edsUploading') || 'Отправка подписи...')}
              </>
            ) : (
              t('lms.pdek.signEDS') || 'Подписать ЭЦП'
            )}
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500 text-center">
          {t('lms.pdek.edsNotice') || 'Требуется установленный и запущенный NCALayer (pki.gov.kz)'}
        </p>
      </div>
    </div>
  );
}
