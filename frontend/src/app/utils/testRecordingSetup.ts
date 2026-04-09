/** Захват экрана: не выше 1080p и 15 FPS. */
export const SCREEN_CAPTURE_MAX_WIDTH = 1920;
export const SCREEN_CAPTURE_MAX_HEIGHT = 1080;
export const SCREEN_CAPTURE_MAX_FPS = 15;

export const PICK_BROWSER_TAB_ERROR = 'PICK_BROWSER_TAB';

export async function applyScreenCaptureConstraints(track: MediaStreamTrack): Promise<void> {
  try {
    await track.applyConstraints({
      width: { max: SCREEN_CAPTURE_MAX_WIDTH },
      height: { max: SCREEN_CAPTURE_MAX_HEIGHT },
      frameRate: { max: SCREEN_CAPTURE_MAX_FPS },
    });
  } catch (e) {
    console.warn('Screen track applyConstraints failed:', e);
  }
}

export async function acquireCameraStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
    },
    audio: true,
  });
}

/**
 * Демонстрация вкладки браузера с тестом + даунскейл до 1080p / 15 FPS.
 */
export async function acquireTabScreenStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'browser' } as MediaTrackConstraints & { displaySurface?: string },
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);

  const track = stream.getVideoTracks()[0];
  const displaySurface = (track?.getSettings?.() as { displaySurface?: string })?.displaySurface;

  if (displaySurface && displaySurface !== 'browser') {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(PICK_BROWSER_TAB_ERROR);
  }

  if (track) {
    await applyScreenCaptureConstraints(track);
  }

  return stream;
}
