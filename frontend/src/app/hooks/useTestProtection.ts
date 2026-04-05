import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';

export interface TestProtectionResult {
  violationCount: number;
  violationType: string | null;
  resetViolations: () => void;
  /** Сообщить о нарушении (например контроль лица) — увеличивает общий счётчик */
  reportViolation: (type: string) => void;
}

export interface UseTestProtectionOptions {
  /** Элемент, переводимый в полноэкранный режим — для отслеживания выхода из fullscreen */
  fullscreenContainerRef?: RefObject<HTMLElement | null>;
}

/** Запрос полноэкранного режима для контейнера теста (нужен пользовательский жест). Возвращает true при успехе. */
export async function requestTestFullscreen(element: HTMLElement): Promise<boolean> {
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return true;
    }
    const el = element as HTMLElement & {
      webkitRequestFullscreen?: () => void;
      mozRequestFullScreen?: () => void;
    };
    if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return true;
    }
    if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function useTestProtection(
  enabled: boolean = true,
  options?: UseTestProtectionOptions
): TestProtectionResult {
  const fullscreenContainerRef = options?.fullscreenContainerRef;
  const [violationCount, setViolationCount] = useState(0);
  const [violationType, setViolationType] = useState<string | null>(null);
  const violationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasInTestFullscreenRef = useRef(false);

  const handleViolation = useCallback((type: string) => {
    if (violationTimeoutRef.current) {
      clearTimeout(violationTimeoutRef.current);
    }

    setViolationType(type);

    setViolationCount((prev) => prev + 1);

    violationTimeoutRef.current = setTimeout(() => {
      setViolationType(null);
    }, 2000);
  }, []);

  const resetViolations = useCallback(() => {
    setViolationCount(0);
    setViolationType(null);
    if (violationTimeoutRef.current) {
      clearTimeout(violationTimeoutRef.current);
      violationTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      wasInTestFullscreenRef.current = false;
      return;
    }

    const getFullscreenElement = (): Element | null => {
      const d = document as Document & { webkitFullscreenElement?: Element | null };
      return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
    };

    const isOurFullscreenElement = (el: Element | null): boolean => {
      const target = fullscreenContainerRef?.current;
      if (!el || !target) return false;
      return el === target || target.contains(el);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('tab_switch');
      }
    };

    const handleFullscreenChange = () => {
      const el = getFullscreenElement();
      if (el && isOurFullscreenElement(el)) {
        wasInTestFullscreenRef.current = true;
        return;
      }
      if (!el && wasInTestFullscreenRef.current) {
        wasInTestFullscreenRef.current = false;
        handleViolation('fullscreen_exit');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      if (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      if (e.metaKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      if (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'F4' || e.keyCode === 115)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('hotkey');
        return false;
      }

      const blockedKeys: { [key: string]: boolean } = {
        F12: true,
        F5: true,
        F11: true,
      };

      if (blockedKeys[e.key] || blockedKeys[`F${e.keyCode}`]) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation(e.key === 'F12' || e.keyCode === 123 ? 'devtools' : 'hotkey');
        return false;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();

        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('hotkey');
          return false;
        }

        if (!e.shiftKey) {
          if (['w', 't', 'n'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            handleViolation('hotkey');
            return false;
          }
        } else {
          if (['t', 'n'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            handleViolation('hotkey');
            return false;
          }
        }

        if (!e.shiftKey) {
          if (
            e.code === 'Equal' ||
            e.code === 'Minus' ||
            e.code === 'NumpadAdd' ||
            e.code === 'NumpadSubtract' ||
            e.code === 'Digit0' ||
            e.code === 'Numpad0'
          ) {
            e.preventDefault();
            e.stopPropagation();
            handleViolation('hotkey');
            return false;
          }
        }

        if (e.shiftKey && (key === 'i' || e.keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        if (e.shiftKey && (key === 'c' || e.keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        if (e.shiftKey && (key === 'j' || e.keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        if (!e.shiftKey) {
          if (['c', 'v', 'x', 'a', 's', 'p', 'u'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            handleViolation('copy');
            return false;
          }
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleViolation('copy');
      return false;
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleViolation('copy');
      return false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleViolation('copy');
      return false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleViolation('contextmenu');
      return false;
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('hotkey');
      }
    };

    const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = function (..._args) {
        handleViolation('screencast');
        return Promise.reject(new Error('Screen capture is not allowed during test'));
      };
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyDown, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyDown, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('wheel', handleWheel, { capture: true });

      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }

      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current);
      }
    };
  }, [enabled, handleViolation, fullscreenContainerRef]);

  return {
    violationCount,
    violationType,
    resetViolations,
    reportViolation: handleViolation,
  };
}
