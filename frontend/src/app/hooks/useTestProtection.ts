import { useEffect, useRef, useState, useCallback } from 'react';

export interface TestProtectionResult {
  violationCount: number;
  violationType: string | null;
  resetViolations: () => void;
}

export function useTestProtection(enabled: boolean = true): TestProtectionResult {
  const [violationCount, setViolationCount] = useState(0);
  const [violationType, setViolationType] = useState<string | null>(null);
  const violationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleViolation = useCallback((type: string) => {
    // Очищаем предыдущий таймаут, если есть
    if (violationTimeoutRef.current) {
      clearTimeout(violationTimeoutRef.current);
    }

    // Устанавливаем тип нарушения
    setViolationType(type);

    // Увеличиваем счетчик нарушений
    setViolationCount(prev => {
      const newCount = prev + 1;
      return newCount;
    });

    // Сбрасываем тип нарушения через 2 секунды
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
    if (!enabled) return;

    // Блокировка Print Screen и комбинаций
    const handleKeyDown = (e: KeyboardEvent) => {
      // Print Screen (код 44)
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      // Alt + Print Screen
      if (e.altKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      // Windows + Print Screen
      if (e.metaKey && (e.key === 'PrintScreen' || e.keyCode === 44)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      // Win + Shift + S (Windows Snipping Tool)
      if (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }

      // Блокировка горячих клавиш
      const blockedKeys: { [key: string]: string } = {
        'F12': 'devtools',
        'F5': 'refresh',
        'F11': 'fullscreen',
      };

      if (blockedKeys[e.key] || blockedKeys[`F${e.keyCode}`]) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('hotkey');
        return false;
      }

      // Ctrl + комбинации (сначала проверяем сложные комбинации с Shift)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        
        // Ctrl+Shift+I (DevTools) - приоритетная проверка
        if (e.shiftKey && (key === 'i' || e.keyCode === 73)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        // Ctrl+Shift+C (Element Inspector)
        if (e.shiftKey && (key === 'c' || e.keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        // Ctrl+Shift+J (Console)
        if (e.shiftKey && (key === 'j' || e.keyCode === 74)) {
          e.preventDefault();
          e.stopPropagation();
          handleViolation('devtools');
          return false;
        }

        // Простые Ctrl+комбинации (без Shift)
        if (!e.shiftKey) {
          // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+S, Ctrl+P, Ctrl+U
          if (['c', 'v', 'x', 'a', 's', 'p', 'u'].includes(key)) {
            e.preventDefault();
            e.stopPropagation();
            handleViolation('copy');
            return false;
          }
        }
      }

      // Дополнительная проверка для Win+Shift+S (на случай, если предыдущая не сработала)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        handleViolation('screenshot');
        return false;
      }
    };

    // Блокировка копирования через события
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

    // Блокировка контекстного меню
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleViolation('contextmenu');
      return false;
    };

    // Блокировка выделения текста
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

    // Обнаружение скринкастинга через Screen Capture API
    const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = function(...args) {
        handleViolation('screencast');
        return Promise.reject(new Error('Screen capture is not allowed during test'));
      };
    }

    // Обнаружение потери фокуса (может указывать на переключение окна)
    const handleBlur = () => {
      // Не считаем потерю фокуса нарушением, так как это может быть случайным
      // Но можно добавить логику, если нужно
    };

    // Обнаружение изменения размера окна (может указывать на скриншот)
    let lastWindowSize = { width: window.innerWidth, height: window.innerHeight };
    const handleResize = () => {
      const currentSize = { width: window.innerWidth, height: window.innerHeight };
      // Резкое изменение размера может указывать на скриншот
      // Но это может быть ложным срабатыванием, поэтому не используем
    };

    // Добавляем обработчики событий
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyDown, true);
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('dragstart', handleDragStart, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);

    // Проверка активных потоков захвата экрана
    const checkScreenCapture = async () => {
      try {
        const streams = await navigator.mediaDevices.enumerateDevices();
        // Проверяем активные потоки через getTracks
        // Это не идеальный метод, но может помочь обнаружить некоторые случаи
      } catch (error) {
        // Игнорируем ошибки
      }
    };

    // Периодическая проверка (каждые 5 секунд)
    const checkInterval = setInterval(checkScreenCapture, 5000);

    // Очистка при размонтировании
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyDown, true);
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      clearInterval(checkInterval);

      // Восстанавливаем оригинальный метод
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }

      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current);
      }
    };
  }, [enabled, handleViolation]);

  return {
    violationCount,
    violationType,
    resetViolations,
  };
}
