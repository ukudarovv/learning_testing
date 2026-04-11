import { X, CheckCircle, XCircle, Clock, RotateCcw, ArrowLeft, ChevronDown, ChevronUp, Video, Send } from 'lucide-react';
import { Test, TestAttempt, ExtraAttemptRequest } from '../../types/lms';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { examsService } from '../../services/exams';
import { ExtraAttemptRequestModal } from './ExtraAttemptRequestModal';
import { RecordingVideoPlayer } from '../common/RecordingVideoPlayer';

interface TestResultModalProps {
  test: Test;
  result: TestAttempt;
  attemptsUsed: number;
  attemptsTotal: number;
  timeSpent: number; // в секундах
  onClose: () => void;
  onRetry?: () => void;
  onBackToCourse?: () => void;
}

export function TestResultModal({
  test,
  result,
  attemptsUsed,
  attemptsTotal,
  timeSpent,
  onClose,
  onRetry,
  onBackToCourse,
}: TestResultModalProps) {
  const { t } = useTranslation();
  const score = result.score || 0;
  const passed = result.passed || false;
  const passingScore = test.passingScore || test.passing_score || 80;
  const remainingAttempts = attemptsTotal - attemptsUsed;
  const [showDetails, setShowDetails] = useState(false);
  const [showExtraAttemptModal, setShowExtraAttemptModal] = useState(false);
  const [extraAttemptRequests, setExtraAttemptRequests] = useState<ExtraAttemptRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const answerDetails = result.answer_details || result.answerDetails || [];
  // Проверяем, нужно ли показывать результаты
  const showResults = test.showResults !== undefined ? test.showResults : (test.show_results !== undefined ? test.show_results : true);
  
  // Загружаем запросы на дополнительные попытки
  useEffect(() => {
    const loadRequests = async () => {
      if (!test?.id || passed) return;
      
      try {
        setLoadingRequests(true);
        const allRequests = await examsService.getExtraAttemptRequests();
        const requestsForThisTest = allRequests.filter(r => {
          const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
          return String(rTestId) === String(test.id);
        });
        setExtraAttemptRequests(requestsForThisTest);
      } catch (error) {
        console.error('Failed to load extra attempt requests:', error);
        setExtraAttemptRequests([]);
      } finally {
        setLoadingRequests(false);
      }
    };
    
    loadRequests();
  }, [test?.id, passed]);
  
  // Проверяем, есть ли pending запрос
  const hasPendingRequest = extraAttemptRequests.some(r => r.status === 'pending');
  // Извлекаем URL видео из результата (поддерживаем оба формата)
  const videoUrl = result.video_recording || result.videoRecording || null;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins} мин ${secs} сек`;
    }
    return `${secs} сек`;
  };

  // Форматирование даты для отображения
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '—';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
      <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-900">{t('lms.coursePlayer.testResultTitle')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Result Icon and Title */}
          <div className="text-center mb-6">
            {passed ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.coursePlayer.testResultPassed')}</h3>
                <p className="text-gray-600">{t('lms.coursePlayer.testResultPassedDesc')}</p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-12 h-12 text-red-600" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">{t('lms.coursePlayer.testResultFailed')}</h3>
                <p className="text-gray-600">{t('lms.coursePlayer.testResultFailedDesc')}</p>
              </>
            )}
          </div>

          {/* Statistics - всегда показываем */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{t('lms.coursePlayer.testResultScore')}</p>
                <p className={`text-4xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                  {score.toFixed(2)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">{t('lms.coursePlayer.testResultPassingScore')}</p>
                <p className="text-4xl font-bold text-gray-900">{passingScore}%</p>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t('lms.coursePlayer.testResultTimeSpent')}</p>
                    <p className="text-sm font-semibold text-gray-900">{formatTime(timeSpent)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">{t('lms.coursePlayer.testAttempts')}</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {attemptsUsed} из {attemptsTotal}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar - всегда показываем */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>{t('lms.coursePlayer.testProgress')}</span>
              <span>{score.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      passed ? 'bg-green-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span className="font-semibold">{passingScore}% ({t('lms.coursePlayer.testResultPassingScore')})</span>
                  <span>100%</span>
                </div>
          </div>

          {/* Messages */}
          {passed ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                {t('lms.coursePlayer.testResultLessonCompleted')}
              </p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-orange-800 mb-2">
                {remainingAttempts > 0 
                  ? t('lms.coursePlayer.testResultRemainingAttempts', { 
                      count: remainingAttempts,
                      attempts: remainingAttempts === 1 
                        ? t('lms.coursePlayer.testResultAttempt')
                        : remainingAttempts < 5 
                        ? t('lms.coursePlayer.testResultAttempts2')
                        : t('lms.coursePlayer.testResultAttempts5')
                    })
                  : t('lms.coursePlayer.testResultNoAttempts')
                }
              </p>
              {remainingAttempts === 0 && !hasPendingRequest && test?.id && (
                <button
                  onClick={() => setShowExtraAttemptModal(true)}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  <Send className="w-4 h-4" />
                  {t('lms.coursePlayer.requestExtraAttempts') || 'Запросить дополнительные попытки'}
                </button>
              )}
              {hasPendingRequest && (
                <p className="text-xs text-orange-700 mt-2">
                  {t('lms.coursePlayer.extraAttemptRequestPending') || 'Ваш запрос на дополнительные попытки ожидает рассмотрения администратором.'}
                </p>
              )}
            </div>
          )}

          {/* Video Recording Section */}
          {videoUrl && (
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Video className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-900">
                    {t('lms.coursePlayer.testResultVideoRecording') || 'Видеозапись попытки'}
                  </h4>
                </div>
                <div className="space-y-3">
                  <RecordingVideoPlayer src={videoUrl} videoMaxHeight="400px">
                    {t('lms.coursePlayer.testResultVideoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                  </RecordingVideoPlayer>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Answers Section - показываем всегда, но правильные ответы только если showResults = true */}
          {answerDetails.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="font-semibold text-gray-900">
                  {t('lms.coursePlayer.testResultDetails', { correct: answerDetails.filter(d => d.is_correct).length, total: answerDetails.length })}
                </span>
                {showDetails ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {showDetails && (
                <div className="mt-4 space-y-4">
                  {answerDetails.map((detail, index) => (
                    <div
                      key={detail.question_id || index}
                      className={`border-2 rounded-lg p-4 ${
                        detail.is_correct
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          {detail.is_correct ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 mb-2">
                              Вопрос {index + 1}: {detail.question_text}
                            </p>
                            
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">{t('lms.coursePlayer.testResultYourAnswer')}: </span>
                                <span className={`${
                                  detail.is_correct ? 'text-green-700' : 'text-red-700'
                                } font-medium`}>
                                  {detail.user_answer_display || t('lms.coursePlayer.testResultNotAnswered')}
                                </span>
                              </div>
                              
                              {/* Правильный ответ показываем только если showResults = true */}
                              {showResults && !detail.is_correct && (
                                <div>
                                  <span className="font-medium text-gray-700">{t('lms.coursePlayer.testResultCorrectAnswer')}: </span>
                                  <span className="text-green-700 font-medium">
                                    {detail.correct_answer_display}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            {onBackToCourse && (
              <button
                onClick={onBackToCourse}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('lms.coursePlayer.testResultBackToCourse')}
              </button>
            )}
            {!passed && remainingAttempts > 0 && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                <RotateCcw className="w-4 h-4" />
                {t('lms.coursePlayer.testResultRetake')}
              </button>
            )}
            {!onBackToCourse && (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                {t('common.close')}
              </button>
            )}
          </div>
        </div>
      </div>

      {showExtraAttemptModal && test?.id && (
        <ExtraAttemptRequestModal
          testId={String(test.id)}
          existingRequest={null}
          onSuccess={(request) => {
            setExtraAttemptRequests(prev => [...prev, request]);
            setShowExtraAttemptModal(false);
            // Перезагружаем запросы для актуального состояния
            examsService.getExtraAttemptRequests().then(allRequests => {
              const requestsForThisTest = allRequests.filter(r => {
                const rTestId = typeof r.test === 'object' ? r.test?.id : r.testId || r.test;
                return String(rTestId) === String(test.id);
              });
              setExtraAttemptRequests(requestsForThisTest);
            }).catch(console.error);
          }}
          onCancel={() => setShowExtraAttemptModal(false)}
        />
      )}
    </div>
  );
}

