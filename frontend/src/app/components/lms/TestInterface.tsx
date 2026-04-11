import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, Circle, AlertTriangle, ArrowLeft, ArrowRight, Flag, X, Camera, Monitor, RefreshCw, PauseCircle } from 'lucide-react';
import { Question, Answer } from '../../types/lms';
import { examsService } from '../../services/exams';
import { useVideoRecorder } from '../../hooks/useVideoRecorder';
import {
  acquireCameraStream,
  acquireTabScreenStream,
  PICK_BROWSER_TAB_ERROR,
} from '../../utils/testRecordingSetup';
import { useTestProtection, requestTestFullscreen } from '../../hooks/useTestProtection';
import { useFaceProctoring } from '../../hooks/useFaceProctoring';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUser } from '../../contexts/UserContext';

interface TestInterfaceProps {
  testId: string;
  attemptId?: number; // ID попытки для автосохранения
  title: string;
  timeLimit?: number; // минуты
  questions: Question[];
  requiresVideoRecording?: boolean; // Требуется ли видеозапись с камеры
  requiresScreenRecording?: boolean; // Требуется ли запись экрана
  onComplete: (answers: Answer[], timeSpent: number, videoBlob?: Blob, screenBlob?: Blob) => void;
  onCancel: () => void;
  inModal?: boolean; // Флаг для использования в модальном окне
  savedAnswers?: Record<string, any>; // Сохраненные ответы для восстановления
  startedAt?: string; // Время начала теста для восстановления таймера
}

