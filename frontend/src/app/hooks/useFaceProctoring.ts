import { useEffect, useRef, type RefObject } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_BASE =
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

/** Ниже — «слабый» кадр: не сбрасываем пропуски и не штрафуем за позу/совпадение (иначе мерцание = 3 штрафа). */
const MIN_RELIABLE_DETECTION_SCORE = 0.58;
/** Сколько подряд надёжных кадров ждём, прежде чем включать штрафы поза/несовпадение. */
const STABLE_RELIABLE_TICKS_BEFORE_PENALTIES = 10;
/** После снятия паузы «лицо не в кадре» не штрафовать за позу/совпадение (камера и оценка позы нестабильны). */
const GRACE_MS_AFTER_FACE_VISIBLE = 25_000;

const MATCH_DISTANCE_MAX = 0.55;
const YAW_ABS_MAX = 0.38;
const PITCH_MIN = -0.14;
const PITCH_MAX = 0.45;
const TICK_MS = 700;
const VIOLATION_COOLDOWN_MS = 7000;
const FACE_MISS_FRAMES = 4;

let modelsLoadPromise: Promise<void> | null = null;

function ensureModelsLoaded(): Promise<void> {
  if (!modelsLoadPromise) {
    modelsLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ]).then(() => undefined);
  }
  return modelsLoadPromise;
}

function headPoseFromLandmarks(landmarks: faceapi.FaceLandmarks68): { yaw: number; pitch: number } {
  const pts = landmarks.positions;
  const nose = pts[30];
  const le = pts[36];
  const re = pts[45];
  const eyeMidX = (le.x + re.x) / 2;
  const eyeMidY = (le.y + re.y) / 2;
  const faceW = Math.hypot(re.x - le.x, re.y - le.y) || 1;
  const yaw = (nose.x - eyeMidX) / faceW;
  const pitch = (nose.y - eyeMidY) / faceW;
  return { yaw, pitch };
}

