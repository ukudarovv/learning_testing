import { useState, useRef, useCallback } from 'react';

/** Пресеты: камера (640×480) vs экран (1080p @ 15 FPS после applyConstraints). */
export type RecordingProfile = 'camera' | 'screen';

const CAMERA_VIDEO_BITRATE = 1_000_000;
const SCREEN_VIDEO_BITRATE = 2_250_000;
const DATA_TIMESLICE_MS = 2000;

function pickRecorderMimeType(): string | undefined {
  if (!MediaRecorder.isTypeSupported) return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return undefined;
}

function buildRecorderOptions(profile: RecordingProfile): MediaRecorderOptions {
  const mimeType = pickRecorderMimeType();
  const videoBitsPerSecond =
    profile === 'screen' ? SCREEN_VIDEO_BITRATE : CAMERA_VIDEO_BITRATE;
  const options: MediaRecorderOptions = { videoBitsPerSecond };
  if (mimeType) {
    options.mimeType = mimeType;
  }
  return options;
}

interface UseVideoRecorderReturn {
  isRecording: boolean;
  startRecording: (stream: MediaStream) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  recordingTime: number;
}

export function useVideoRecorder(profile: RecordingProfile = 'camera'): UseVideoRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(
    async (stream: MediaStream) => {
      try {
        setError(null);
        chunksRef.current = [];
        streamRef.current = stream;

        if (!window.MediaRecorder) {
          throw new Error('MediaRecorder API не поддерживается в этом браузере');
        }

        const options = buildRecorderOptions(profile);
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onerror = (event: Event) => {
          console.error('MediaRecorder error:', event);
          setError('Ошибка при записи видео');
          setIsRecording(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        };

        mediaRecorder.onstop = () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setRecordingTime(0);
        };

        mediaRecorder.start(DATA_TIMESLICE_MS);
        setIsRecording(true);
        setRecordingTime(0);

        timerRef.current = window.setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Не удалось начать запись видео';
        console.error('Error starting recording:', err);
        setError(message);
        setIsRecording(false);
      }
    },
    [profile]
  );

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || 'video/webm',
        });

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        setRecordingTime(0);
        chunksRef.current = [];
        mediaRecorderRef.current = null;

        resolve(blob);
      };

      mediaRecorder.stop();
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    error,
    recordingTime,
  };
}
