import { useRef, useEffect, useState, useId, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

interface RecordingVideoPlayerProps {
  src: string;
  className?: string;
  style?: CSSProperties;
  /** className для элемента video (по умолчанию как в существующих плеерах) */
  videoClassName?: string;
  /** Как в прежних `<video style={{ maxHeight }}>` (например 400 или 600) */
  videoMaxHeight?: string | number;
  children?: ReactNode;
}

export function RecordingVideoPlayer({
  src,
  className = '',
  style,
  videoClassName = 'w-full h-full',
  videoMaxHeight,
  children,
}: RecordingVideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const selectId = useId();
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    setPlaybackRate(1);
  }, [src]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.playbackRate = playbackRate;
    }
  }, [playbackRate, src]);

  return (
    <div className={className} style={style}>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <label htmlFor={selectId} className="text-sm text-gray-600">
          {t('lms.video.playbackSpeed')}
        </label>
        <select
          id={selectId}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={playbackRate}
          onChange={(e) => setPlaybackRate(Number(e.target.value))}
          aria-label={t('lms.video.playbackSpeed')}
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate === 1 ? '1×' : `${rate}×`}
            </option>
          ))}
        </select>
      </div>
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          className={videoClassName}
          style={
            videoMaxHeight !== undefined
              ? { maxHeight: typeof videoMaxHeight === 'number' ? `${videoMaxHeight}px` : videoMaxHeight }
              : undefined
          }
        >
          {children}
        </video>
      </div>
    </div>
  );
}
