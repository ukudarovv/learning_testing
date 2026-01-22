import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Circle, AlertTriangle, ArrowLeft, ArrowRight, Flag, X } from 'lucide-react';
import { Question, Answer } from '../../types/lms';
import { examsService } from '../../services/exams';
import { VideoPermissionModal } from './VideoPermissionModal';
import { useVideoRecorder } from '../../hooks/useVideoRecorder';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface TestInterfaceProps {
  testId: string;
  attemptId?: number; // ID попытки для автосохранения
  title: string;
  timeLimit?: number; // минуты
  questions: Question[];
  requiresVideoRecording?: boolean; // Требуется ли видеозапись
  onComplete: (answers: Answer[], timeSpent: number, videoBlob?: Blob) => void;
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
  onComplete, 
  onCancel,
  inModal = false,
  savedAnswers,
  startedAt
}: TestInterfaceProps) {
  const { t } = useTranslation();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoModalClosed, setVideoModalClosed] = useState(false); // Флаг, что пользователь закрыл модальное окно
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [videoPermissionGranted, setVideoPermissionGranted] = useState(false);
  const { isRecording, startRecording, stopRecording, error: videoError, recordingTime } = useVideoRecorder();
  
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
  // Инициализация testStarted: если требуется видеозапись, тест не должен начинаться без разрешения камеры
  // Даже если тест был начат ранее (есть startedAt), при продолжении нужно проверить камеру заново
  const [testStarted, setTestStarted] = useState(() => {
    // Если не требуется видеозапись, тест может начаться сразу
    if (!requiresVideoRecording) {
      return true;
    }
    // Если требуется видеозапись, тест не должен начинаться до разрешения камеры
    // Даже если тест был начат ранее, при продолжении нужно запросить камеру заново
    // Это важно для безопасности - нужно убедиться, что камера доступна при продолжении
    return false;
  });
  
  // Автоматически показываем модальное окно с запросом разрешения, если требуется видеозапись и тест не начат
  // Но только если пользователь еще не закрывал его вручную
  useEffect(() => {
    if (requiresVideoRecording && !testStarted && !showVideoModal && !videoModalClosed) {
      setShowVideoModal(true);
    }
  }, [requiresVideoRecording, testStarted, showVideoModal, videoModalClosed]);

  // Check if video recording is required on mount
  useEffect(() => {
    if (!requiresVideoRecording) {
      setTestStarted(true);
    }
  }, [requiresVideoRecording]);

  // Handle video permission granted
  const handleVideoPermissionGranted = async (stream: MediaStream) => {
    setVideoStream(stream);
    setVideoPermissionGranted(true);
    setShowVideoModal(false);
    setVideoModalClosed(false); // Сбрасываем флаг при успешном разрешении
    setTestStarted(true);
    
    // Start recording
    try {
      await startRecording(stream);
    } catch (error) {
      console.error('Error starting video recording:', error);
    }
  };

  // Handle video permission denied
  const handleVideoPermissionDenied = () => {
    setShowVideoModal(false);
    // If video recording is required, don't allow test to proceed
    if (requiresVideoRecording) {
      // Show error and don't start test
      toast.error(t('lms.test.videoRequired') || 'Для прохождения этого теста требуется видеозапись. Без видеозаписи тест не может быть пройден.');
      // Don't set testStarted to true - user must grant permission
      // Модальное окно снова откроется через useEffect
      return;
    }
    // If video is not required, allow proceeding without video
    setTestStarted(true);
  };

  // Handle modal close (just close, don't show error)
  const handleModalClose = () => {
    setShowVideoModal(false);
    setVideoModalClosed(true); // Помечаем, что пользователь закрыл модальное окно
    if (requiresVideoRecording) {
      // Don't start test if video is required
      // Показываем сообщение об ошибке
      toast.error(t('lms.test.videoRequired') || 'Для прохождения этого теста требуется видеозапись. Без видеозаписи тест не может быть пройден.');
      return;
    }
    // If video is not required, allow proceeding without video
    setTestStarted(true);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];

  // Таймер
  useEffect(() => {
    if (timeLeft === null || !testStarted) return; // Добавить проверку testStarted
    
    if (timeLeft <= 0) {
      handleSubmit().catch(console.error);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev ? prev - 1 : 0);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, testStarted]); // Добавить testStarted в зависимости

  // Автосохранение
  useEffect(() => {
    if (!testStarted) return; // Не сохранять до начала теста
    
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
  }, [answers, currentQuestionIndex, testId, testStarted]); // Добавить testStarted

  // Предотвращение случайного закрытия
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
    // Проверка: если требуется видео, оно должно быть записано
    if (requiresVideoRecording && !isRecording && !videoStream) {
      toast.error(
        t('lms.test.videoRequiredForSubmission') || 
        'Для завершения этого теста требуется видеозапись. Пожалуйста, убедитесь, что запись активна.'
      );
      return; // Не позволяем завершить тест без видео
    }
    
    // Stop video recording if active
    let videoBlob: Blob | null = null;
    if (isRecording) {
      try {
        videoBlob = await stopRecording();
      } catch (error) {
        console.error('Error stopping video recording:', error);
        // Если требуется видео, но не удалось остановить запись, не позволяем завершить
        if (requiresVideoRecording) {
          toast.error(
            t('lms.test.videoRecordingError') || 
            'Ошибка при остановке видеозаписи. Тест не может быть завершен.'
          );
          return;
        }
      }
    }

    // Если требуется видео, но его нет, не позволяем завершить
    if (requiresVideoRecording && !videoBlob && !isRecording) {
      toast.error(
        t('lms.test.videoRequiredForSubmission') || 
        'Для завершения этого теста требуется видеозапись.'
      );
      return;
    }

    // Stop video stream if active
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      setVideoStream(null);
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
    onComplete(answers, timeSpent, videoBlob || undefined);
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


  return (
    <>
      {/* Модальное окно с запросом разрешения на камеру */}
      {requiresVideoRecording && !testStarted && (
        <VideoPermissionModal
          isOpen={showVideoModal}
          onClose={handleModalClose}
          onPermissionGranted={handleVideoPermissionGranted}
          onPermissionDenied={handleVideoPermissionDenied}
        />
      )}
      {/* Показываем интерфейс теста только если тест начат или видеозапись не требуется */}
      {(testStarted || !requiresVideoRecording) && (
      <div className={inModal ? "bg-gray-50" : "min-h-screen bg-gray-50 pt-20"}>
      <div className={inModal ? "px-4 py-4 max-w-6xl" : "container mx-auto px-4 py-8 max-w-6xl"}>
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
                </div>
                <div className="text-sm font-bold text-red-600">
                  {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
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
                <span>{t('lms.test.recording') || 'Идет запись'}: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
              </div>
            )}
            {videoError && (
              <div className="text-red-600 text-xs">
                {t('lms.test.recordingError') || 'Ошибка записи'}: {videoError}
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
