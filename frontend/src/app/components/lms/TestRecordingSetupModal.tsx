import { useState, useEffect } from 'react';
import { Camera, Monitor, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface RecordingStreams {
  video?: MediaStream | null;
  screen?: MediaStream | null;
}

interface TestRecordingSetupModalProps {
  isOpen: boolean;
  requiresVideoRecording: boolean;
  requiresScreenRecording: boolean;
  onClose: () => void;
  onDenied: () => void;
  onComplete: (streams: RecordingStreams) => void;
}

export function TestRecordingSetupModal({
  isOpen,
  requiresVideoRecording,
  requiresScreenRecording,
  onClose,
  onDenied,
  onComplete,
}: TestRecordingSetupModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'camera' | 'screen'>('camera');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingVideoStream, setPendingVideoStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(requiresVideoRecording ? 'camera' : 'screen');
    setError(null);
    setPendingVideoStream(null);
  }, [isOpen, requiresVideoRecording, requiresScreenRecording]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    pendingVideoStream?.getTracks().forEach((tr) => tr.stop());
    setPendingVideoStream(null);
    setError(null);
    setStep(requiresVideoRecording ? 'camera' : 'screen');
    onClose();
  };

  const handleRequestCamera = async () => {
    setIsRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: true,
      });
      if (requiresScreenRecording) {
        setPendingVideoStream(stream);
        setStep('screen');
      } else {
        onComplete({ video: stream });
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      let errorMessage = t('lms.test.recordingSetup.cameraError') || 'Не удалось получить доступ к камере.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        errorMessage =
          t('lms.test.recordingSetup.cameraDenied') ||
          'Доступ к камере был отклонён. Разрешите доступ в настройках браузера.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        errorMessage = t('lms.test.recordingSetup.cameraNotFound') || 'Камера не найдена.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestScreen = async () => {
    setIsRequesting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      if (requiresVideoRecording) {
        onComplete({ video: pendingVideoStream ?? undefined, screen: stream });
      } else {
        onComplete({ screen: stream });
      }
      setPendingVideoStream(null);
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      let errorMessage = t('lms.test.recordingSetup.screenError') || 'Не удалось начать демонстрацию экрана.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        errorMessage =
          t('lms.test.recordingSetup.screenDenied') || 'Демонстрация экрана отклонена.';
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
      if (requiresVideoRecording && pendingVideoStream) {
        pendingVideoStream.getTracks().forEach((tr) => tr.stop());
        setPendingVideoStream(null);
        setStep('camera');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeny = () => {
    pendingVideoStream?.getTracks().forEach((tr) => tr.stop());
    setPendingVideoStream(null);
    setStep(requiresVideoRecording ? 'camera' : 'screen');
    onDenied();
  };

  const isCameraStep = step === 'camera' && requiresVideoRecording;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {t('lms.test.recordingSetup.title') || 'Настройка записи'}
          </h2>
          <button
            type="button"
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-8 py-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center ring-4 ring-red-100">
              {isCameraStep ? (
                <Camera className="w-12 h-12 text-red-600" />
              ) : (
                <Monitor className="w-12 h-12 text-red-600" />
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              {isCameraStep
                ? t('lms.test.recordingSetup.cameraHeading') || 'Видеозапись с камеры'
                : t('lms.test.recordingSetup.screenHeading') || 'Запись экрана'}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              {isCameraStep
                ? t('lms.test.recordingSetup.cameraBody') ||
                  'Для этого теста требуется запись с веб-камеры. Разрешите доступ к камере и микрофону.'
                : t('lms.test.recordingSetup.screenBody') ||
                  'Выберите экран или окно для записи. Не останавливайте демонстрацию до завершения теста.'}
            </p>
          </div>

          {requiresVideoRecording && requiresScreenRecording && (
            <p className="text-center text-xs text-gray-500 mb-4">
              {step === 'camera'
                ? t('lms.test.recordingSetup.stepCamera') || 'Шаг 1 из 2: камера'
                : t('lms.test.recordingSetup.stepScreen') || 'Шаг 2 из 2: экран'}
            </p>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={resetAndClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
          >
            {t('common.close') || 'Закрыть'}
          </button>
          <button
            type="button"
            onClick={isCameraStep ? handleRequestCamera : handleRequestScreen}
            disabled={isRequesting}
            className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {isRequesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('lms.test.recordingSetup.requesting') || 'Запрос...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                {isCameraStep
                  ? t('lms.test.recordingSetup.allowCamera') || 'Разрешить камеру'
                  : t('lms.test.recordingSetup.shareScreen') || 'Поделиться экраном'}
              </>
            )}
          </button>
        </div>
        <div className="px-6 pb-4">
          <button
            type="button"
            onClick={handleDeny}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            {t('lms.test.recordingSetup.cancelAttempt') || 'Отменить без прохождения'}
          </button>
        </div>
      </div>
    </div>
  );
}
