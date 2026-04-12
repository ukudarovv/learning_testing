import { useState, useCallback, useRef } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useTranslation } from 'react-i18next';
import { RotateCcw, RotateCw } from 'lucide-react';
import { getCroppedImageBlob, blobToProfilePhotoFile } from '../../utils/canvasCrop';

type ProfilePhotoEditorModalProps = {
  imageSrc: string;
  originalFileName: string;
  onApply: (file: File) => void;
  onCancel: () => void;
};

export function ProfilePhotoEditorModal({
  imageSrc,
  originalFileName,
  onApply,
  onCancel,
}: ProfilePhotoEditorModalProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pixelsRef = useRef<Area | null>(null);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    pixelsRef.current = pixels;
    setCroppedAreaPixels(pixels);
  }, []);

  const handleApply = async () => {
    const pixels = pixelsRef.current ?? croppedAreaPixels;
    if (!pixels) {
      setError(t('common.photoEditorError'));
      return;
    }
    setError(null);
    setProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, pixels, rotation, 'image/jpeg', 0.92);
      const file = blobToProfilePhotoFile(blob, originalFileName);
      onApply(file);
    } catch {
      setError(t('common.photoEditorError'));
    } finally {
      setProcessing(false);
    }
  };

  const rotLeft = () => setRotation((r) => r - 90);
  const rotRight = () => setRotation((r) => r + 90);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-editor-title"
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 id="photo-editor-title" className="text-lg font-semibold text-gray-900">
            {t('common.photoEditorTitle')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-800 text-sm"
            disabled={processing}
          >
            {t('common.close')}
          </button>
        </div>

        <p className="px-4 pt-3 text-xs text-gray-600 shrink-0">{t('common.photoEditorHint')}</p>

        <div className="relative w-full h-[min(52vh,320px)] bg-gray-900 mt-3 mx-4 rounded-lg overflow-hidden shrink-0">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3 space-y-3 shrink-0">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('common.photoEditorZoom')}</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-blue-600 h-2"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 shrink-0">{t('common.photoEditorRotate')}</span>
            <button
              type="button"
              onClick={rotLeft}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={processing}
            >
              <RotateCcw className="w-4 h-4" />
              90°
            </button>
            <button
              type="button"
              onClick={rotRight}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={processing}
            >
              <RotateCw className="w-4 h-4" />
              90°
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing || !croppedAreaPixels}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? t('common.saving') : t('common.photoEditorApply')}
          </button>
        </div>
      </div>
    </div>
  );
}