async function imageFromUrl(url: string): Promise<HTMLImageElement> {
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Failed to load reference image: ${res.status}`);
  }
  const blob = await res.blob();
  return faceapi.bufferToImage(blob);
}

export interface UseFaceProctoringOptions {
  enabled: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  referenceImageUrl: string | null | undefined;
  /** Штрафные нарушения (счётчик 3/3): только несовпадение лица; отворот — через onBadPose без штрафа */
  reportViolation: (type: 'face_mismatch') => void;
  /** Лицо не в кадре — без штрафа: пауза теста на стороне UI */
  onFaceHidden?: () => void;
  /** Отворот / «не смотрите в камеру» — без штрафа: пауза и напоминание, как при отсутствии лица */
  onBadPose?: () => void;
  /** Лицо снова в кадре / поза нормализовалась — снять паузу */
  onFaceVisible?: () => void;
}

/**
 * Анализ лица с камеры: присутствие, ориентация к камере, сходство с фото профиля (face-api.js).
 */
export function useFaceProctoring({
  enabled,
  videoRef,
  referenceImageUrl,
  reportViolation,
  onFaceHidden,
  onBadPose,
  onFaceVisible,
}: UseFaceProctoringOptions): void {
  const refDescriptorRef = useRef<Float32Array | null>(null);
  const refReadyRef = useRef(false);
  const lastViolationAtRef = useRef<Record<string, number>>({});
  const missStreakRef = useRef(0);
  const stableReliableTicksRef = useRef(0);
  const reportViolationRef = useRef(reportViolation);
  reportViolationRef.current = reportViolation;
  const onFaceHiddenRef = useRef(onFaceHidden);
  const onBadPoseRef = useRef(onBadPose);
  const onFaceVisibleRef = useRef(onFaceVisible);
  onFaceHiddenRef.current = onFaceHidden;
  onBadPoseRef.current = onBadPose;
  onFaceVisibleRef.current = onFaceVisible;
  const pausedForMissingRef = useRef(false);
  const pausedForBadPoseRef = useRef(false);
  const penaltiesBlockedUntilRef = useRef(0);

  const canReport = (type: string): boolean => {
    const now = Date.now();
    const last = lastViolationAtRef.current[type] ?? 0;
    if (now - last < VIOLATION_COOLDOWN_MS) return false;
    lastViolationAtRef.current[type] = now;
    return true;
  };

  useEffect(() => {
    refDescriptorRef.current = null;
    refReadyRef.current = false;
    if (!enabled || !referenceImageUrl) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureModelsLoaded();
        if (cancelled) return;
        const img = await imageFromUrl(referenceImageUrl);
        if (cancelled) return;
        const det = await faceapi
          .detectSingleFace(img, DETECTOR_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (cancelled) return;
        if (det?.descriptor) {
          refDescriptorRef.current = det.descriptor;
          refReadyRef.current = true;
        }
      } catch (e) {
        console.warn('Face proctoring: reference image load failed', e);
        refReadyRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, referenceImageUrl]);

  useEffect(() => {
    if (!enabled) {
      missStreakRef.current = 0;
      stableReliableTicksRef.current = 0;
      penaltiesBlockedUntilRef.current = 0;
      let needVisible = false;
      if (pausedForMissingRef.current) {
        pausedForMissingRef.current = false;
        needVisible = true;
      }
      if (pausedForBadPoseRef.current) {
        pausedForBadPoseRef.current = false;
        needVisible = true;
      }
      if (needVisible) onFaceVisibleRef.current?.();
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const tick = async () => {
      const video = videoRef.current;
      if (!video || cancelled) return;
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

      try {
        await ensureModelsLoaded();
      } catch {
        return;
      }
      if (cancelled) return;

      let detection:
        | {
            detection: faceapi.FaceDetection;
            landmarks: faceapi.FaceLandmarks68;
            descriptor: Float32Array;
          }
        | undefined;

      try {
        detection = (await faceapi
          .detectSingleFace(video, DETECTOR_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptor()) as typeof detection;
      } catch {
        return;
      }

      const score = detection?.detection?.score ?? 0;
      const reliable = Boolean(detection && score >= MIN_RELIABLE_DETECTION_SCORE);

      // Нет надёжного лица — как «не в кадре»: пауза/напоминание, без штрафов за позу/совпадение.
      if (!reliable) {
        stableReliableTicksRef.current = 0;
        missStreakRef.current += 1;
        if (missStreakRef.current >= FACE_MISS_FRAMES && !pausedForMissingRef.current) {
          pausedForMissingRef.current = true;
          pausedForBadPoseRef.current = false;
          onFaceHiddenRef.current?.();
        }
        return;
      }

      missStreakRef.current = 0;
      if (pausedForMissingRef.current) {
        pausedForMissingRef.current = false;
        stableReliableTicksRef.current = 0;
        penaltiesBlockedUntilRef.current = Date.now() + GRACE_MS_AFTER_FACE_VISIBLE;
        onFaceVisibleRef.current?.();
      }

      stableReliableTicksRef.current += 1;
      if (stableReliableTicksRef.current < STABLE_RELIABLE_TICKS_BEFORE_PENALTIES) {
        return;
      }

      if (Date.now() < penaltiesBlockedUntilRef.current) {
        return;
      }

      const { yaw, pitch } = headPoseFromLandmarks(detection!.landmarks);
      if (Math.abs(yaw) > YAW_ABS_MAX || pitch < PITCH_MIN || pitch > PITCH_MAX) {
        if (!pausedForBadPoseRef.current) {
          pausedForBadPoseRef.current = true;
          onBadPoseRef.current?.();
        }
        return;
      }

      if (pausedForBadPoseRef.current) {
        pausedForBadPoseRef.current = false;
        onFaceVisibleRef.current?.();
      }

      const refDesc = refDescriptorRef.current;
      if (refReadyRef.current && refDesc) {
        const dist = faceapi.euclideanDistance(refDesc, detection!.descriptor);
        if (dist > MATCH_DISTANCE_MAX && canReport('face_mismatch')) {
          reportViolationRef.current('face_mismatch');
        }
      }
    };

    timer = setInterval(() => {
      void tick();
    }, TICK_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      missStreakRef.current = 0;
      stableReliableTicksRef.current = 0;
      penaltiesBlockedUntilRef.current = 0;
      let needVisible = false;
      if (pausedForMissingRef.current) {
        pausedForMissingRef.current = false;
        needVisible = true;
      }
      if (pausedForBadPoseRef.current) {
        pausedForBadPoseRef.current = false;
        needVisible = true;
      }
      if (needVisible) onFaceVisibleRef.current?.();
    };
  }, [enabled, videoRef]);
}