export function TestInterface({ 
  testId,
  attemptId,
  title, 
  timeLimit, 
  questions,
  requiresVideoRecording = false,
  requiresScreenRecording = false,
  onComplete, 
  onCancel,
  inModal = false,
  savedAnswers,
  startedAt
}: TestInterfaceProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useUser();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recordingSetupBusy, setRecordingSetupBusy] = useState(false);
  const [recordingSetupError, setRecordingSetupError] = useState<string | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const { isRecording, startRecording, stopRecording, error: videoError, recordingTime } =
    useVideoRecorder('camera');
  const {
    isRecording: isScreenRecording,
    startRecording: startScreenRecording,
    stopRecording: stopScreenRecording,
    error: screenError,
    recordingTime: screenRecordingTime,
  } = useVideoRecorder('screen');

  const needsRecording = requiresVideoRecording || requiresScreenRecording;
  const needsProfilePhoto = Boolean(requiresVideoRecording && !user?.profile_photo_url);
  const [profilePhotoCheckLoading, setProfilePhotoCheckLoading] = useState(false);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [wasForceTerminated, setWasForceTerminated] = useState(false);
  const previousViolationCountRef = useRef(0);
  const testRootRef = useRef<HTMLDivElement>(null);
  const proctorVideoRef = useRef<HTMLVideoElement>(null);
  const [protectionRulesBarDismissed, setProtectionRulesBarDismissed] = useState(false);
  const [watermarkTick, setWatermarkTick] = useState(0);
  /** Пауза без штрафа: лицо не в кадре или отворот головы (таймер и ответы остановлены) */
  const [facePauseKind, setFacePauseKind] = useState<null | 'missing' | 'bad_pose'>(null);
  const faceMissingPaused = facePauseKind !== null;

  // Восстанавливаем сохраненные ответы, если они есть
  const initialAnswers = savedAnswers 
    ? questions.map(q => {
        const questionId = String(q.id);
        const savedAnswer = savedAnswers[questionId];
        return {
          questionId: q.id,
          answer: savedAnswer !== undefined && savedAnswer !== null ? savedAnswer : ''
        };
      })
    : questions.map(q => ({ questionId: q.id, answer: '' }));
  
  const [answers, setAnswers] = useState<Answer[]>(initialAnswers);
  
  // Восстанавливаем время, если тест был начат ранее
  const calculateTimeLeft = () => {
    if (!timeLimit) return null;
    if (startedAt) {
      const started = new Date(startedAt).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - started) / 1000);
      const totalSeconds = timeLimit * 60;
      const remaining = totalSeconds - elapsedSeconds;
      return remaining > 0 ? remaining : 0;
    }
    return timeLimit * 60;
  };
  
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft()); // секунды
  const [startTime] = useState(startedAt ? new Date(startedAt).getTime() : Date.now());
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  // Тест не начинается, пока не настроены все требуемые источники записи (камера и/или экран)
  const [testStarted, setTestStarted] = useState(() => {
    if (!requiresVideoRecording && !requiresScreenRecording) {
      return true;
    }
    return false;
  });
  
  // Защита от скриншотов и нарушений (после объявления testStarted)
  const { violationCount, violationType, resetViolations, reportViolation } = useTestProtection(true, {
    fullscreenContainerRef: testRootRef,
    /**
     * До фактического старта теста (камера/экран настроены): без слушателей blur/visibility и т.д.
     * Иначе штраф «tab_switch» при системном диалоге getDisplayMedia / выборе источника.
     */
    documentGuardsEnabled: testStarted,
    /** Подмена getDisplayMedia только после старта теста — иначе первый захват экрана для записи не сработает */
    blockExtraScreenCapture: testStarted,
  });

  /** Лицо не в кадре: только напоминание и пауза — не вызываем reportViolation, штрафы не начисляются */
  const handleFaceHidden = useCallback(() => {
    setFacePauseKind('missing');
    toast.message(t('lms.test.faceMissingPausedToast'), {
      description: t('lms.test.faceMissingToastNoPenalty'),
      duration: 8000,
    });
  }, [t]);

  /** Отворот от камеры: только напоминание и пауза — без штрафа и без счётчика 3/3 */
  const handleBadPose = useCallback(() => {
    setFacePauseKind('bad_pose');
    toast.message(t('lms.test.faceBadPosePausedToast'), {
      description: t('lms.test.faceMissingToastNoPenalty'),
      duration: 8000,
    });
  }, [t]);

  const handleFaceVisible = useCallback(() => {
    setFacePauseKind(null);
  }, []);

  useFaceProctoring({
    enabled:
      Boolean(
        requiresVideoRecording &&
          testStarted &&
          user?.profile_photo_url &&
          videoStream
      ),
    videoRef: proctorVideoRef,
    referenceImageUrl: user?.profile_photo_url,
    reportViolation,
    onFaceHidden: handleFaceHidden,
    onBadPose: handleBadPose,
    onFaceVisible: handleFaceVisible,
  });

  useEffect(() => {
    const el = proctorVideoRef.current;
    if (!el || !videoStream) return;
    el.srcObject = videoStream;
    el.muted = true;
    el.playsInline = true;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [videoStream]);

  useEffect(() => {
    if (!testStarted) return;
    const id = window.setInterval(() => setWatermarkTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [testStarted]);
  
  useEffect(() => {
    if (!needsRecording) {
      setTestStarted(true);
    }
  }, [needsRecording]);

  const stopStreamTracks = (stream: MediaStream | null | undefined) => {
    stream?.getTracks().forEach((tr) => tr.stop());
  };

  const handleStartRecordingSetup = async () => {
    setRecordingSetupBusy(true);
    setRecordingSetupError(null);
    let vStream: MediaStream | null = null;
    let sStream: MediaStream | null = null;
    try {
      if (requiresVideoRecording) {
        vStream = await acquireCameraStream();
        setVideoStream(vStream);
      }
      if (requiresScreenRecording) {
        sStream = await acquireTabScreenStream();
        setScreenStream(sStream);
      }
      if (vStream) {
        await startRecording(vStream);
      }
      if (sStream) {
        await startScreenRecording(sStream);
      }
      setTestStarted(true);
    } catch (err: unknown) {
      stopStreamTracks(vStream);
      stopStreamTracks(sStream);
      setVideoStream(null);
      setScreenStream(null);
      const e = err as { message?: string; name?: string };
      if (e.message === PICK_BROWSER_TAB_ERROR) {
        setRecordingSetupError(
          t('lms.test.recordingSetup.screenPickBrowserTab') ||
            'Пожалуйста, выберите «Вкладка браузера» с тестом (не «Весь экран» и не «Окно»).'
        );
        return;
      }
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setRecordingSetupError(
          t('lms.test.recordingSetup.permissionDenied') ||
            'Доступ к камере или экрану отклонён. Разрешите запись в настройках браузера.'
        );
        return;
      }
      if (e.message) {
        setRecordingSetupError(e.message);
        return;
      }
      setRecordingSetupError(
        t('lms.test.recordingSetup.startError') || 'Не удалось начать запись. Попробуйте ещё раз.'
      );
    } finally {
      setRecordingSetupBusy(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];

  // Таймер (не идёт во время паузы «лицо не в кадре»)
  useEffect(() => {
    if (timeLeft === null || !testStarted || faceMissingPaused) return;

    if (timeLeft <= 0) {
      handleSubmit().catch(console.error);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, testStarted, faceMissingPaused]);

  // Автосохранение
  useEffect(() => {
    if (!testStarted || faceMissingPaused) return;
    
    const saveAnswer = async () => {
      if (answers[currentQuestionIndex]?.questionId) {
        setAutoSaveStatus('saving');
        try {
          // Получаем attempt_id из localStorage или пропсов
          const savedProgress = localStorage.getItem(`test_${testId}_progress`);
          const progress = savedProgress ? JSON.parse(savedProgress) : null;
          const attemptId = progress?.attemptId;
          
          const currentAttemptId = attemptId || (() => {
            const savedProgress = localStorage.getItem(`test_${testId}_progress`);
            if (savedProgress) {
              const progress = JSON.parse(savedProgress);
              return progress.attemptId;
            }
            return null;
          })();
          
          if (currentAttemptId && answers[currentQuestionIndex]) {
            const answer = answers[currentQuestionIndex];
            const questionId = answer.questionId;
            const currentQuestion = questions[currentQuestionIndex];
            
            // Определяем тип ответа и формат для сохранения
            let answerValue: any = answer.answer;
            const answerData: any = { question: questionId };
            
            // Для multiple_choice сохраняем массив ID
            if (Array.isArray(answerValue)) {
              answerData.selected_options = answerValue;
            } 
            // Для yes_no и short_answer сохраняем текст
            else if (currentQuestion.type === 'yes_no' || currentQuestion.type === 'short_answer') {
              answerData.answer_text = answerValue;
            } 
            // Для single_choice сохраняем ID опции (строку)
            else {
              answerData.answer_text = answerValue;
            }
            
            await examsService.saveAnswer(Number(currentAttemptId), answerData);
            setAutoSaveStatus('saved');
          } else {
            // Fallback на localStorage если attempt_id нет
            localStorage.setItem(`test_${testId}_progress`, JSON.stringify({
              answers,
              currentQuestionIndex,
              timeLeft,
              attemptId: currentAttemptId,
            }));
            setAutoSaveStatus('saved');
          }
        } catch (error) {
          console.error('Auto-save error:', error);
          setAutoSaveStatus('error');
          // Fallback на localStorage
          localStorage.setItem(`test_${testId}_progress`, JSON.stringify({
            answers,
            currentQuestionIndex,
            timeLeft,
          }));
        }
      }
    };

    const saveTimer = setTimeout(saveAnswer, 1000);
    return () => clearTimeout(saveTimer);
  }, [answers, currentQuestionIndex, testId, testStarted, faceMissingPaused]);

  // Предотвращение случайного закрытия
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleTerminateTest = async (reasonOverride?: string) => {
    if (isTerminating) return;
    
    setIsTerminating(true);
    setWasForceTerminated(true);
    setShowViolationWarning(false);

    let reason = 'Нарушение правил прохождения теста';
    if (reasonOverride) {
      reason = reasonOverride;
    } else if (violationType === 'screenshot') {
      reason = 'Обнаружена попытка сделать скриншот';
    } else if (violationType === 'screencast') {
      reason = 'Обнаружена попытка записи экрана';
    } else if (violationType === 'copy') {
      reason = 'Обнаружена попытка копирования';
    } else if (violationType === 'hotkey' || violationType === 'devtools') {
      reason = 'Использование запрещенных горячих клавиш';
    } else if (violationType === 'contextmenu') {
      reason = 'Попытка открыть контекстное меню';
    } else if (violationType === 'tab_switch') {
      reason = 'Переключение вкладки или окна браузера';
    } else if (violationType === 'fullscreen_exit') {
      reason = 'Выход из полноэкранного режима во время теста';
    } else if (violationType === 'face_pose') {
      reason = 'Отворот от камеры (контроль экзамена)';
    } else if (violationType === 'face_mismatch') {
      reason = 'Лицо не совпадает с фото профиля (контроль экзамена)';
    }

    try {
      let videoBlob: Blob | null = null;
      let screenBlob: Blob | null = null;
      if (isRecording) {
        try {
          videoBlob = await stopRecording();
        } catch (error) {
          console.error('Error stopping video recording:', error);
        }
      }
      if (isScreenRecording) {
        try {
          screenBlob = await stopScreenRecording();
        } catch (error) {
          console.error('Error stopping screen recording:', error);
        }
      }

      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
        setVideoStream(null);
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
        setScreenStream(null);
      }

      // Сохраняем текущие ответы
      try {
        const savedProgress = localStorage.getItem(`test_${testId}_progress`);
        const progress = savedProgress ? JSON.parse(savedProgress) : null;
        const currentAttemptId = attemptId || progress?.attemptId;
        
        if (currentAttemptId) {
          const allAnswers: Record<string, any> = {};
          answers.forEach((answer) => {
            if (answer.answer !== '' && answer.answer !== null && answer.answer !== undefined) {
              allAnswers[answer.questionId] = answer.answer;
            }
          });
          
          if (Object.keys(allAnswers).length > 0) {
            await examsService.saveAllAnswers(Number(currentAttemptId), allAnswers);
          }
        }
      } catch (error) {
        console.error('Error saving answers before termination:', error);
      }

      // Завершаем тест через API
      const savedProgressForTerminate = localStorage.getItem(`test_${testId}_progress`);
      const progressTerminate = savedProgressForTerminate ? JSON.parse(savedProgressForTerminate) : null;
      const terminateAttemptId = attemptId ?? progressTerminate?.attemptId;
      if (terminateAttemptId) {
        try {
          await examsService.terminateTestAttempt(String(terminateAttemptId), reason);
        } catch (error) {
          console.error('Error terminating test attempt:', error);
        }
      }

      // Удаляем сохраненный прогресс
      localStorage.removeItem(`test_${testId}_progress`);

      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      onComplete(answers, timeSpent, videoBlob || undefined, screenBlob || undefined);
    } catch (error) {
      console.error('Error terminating test:', error);
      toast.error(t('lms.test.terminationError') || 'Ошибка при завершении теста');
    }
  };

  const handleTerminateTestRef = useRef(handleTerminateTest);
  handleTerminateTestRef.current = handleTerminateTest;

  useEffect(() => {
    if (!testStarted || !screenStream) return;
    const track = screenStream.getVideoTracks()[0];
    if (!track) return;
    const endedReason =
      t('lms.test.screenShareEndedReason') || 'Демонстрация экрана остановлена пользователем';
    const onEnded = () => {
      toast.error(
        t('lms.test.screenShareEnded') ||
          'Демонстрация экрана остановлена. Тест будет завершён.'
      );
      void handleTerminateTestRef.current?.(endedReason);
    };
    track.addEventListener('ended', onEnded);
    return () => track.removeEventListener('ended', onEnded);
  }, [testStarted, screenStream, t]);

  useEffect(() => {
    if (!testStarted || isTerminating) return;

    if (violationCount > previousViolationCountRef.current) {
      previousViolationCountRef.current = violationCount;

      if (violationCount >= 3) {
        void handleTerminateTestRef.current?.();
        return;
      }

      setShowViolationWarning(true);
    }
  }, [violationCount, testStarted, isTerminating]);

  const handleAnswerChange = (answer: string | string[]) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = {
      questionId: currentQuestion.id,
      answer,
    };
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = async () => {
    setShowConfirmSubmit(false);
    if (wasForceTerminated) {
      toast.error(
        t('lms.test.testTerminated') || 'Тест досрочно завершен из-за нарушений правил'
      );
      onCancel();
      return;
    }
    if (faceMissingPaused) {
      toast.message(
        facePauseKind === 'bad_pose'
          ? t('lms.test.faceBadPoseSubmitBlocked')
          : t('lms.test.faceMissingSubmitBlocked')
      );
      return;
    }
    if (requiresVideoRecording && !isRecording && !videoStream) {
      toast.error(
        t('lms.test.videoRequiredForSubmission') ||
          'Для завершения этого теста требуется видеозапись. Пожалуйста, убедитесь, что запись активна.'
      );
      return;
    }
    if (requiresScreenRecording && !isScreenRecording && !screenStream) {
      toast.error(
        t('lms.test.screenRequiredForSubmission') ||
          'Для завершения теста требуется активная запись экрана.'
      );
      return;
    }

    let videoBlob: Blob | null = null;
    let screenBlob: Blob | null = null;
    if (isRecording) {
      try {
        videoBlob = await stopRecording();
      } catch (error) {
        console.error('Error stopping video recording:', error);
        if (requiresVideoRecording) {
          toast.error(
            t('lms.test.videoRecordingError') ||
              'Ошибка при остановке видеозаписи. Тест не может быть завершен.'
          );
          return;
        }
      }
    }
    if (isScreenRecording) {
      try {
        screenBlob = await stopScreenRecording();
      } catch (error) {
        console.error('Error stopping screen recording:', error);
        if (requiresScreenRecording) {
          toast.error(
            t('lms.test.screenRecordingError') ||
              'Ошибка при остановке записи экрана. Тест не может быть завершен.'
          );
          return;
        }
      }
    }

    if (requiresVideoRecording && !videoBlob && !isRecording) {
      toast.error(
        t('lms.test.videoRequiredForSubmission') ||
          'Для завершения этого теста требуется видеозапись.'
      );
      return;
    }
    if (requiresScreenRecording && !screenBlob && !isScreenRecording) {
      toast.error(
        t('lms.test.screenRequiredForSubmission') ||
          'Для завершения теста требуется запись экрана.'
      );
      return;
    }

    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }

    // Сохраняем все ответы перед завершением
    try {
      const savedProgress = localStorage.getItem(`test_${testId}_progress`);
      const progress = savedProgress ? JSON.parse(savedProgress) : null;
      const currentAttemptId = attemptId || progress?.attemptId;
      
      if (currentAttemptId) {
        // Сохраняем все ответы одним запросом
        const allAnswers: Record<string, any> = {};
        answers.forEach((answer) => {
          if (answer.answer !== '' && answer.answer !== null && answer.answer !== undefined) {
            allAnswers[answer.questionId] = answer.answer;
          }
        });
        
        if (Object.keys(allAnswers).length > 0) {
          await examsService.saveAllAnswers(Number(currentAttemptId), allAnswers);
        }
      }
    } catch (error) {
      console.error('Error saving all answers before submit:', error);
      // Продолжаем выполнение даже если сохранение не удалось
    }
    
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    localStorage.removeItem(`test_${testId}_progress`);
    onComplete(answers, timeSpent, videoBlob || undefined, screenBlob || undefined);
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isAnswered = (index: number) => {
    const answer = answers[index].answer;
    if (Array.isArray(answer)) {
      return answer.length > 0;
    }
    return answer !== '';
  };

  const answeredCount = answers.filter((_, i) => isAnswered(i)).length;

  const watermarkLabel = useMemo(
    () =>
      `${user?.phone || user?.full_name || user?.fullName || '—'} · #${attemptId ?? '—'} · ${new Date().toLocaleString()}`,
    [user?.phone, user?.full_name, user?.fullName, attemptId, watermarkTick]
  );

  const handleEnterFullscreenClick = async () => {
    const el = testRootRef.current;
    if (!el) {
      setProtectionRulesBarDismissed(true);
      return;
    }
    const ok = await requestTestFullscreen(el);
    if (!ok) {
      toast.message(
        t('lms.test.fullscreenUnavailable') ||
          'Полноэкранный режим недоступен в этом браузере. Тест можно продолжить.'
      );
    }
    setProtectionRulesBarDismissed(true);
  };

  // Получаем текст предупреждения в зависимости от типа нарушения
  const getViolationMessage = () => {
    switch (violationType) {
      case 'screenshot':
        return t('lms.test.screenshotWarning') || 'Обнаружена попытка сделать скриншот';
      case 'screencast':
        return t('lms.test.screenCaptureWarning') || 'Обнаружена попытка записи экрана';
      case 'copy':
        return t('lms.test.copyWarning') || 'Копирование запрещено';
      case 'hotkey':
      case 'devtools':
        return t('lms.test.hotkeyWarning') || 'Использование горячих клавиш запрещено';
      case 'contextmenu':
        return t('lms.test.contextMenuWarning') || 'Контекстное меню запрещено';
      case 'tab_switch':
        return t('lms.test.tabSwitchWarning') || 'Запрещено переключать вкладку или сворачивать окно';
      case 'fullscreen_exit':
        return t('lms.test.fullscreenExitWarning') || 'Запрещено выходить из полноэкранного режима';
      case 'face_pose':
        return t('lms.test.facePoseWarning') || 'Смотрите прямо в камеру, не отворачивайтесь';
      case 'face_mismatch':
        return t('lms.test.faceMismatchWarning') || 'Лицо не совпадает с фото в профиле';
      default:
        return t('lms.test.violationDetected') || 'Обнаружено нарушение правил';
    }
  };

  const handleGoToProfileForPhoto = () => {
    navigate('/student/dashboard');
  };

  const handleRefreshProfilePhoto = async () => {
    setProfilePhotoCheckLoading(true);
    try {
      await refreshUser();
      toast.success(t('lms.test.profilePhotoRefreshed') || 'Данные профиля обновлены');
    } catch {
      toast.error(t('lms.test.profilePhotoRefreshError') || 'Не удалось обновить профиль');
    } finally {
      setProfilePhotoCheckLoading(false);
    }
  };

  return (
    <>
      {needsRecording && needsProfilePhoto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="max-w-md w-full rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Camera className="h-6 w-6 text-amber-800" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {t('lms.test.profilePhotoRequiredTitle') || 'Нужно фото в профиле'}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {t('lms.test.profilePhotoRequiredBody') ||
                'Для этого теста включена видеозапись с камеры. Загрузите фото лица в профиле — по нему выполняется проверка личности во время экзамена.'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoToProfileForPhoto}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700"
              >
                {t('lms.test.profilePhotoGoToProfile') || 'Открыть профиль'}
              </button>
              <button
                type="button"
                onClick={handleRefreshProfilePhoto}
                disabled={profilePhotoCheckLoading}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-800 font-medium hover:bg-gray-50 inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${profilePhotoCheckLoading ? 'animate-spin' : ''}`} />
                {t('lms.test.profilePhotoRefresh') || 'Я загрузил фото — обновить'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-lg px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {t('common.back') || 'Назад'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Старт записи: один шаг по кнопке (камера без отдельного модального окна) */}
      {needsRecording && !testStarted && !needsProfilePhoto && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100">
                {requiresVideoRecording && requiresScreenRecording ? (
                  <div className="flex gap-1">
                    <Camera className="h-8 w-8 text-red-600" />
                    <Monitor className="h-8 w-8 text-red-600" />
                  </div>
                ) : requiresScreenRecording ? (
                  <Monitor className="h-10 w-10 text-red-600" />
                ) : (
                  <Camera className="h-10 w-10 text-red-600" />
                )}
              </div>
            </div>
            <h2 className="mb-2 text-center text-xl font-bold text-gray-900">
              {t('lms.test.recordingSetup.inlineTitle') || 'Запись экзамена'}
            </h2>
            <p className="mb-6 text-center text-sm leading-relaxed text-gray-600">
              {requiresVideoRecording && requiresScreenRecording
                ? t('lms.test.recordingSetup.inlineBodyBoth') ||
                  'Нажмите кнопку ниже: браузер запросит доступ к камере и микрофону, затем — демонстрацию вкладки с тестом. Выберите именно вкладку браузера, не весь экран.'
                : requiresScreenRecording
                  ? t('lms.test.recordingSetup.inlineBodyScreen') ||
                    'Нажмите кнопку ниже и в окне выбора укажите вкладку браузера с этим тестом (не «Весь экран» и не «Окно»).'
                  : t('lms.test.recordingSetup.inlineBodyCamera') ||
                    'Нажмите кнопку ниже и разрешите доступ к камере и микрофону для записи.'}
            </p>
            {recordingSetupError && (
              <div className="mb-6 rounded-lg border-2 border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                  <p className="text-sm text-red-800">{recordingSetupError}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleStartRecordingSetup()}
                disabled={recordingSetupBusy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3.5 font-medium text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {recordingSetupBusy ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t('lms.test.recordingSetup.requesting') || 'Запрос...'}
                  </>
                ) : (
                  t('lms.test.recordingSetup.inlineStart') || 'Начать с записью'
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full rounded-lg py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {t('common.back') || 'Назад'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно предупреждения о нарушениях */}
      {showViolationWarning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-red-500 ring-opacity-50 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {t('lms.test.warningTitle') || 'Предупреждение о нарушении'}
              </h2>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-gray-700 font-medium">
                {getViolationMessage()}
              </p>
              <p className="text-sm text-gray-600">
                {t('lms.test.warningMessage') || 'Обнаружено нарушение правил прохождения теста. После 3 предупреждений тест будет автоматически завершен.'}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <p className="text-sm font-semibold text-red-800">
                  {t('lms.test.violationCount', { count: violationCount }) || `Нарушений: ${violationCount} из 3`}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowViolationWarning(false)}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              {t('common.close') || 'Закрыть'}
            </button>
          </div>
        </div>
      )}

      {faceMissingPaused && testStarted && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border-2 border-amber-200 bg-amber-50/95 p-8 text-center shadow-2xl ring-1 ring-amber-100">
            <p className="mb-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {t('lms.test.faceMissingNoPenaltyBadge')}
            </p>
            <PauseCircle className="mx-auto mb-4 h-12 w-12 text-amber-600" />
            <h3 className="mb-2 text-xl font-bold text-amber-950">
              {facePauseKind === 'bad_pose'
                ? t('lms.test.faceBadPosePauseTitle')
                : t('lms.test.faceMissingPauseTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-amber-950/90">
              {facePauseKind === 'bad_pose'
                ? t('lms.test.faceBadPosePauseBody')
                : t('lms.test.faceMissingPauseBody')}
            </p>
            <p className="mt-5 text-xs font-medium text-amber-800/90">{t('lms.test.faceMissingPauseHint')}</p>
          </div>
        </div>
      )}

      {/* Показываем интерфейс теста только если тест начат или видеозапись не требуется */}
      {(testStarted || !needsRecording) && (
      <div 
        ref={testRootRef}
        className={inModal ? "relative bg-gray-50" : "relative min-h-screen bg-gray-50 pt-20"}
        style={{ 
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onMouseDown={(e) => {
          // Блокируем выделение текста при зажатии мыши
          const target = e.target as HTMLElement;
          // Разрешаем клики по интерактивным элементам
          if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA' || target.closest('button') || target.closest('input') || target.closest('textarea')) {
            return;
          }
          // Блокируем выделение для остальных элементов
          if (window.getSelection) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              selection.removeAllRanges();
            }
          }
        }}
      >
        {requiresVideoRecording && videoStream && testStarted && (
          <video
            ref={proctorVideoRef}
            muted
            playsInline
            autoPlay
            className="pointer-events-none fixed left-[-9999px] top-0 h-[480px] w-[640px] max-w-none opacity-0"
            aria-hidden
            tabIndex={-1}
          />
        )}
        {testStarted && (
          <div
            className="pointer-events-none absolute inset-0 z-[5] overflow-hidden select-none"
            aria-hidden
          >
            <div className="absolute left-1/2 top-1/2 w-[220%] -translate-x-1/2 -translate-y-1/2 -rotate-[17deg]">
              <div className="flex flex-wrap content-center justify-center gap-x-12 gap-y-14 py-10 text-[10px] font-semibold uppercase tracking-wide text-slate-700/[0.12]">
                {Array.from({ length: 40 }).map((_, i) => (
                  <span key={i}>{watermarkLabel}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {testStarted && !protectionRulesBarDismissed && (
          <div className="relative z-[15] mx-auto mb-2 max-w-6xl px-4 pt-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
              <p className="mb-2 leading-snug text-amber-900">
                {t('lms.test.protectionRulesHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleEnterFullscreenClick}
                  className="rounded-md bg-amber-800 px-3 py-1.5 text-white hover:bg-amber-900"
                >
                  {t('lms.test.enterFullscreenButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setProtectionRulesBarDismissed(true)}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-amber-900 hover:bg-amber-100/80"
                >
                  {t('lms.test.continueWithoutFullscreen')}
                </button>
              </div>
            </div>
          </div>
        )}

      <div className={`relative z-[1] ${inModal ? "px-4 py-4 max-w-6xl" : "container mx-auto px-4 py-8 max-w-6xl"}`}>
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {t('lms.test.question') || 'Вопрос'} {currentQuestionIndex + 1} {t('lms.test.of') || 'из'} {questions.length}
              </p>
            </div>
            
            {timeLeft !== null && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <Clock className="w-5 h-5" />
                <span className="font-bold text-lg">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>

          {/* Video Recording Notification */}
          {requiresVideoRecording && isRecording && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">
                    {t('lms.test.videoRecordingActive') || 'Идет видеозапись'}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {t('lms.test.videoRecordingNotice') || 'Ваше прохождение теста записывается на видео. Пожалуйста, не закрывайте вкладку браузера.'}
                  </p>
                  <p className="text-xs text-red-700/90 mt-1">
                    {t('lms.test.faceProctoringHint')}
                  </p>
                </div>
                <div className="text-sm font-bold text-red-600">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}
          {requiresScreenRecording && isScreenRecording && (
            <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-amber-600 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900">
                    {t('lms.test.screenRecordingActive') || 'Идёт запись экрана'}
                  </p>
                  <p className="text-xs text-amber-800 mt-1">
                    {t('lms.test.screenRecordingNotice') ||
                      'Не останавливайте демонстрацию экрана до завершения теста.'}
                  </p>
                </div>
                <div className="text-sm font-bold text-amber-800">
                  {Math.floor(screenRecordingTime / 60)}:
                  {(screenRecordingTime % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{t('lms.test.progress') || 'Прогресс прохождения'}</span>
              <span>{answeredCount} {t('lms.test.of') || 'из'} {questions.length} {t('lms.test.answered') || 'отвечено'}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Question Navigation Pills */}
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentQuestionIndex;
                const isQuestionAnswered = isAnswered(idx);
                return (
                  <button
                    key={q.id || idx}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isQuestionAnswered
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={q.title || `Вопрос ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto-save indicator and video recording status */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {autoSaveStatus === 'saved' && <CheckCircle className="w-3 h-3 text-green-600" />}
              {autoSaveStatus === 'saving' && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
              {autoSaveStatus === 'error' && <AlertTriangle className="w-3 h-3 text-red-600" />}
              <span>
                {autoSaveStatus === 'saved' 
                  ? (t('lms.test.saved') || 'Сохранено')
                  : autoSaveStatus === 'saving'
                  ? (t('lms.test.saving') || 'Сохранение...')
                  : (t('lms.test.saveError') || 'Ошибка сохранения')}
              </span>
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                <span>
                  {t('lms.test.recording') || 'Камера'}: {Math.floor(recordingTime / 60)}:
                  {(recordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            {isScreenRecording && (
              <div className="flex items-center gap-2 text-amber-700">
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
                <span>
                  {t('lms.test.screenRecordingShort') || 'Экран'}:{' '}
                  {Math.floor(screenRecordingTime / 60)}:
                  {(screenRecordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            {videoError && (
              <div className="text-red-600 text-xs">
                {t('lms.test.recordingError') || 'Ошибка записи'}: {videoError}
              </div>
            )}
            {screenError && (
              <div className="text-amber-800 text-xs">
                {t('lms.test.screenRecordingErrorShort') || 'Экран'}: {screenError}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Question Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-24">
              <h3 className="font-bold text-gray-900 mb-3">{t('lms.test.questions') || 'Вопросы'}</h3>
              <div className="grid grid-cols-5 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestionIndex(index)}
                    className={`aspect-square rounded-lg font-medium text-sm transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                        : isAnswered(index)
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title={isAnswered(index) ? (t('lms.test.answered') || 'Отвечено') : (t('lms.test.notAnswered') || 'Не отвечено')}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600 rounded"></div>
                  <span className="text-gray-600">{t('lms.test.current') || 'Текущий'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-100 rounded"></div>
                  <span className="text-gray-600">{t('lms.test.answered') || 'Отвечено'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-100 rounded"></div>
                  <span className="text-gray-600">{t('lms.test.notAnswered') || 'Не отвечено'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Question Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-8">
              {/* Question Text */}
              <div className="mb-8">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                    {currentQuestionIndex + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-lg text-gray-900 leading-relaxed">
                      {currentQuestion.text}
                    </p>
                    {currentQuestion.weight && currentQuestion.weight > 1 && (
                      <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                        {currentQuestion.weight} балла
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Answer Options */}
              <div className="space-y-3">
                {/* Debug: показываем тип вопроса для отладки */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-400 mb-2">
                    Тип вопроса: {currentQuestion.type}
                  </div>
                )}
                
                {currentQuestion.type === 'single_choice' && currentQuestion.options?.map((option, index) => {
                  // Опции всегда должны быть объектами с id и text
                  // Пропускаем не-объекты (например, строки для yes_no вопросов)
                  if (typeof option !== 'object' || option === null) {
                    return null;
                  }
                  
                  // Всегда используем option.id, если его нет - пропускаем опцию
                  if (!option.id) {
                    return null;
                  }
                  
                  const optionId = String(option.id);
                  const optionText = option.text || '';
                  const isSelected = currentAnswer.answer === optionId;
                  
                  return (
                  <label
                      key={optionId}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                        value={optionId}
                        checked={isSelected}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="mt-1"
                    />
                      <span className="flex-1 text-gray-800">{optionText}</span>
                  </label>
                  );
                })}

                {currentQuestion.type === 'multiple_choice' && currentQuestion.options?.map((option, index) => {
                  // Опции всегда должны быть объектами с id и text
                  // Пропускаем не-объекты (например, строки для yes_no вопросов)
                  if (typeof option !== 'object' || option === null) {
                    return null;
                  }
                  
                  // Всегда используем option.id, если его нет - пропускаем опцию
                  if (!option.id) {
                    return null;
                  }
                  
                  const optionId = String(option.id);
                  const optionText = option.text || '';
                  const selectedAnswers = Array.isArray(currentAnswer.answer) ? currentAnswer.answer : [];
                  const isSelected = selectedAnswers.includes(optionId);
                  
                  return (
                    <label
                      key={optionId}
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={optionId}
                        checked={isSelected}
                        onChange={(e) => {
                          const newAnswers = e.target.checked
                            ? [...selectedAnswers, optionId]
                            : selectedAnswers.filter(a => a !== optionId);
                          handleAnswerChange(newAnswers);
                        }}
                        className="mt-1"
                      />
                      <span className="flex-1 text-gray-800">{optionText}</span>
                    </label>
                  );
                })}

                {currentQuestion.type === 'yes_no' && (
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => handleAnswerChange('Да')}
                      className={`p-4 border-2 rounded-lg font-medium transition-all ${
                        currentAnswer.answer === 'Да'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-green-300 text-gray-700'
                      }`}
                    >
                      Да
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAnswerChange('Нет')}
                      className={`p-4 border-2 rounded-lg font-medium transition-all ${
                        currentAnswer.answer === 'Нет'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-red-300 text-gray-700'
                      }`}
                    >
                      Нет
                    </button>
                  </div>
                )}

                {currentQuestion.type === 'short_answer' && (
                  <textarea
                    value={currentAnswer.answer as string}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Введите ваш ответ..."
                    rows={4}
                    className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                  />
                )}
                
                {/* Fallback для неопознанных типов */}
                {!['single_choice', 'multiple_choice', 'yes_no', 'short_answer'].includes(currentQuestion.type) && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-1">
                      Тип вопроса: <strong>{currentQuestion.type}</strong>
                    </p>
                    <p className="text-xs text-yellow-700">
                      Этот тип вопроса не поддерживается для отображения вариантов ответа.
                    </p>
                  </div>
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </button>

                <div className="flex gap-3">
                  {currentQuestionIndex === questions.length - 1 ? (
                    <button
                      onClick={() => setShowConfirmSubmit(true)}
                      disabled={wasForceTerminated || isTerminating}
                      className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                      <Flag className="w-4 h-4" />
                      Завершить тест
                    </button>
                  ) : (
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Далее
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Завершить тестирование?</h2>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-gray-600">
                Вы ответили на <strong>{answeredCount}</strong> из <strong>{questions.length}</strong> вопросов.
              </p>
              {answeredCount < questions.length && (
                <p className="text-yellow-600 text-sm">
                  ⚠️ Некоторые вопросы остались без ответа. Они будут засчитаны как неправильные.
                </p>
              )}
              <p className="text-sm text-gray-500">
                После завершения вы не сможете изменить ответы.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Продолжить тест
              </button>
              <button
                onClick={handleSubmit}
                disabled={wasForceTerminated || isTerminating}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Завершить
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      )}
    </>
  );
}
