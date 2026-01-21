import { useState } from 'react';
import { Camera, X, AlertTriangle, CheckCircle } from 'lucide-react';

interface VideoPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: (stream: MediaStream) => void;
  onPermissionDenied: () => void;
}

export function VideoPermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
  onPermissionDenied,
}: VideoPermissionModalProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setError(null);

    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user', // Front camera
        },
        audio: true,
      });

      // Permission granted
      onPermissionGranted(stream);
    } catch (err: any) {
      console.error('Error requesting camera permission:', err);
      
      let errorMessage = 'Не удалось получить доступ к камере.';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Доступ к камере был отклонен. Пожалуйста, разрешите доступ к камере в настройках браузера.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Камера не найдена. Убедитесь, что камера подключена и доступна.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Камера уже используется другим приложением. Закройте другие приложения, использующие камеру.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'Требуемые настройки камеры не поддерживаются.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDeny = () => {
    onPermissionDenied();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Camera className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Видеозапись теста</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  Требуется видеозапись
                </p>
                <p className="text-xs text-yellow-700">
                  Для прохождения этого теста требуется видеозапись. Ваше видео будет записано во время прохождения теста и сохранено для проверки.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <p>• Видеозапись начнется после вашего разрешения</p>
            <p>• Запись будет продолжаться в течение всего теста</p>
            <p>• Видео будет автоматически сохранено при завершении теста</p>
            <p>• Вы можете остановить запись только завершив тест</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 mb-1">
                    Ошибка доступа к камере
                  </p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Закрыть
          </button>
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRequesting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Запрос доступа...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Разрешить запись
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
