import { CheckCircle, XCircle, Clock, RotateCcw, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { Test, TestAttempt, Protocol } from '../../types/lms';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SMSVerification } from './SMSVerification';
import { useUser } from '../../contexts/UserContext';
import { testsService } from '../../services/tests';
import { protocolsService } from '../../services/protocols';
import { toast } from 'sonner';

interface TestResultPageProps {
  test: Test;
  result: TestAttempt;
  attemptsUsed: number;
  attemptsTotal: number;
  timeSpent: number; // в секундах
  isStandalone?: boolean;
  onRetry?: () => void;
  onBackToCourse?: () => void;
  onBackToDashboard?: () => void;
}

export function TestResultPage({
  test,
  result,
  attemptsUsed,
  attemptsTotal,
  timeSpent,
  isStandalone = false,
  onRetry,
  onBackToCourse,
  onBackToDashboard,
}: TestResultPageProps) {
  const { t } = useTranslation();
  const { user } = useUser();
  const score = result.score || 0;
  const passed = result.passed || false;
  const passingScore = test.passingScore || test.passing_score || 80;
  const remainingAttempts = attemptsTotal - attemptsUsed;
  const [showDetails, setShowDetails] = useState(false);
  const [showSMSVerification, setShowSMSVerification] = useState(false);
  const [loadingOTP, setLoadingOTP] = useState(false);
  const [protocolCreated, setProtocolCreated] = useState(false);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [loadingProtocol, setLoadingProtocol] = useState(true);
  const answerDetails = result.answer_details || result.answerDetails || [];
  
  // Проверяем, существует ли протокол для этой попытки
  useEffect(() => {
    const checkProtocol = async () => {
      if (!isStandalone || !passed || !result?.id) {
        setLoadingProtocol(false);
        return;
      }
      
      try {
        const protocols = await protocolsService.getProtocols();
        const attemptId = String(result.id);
        const existingProtocol = protocols.find(p => p.attemptId === attemptId);
        
        if (existingProtocol) {
          setProtocol(existingProtocol);
          setProtocolCreated(true);
        }
      } catch (error) {
        console.error('Failed to check protocol:', error);
      } finally {
        setLoadingProtocol(false);
      }
    };
    
    checkProtocol();
  }, [isStandalone, passed, result?.id]);
  
  // Автоматически показываем SMS верификацию для standalone тестов, если тест сдан и протокол еще не создан
  useEffect(() => {
    if (isStandalone && passed && !protocolCreated && !showSMSVerification && user && test?.id && !loadingProtocol && !protocol) {
      handleRequestCompletionOTP();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStandalone, passed, protocolCreated, showSMSVerification, user, test?.id, loadingProtocol, protocol]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins} мин ${secs} сек`;
    }
    return `${secs} сек`;
  };

  const handleRequestCompletionOTP = async () => {
    if (!test?.id) return;

    try {
      setLoadingOTP(true);
      const response = await testsService.requestCompletionOTP(String(test.id));
      setShowSMSVerification(true);
      
      if (response.otp_is_new !== false) {
        toast.success(t('lms.test.smsSent') || 'SMS отправлено');
      }
    } catch (error: any) {
      toast.error(error.message || t('lms.test.smsRequestError') || 'Ошибка при запросе SMS кода');
      console.error('Failed to request completion OTP:', error);
    } finally {
      setLoadingOTP(false);
    }
  };

  const handleSMSVerified = async (otp: string) => {
    if (!test?.id) return;

    try {
      setLoadingOTP(true);
      const response = await testsService.verifyCompletionOTP(String(test.id), otp);
      setShowSMSVerification(false);
      setProtocolCreated(true);
      
      // Загружаем созданный протокол
      if (response.protocol_id) {
        try {
          const createdProtocol = await protocolsService.getProtocol(String(response.protocol_id));
          setProtocol(createdProtocol);
        } catch (error) {
          console.error('Failed to load created protocol:', error);
        }
      }
      
      toast.success(t('lms.test.testCompletedSuccess') || 'Тест завершен. Протокол создан и отправлен на подписание ПДЭК.');
    } catch (error: any) {
      toast.error(error.message || t('lms.test.smsVerifyError') || 'Ошибка при верификации SMS кода');
      console.error('Failed to verify completion OTP:', error);
    } finally {
      setLoadingOTP(false);
    }
  };
  
  // Функции для отображения статуса протокола
  const getProtocolStatusText = (status: string, t: any): string => {
    const statusMap: Record<string, string> = {
      'generated': t('lms.pdek.status.generated') || 'Создан',
      'pending_pdek': t('lms.pdek.status.pendingPdek') || 'Ожидает подписания ПДЭК',
      'signed_members': t('lms.pdek.status.signedMembers') || 'Подписан членами',
      'signed_chairman': t('lms.pdek.status.signedChairman') || 'Подписан председателем',
      'rejected': t('lms.pdek.status.rejected') || 'Отклонен',
      'annulled': t('lms.pdek.status.annulled') || 'Аннулирован',
    };
    return statusMap[status] || status;
  };
  
  const getProtocolStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      'generated': 'bg-gray-100 text-gray-800',
      'pending_pdek': 'bg-yellow-100 text-yellow-800',
      'signed_members': 'bg-blue-100 text-blue-800',
      'signed_chairman': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'annulled': 'bg-gray-100 text-gray-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">{t('lms.coursePlayer.testResultTitle') || 'Результаты теста'}</h1>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Result Icon and Title */}
            <div className="text-center mb-8">
              {passed ? (
                <>
                  <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-16 h-16 text-green-600" />
                  </div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-2">{t('lms.coursePlayer.testResultPassed') || 'Тест сдан!'}</h2>
                  <p className="text-lg text-gray-600">{t('lms.coursePlayer.testResultPassedDesc') || 'Поздравляем! Вы успешно прошли тест.'}</p>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-16 h-16 text-red-600" />
                  </div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-2">{t('lms.coursePlayer.testResultFailed') || 'Тест не сдан'}</h2>
                  <p className="text-lg text-gray-600">{t('lms.coursePlayer.testResultFailedDesc') || 'К сожалению, вы не набрали проходной балл.'}</p>
                </>
              )}
            </div>

            {/* Statistics */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">{t('lms.coursePlayer.testResultScore') || 'Ваш результат'}</p>
                  <p className={`text-5xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                    {score.toFixed(2)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">{t('lms.coursePlayer.testResultPassingScore') || 'Проходной балл'}</p>
                  <p className="text-5xl font-bold text-gray-900">{passingScore}%</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">{t('lms.coursePlayer.testResultTimeSpent') || 'Время прохождения'}</p>
                      <p className="text-lg font-semibold text-gray-900">{formatTime(timeSpent)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RotateCcw className="w-6 h-6 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">{t('lms.coursePlayer.testAttempts') || 'Попытки'}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {attemptsUsed} из {attemptsTotal}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>{t('lms.coursePlayer.testProgress') || 'Прогресс выполнения'}</span>
                <span className="font-semibold">{score.toFixed(2)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all duration-500 ${
                    passed ? 'bg-green-600' : 'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>0%</span>
                <span className="font-semibold">{passingScore}% ({t('lms.coursePlayer.testResultPassingScore') || 'Проходной балл'})</span>
                <span>100%</span>
              </div>
            </div>

            {/* Messages */}
            {passed ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                {isStandalone && protocol ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-blue-900">
                      {t('lms.test.protocolCreated') || 'Протокол экзамена создан и отправлен на подписание комиссией ПДЭК. После подписания протокола вы получите сертификат.'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-blue-700">
                        {t('lms.student.protocolStatus') || 'Статус протокола'}:
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getProtocolStatusColor(protocol.status)}`}>
                        {getProtocolStatusText(protocol.status, t)}
                      </span>
                      {protocol.number && (
                        <span className="text-xs text-blue-600">
                          ({t('lms.documents.protocolNumber', { number: protocol.number }) || `Номер: ${protocol.number}`})
                        </span>
                      )}
                    </div>
                  </div>
                ) : isStandalone ? (
                  <p className="text-sm text-blue-800">
                    {t('lms.test.standaloneTestCompleted') || 'Тест успешно завершен. Для завершения необходимо подтвердить SMS кодом.'}
                  </p>
                ) : (
                  <p className="text-sm text-blue-800">
                    {t('lms.coursePlayer.testResultLessonCompleted') || 'Урок будет автоматически отмечен как завершенный. Вы можете продолжить изучение курса.'}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-orange-800">
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
              </div>
            )}

            {/* Detailed Answers Section */}
            {answerDetails.length > 0 && (
              <div className="mb-6">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="font-semibold text-gray-900">
                    {t('lms.coursePlayer.testResultDetails', { correct: answerDetails.filter(d => d.is_correct).length, total: answerDetails.length }) || `Детальные результаты (${answerDetails.filter(d => d.is_correct).length} из ${answerDetails.length} правильно)`}
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
                              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 mb-2 text-lg">
                                {t('lms.coursePlayer.testResultQuestion', { number: index + 1 }) || `Вопрос ${index + 1}`}: {detail.question_text || detail.questionText || ''}
                              </p>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-gray-700">{t('lms.coursePlayer.testResultYourAnswer') || 'Ваш ответ'}: </span>
                                  <span className={`${
                                    detail.is_correct ? 'text-green-700' : 'text-red-700'
                                  } font-medium`}>
                                    {detail.user_answer_display || t('lms.coursePlayer.testResultNotAnswered') || 'Не отвечено'}
                                  </span>
                                </div>
                                
                                {!detail.is_correct && (
                                  <div>
                                    <span className="font-medium text-gray-700">{t('lms.coursePlayer.testResultCorrectAnswer') || 'Правильный ответ'}: </span>
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
            <div className="flex gap-3 justify-center flex-wrap">
              {onBackToCourse && (
                <button
                  onClick={onBackToCourse}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('lms.coursePlayer.testResultBackToCourse') || 'Вернуться к курсу'}
                </button>
              )}
              {!passed && remainingAttempts > 0 && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  {t('lms.coursePlayer.testResultRetake') || 'Пройти заново'}
                </button>
              )}
              {onBackToDashboard && (
                <button
                  onClick={onBackToDashboard}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  {t('common.back') || 'Назад'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SMS Verification Modal for standalone tests - показываем только если протокол еще не создан */}
      {showSMSVerification && user && passed && isStandalone && !protocol && (
        <SMSVerification
          phone={user.phone}
          onVerified={handleSMSVerified}
          onCancel={() => {
            setShowSMSVerification(false);
          }}
          title={t('lms.test.completionTitle') || 'Завершение теста'}
          description={t('lms.test.completionDescription') || 'Введите код подтверждения из SMS для завершения теста'}
          purpose="verification"
          onResend={async () => {
            if (test?.id) {
              const response = await testsService.requestCompletionOTP(String(test.id));
              if (response.otp_is_new !== false) {
                toast.success(t('lms.test.smsSent') || 'SMS отправлено');
              }
            }
          }}
        />
      )}
    </div>
  );
}
