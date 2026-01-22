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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Продолжение теста</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          {/* Warning Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center ring-4 ring-red-100">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
          </div>

          {/* Main Message */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Требуется видеозапись
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed max-w-md mx-auto">
              Для прохождения этого теста требуется видеозапись. Ваше видео будет записано во время прохождения теста и сохранено для проверки.
            </p>
          </div>

          {/* Info Points */}
          <div className="bg-gray-50 rounded-lg p-5 mb-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">1</span>
              </div>
              <p className="text-sm text-gray-700">Видеозапись начнется после вашего разрешения</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">2</span>
              </div>
              <p className="text-sm text-gray-700">Запись будет продолжаться в течение всего теста</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">3</span>
              </div>
              <p className="text-sm text-gray-700">Видео будет автоматически сохранено при завершении теста</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-600 font-bold text-xs">4</span>
              </div>
              <p className="text-sm text-gray-700">Вы можете остановить запись только завершив тест</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
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

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
          >
            Закрыть
          </button>
          <button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
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
