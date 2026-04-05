import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle, Clock, AlertTriangle, Phone, Video, Monitor, ChevronDown, ChevronUp, XCircle, Shield } from 'lucide-react';
import { Protocol, TestAttempt } from '../../types/lms';
import { SMSVerification } from './SMSVerification';
import { EDSSignModal } from './EDSSignModal';
import { useProtocols } from '../../hooks/useProtocols';
import { protocolsService } from '../../services/protocols';
import { examsService } from '../../services/exams';
import { settingsService } from '../../services/settings';
import { useUser } from '../../contexts/UserContext';
import { toast } from 'sonner';

export function PDEKDashboard() {
  const { t, i18n } = useTranslation();
  const { user: currentUser } = useUser();
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);
  const [showSMSModal, setShowSMSModal] = useState(false);
  const [showEDSModal, setShowEDSModal] = useState(false);
  const [protocolToSign, setProtocolToSign] = useState<Protocol | null>(null);
  const [loading, setLoading] = useState(false);
  const [testAttempt, setTestAttempt] = useState<TestAttempt | null>(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [signMethod, setSignMethod] = useState<'sms' | 'eds' | 'both'>('both');

  const isChairman = currentUser?.role === 'pdek_chairman';

  useEffect(() => {
    settingsService.getSettings()
      .then((data) => setSignMethod((data.default_protocol_sign_method as 'sms' | 'eds' | 'both') || 'both'))
      .catch(() => setSignMethod('both'));
  }, []);
  const showSmsButton = signMethod === 'both' || signMethod === 'sms';
  const showEdsButton = signMethod === 'both' || signMethod === 'eds';
  
  // Получаем протоколы через API
  const { protocols, loading: protocolsLoading, refetch } = useProtocols();
  
  // Протоколы, ожидающие подписи текущего пользователя (ещё не подписал)
  const pendingProtocols = protocols.filter(p => {
    const needsUserSignature = p.status === 'pending_pdek' || (isChairman && p.status === 'signed_members');
    if (!needsUserSignature) return false;

    // Исключаем протоколы, которые пользователь уже подписал
    if (!currentUser?.id) return true;
    const currentUserId = String(currentUser.id);
    const userSignature = p.signatures?.find(s => {
      const signatureUserId = s.signer?.id ? String(s.signer.id) : s.userId ? String(s.userId) : null;
      return signatureUserId === currentUserId;
    });
    const alreadySigned = userSignature && (userSignature.otp_verified === true || userSignature.otpVerified === true);
    return !alreadySigned;
  });

  const signedProtocols = protocols.filter(p => {
    if (!currentUser || !currentUser.id) {
      return false;
    }
    
    const currentUserId = String(currentUser.id);
    
    // Проверяем, есть ли подпись текущего пользователя с otp_verified = true
    const userSignature = p.signatures?.find(s => {
      const signatureUserId = s.signer?.id ? String(s.signer.id) : s.userId ? String(s.userId) : null;
      return signatureUserId === currentUserId;
    });
    
    // Проверяем оба варианта названия поля (otp_verified и otpVerified)
    const isVerified = userSignature && (userSignature.otp_verified === true || userSignature.otpVerified === true);
    
    return !!isVerified;
  });

  const handleSignRequest = async (protocol: Protocol) => {
    try {
      setLoading(true);
      await protocolsService.requestSignature(protocol.id);
      setProtocolToSign(protocol);
      setShowSMSModal(true);
      toast.success(t('lms.pdek.otpSent'));
    } catch (error: any) {
      toast.error(error.message || t('lms.pdek.signRequestError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSMSVerified = async (otp: string) => {
    if (!protocolToSign) return;

    try {
      setLoading(true);
      await protocolsService.signProtocol(protocolToSign.id, otp);
      toast.success(t('lms.pdek.signSuccess'));
      setShowSMSModal(false);
      setProtocolToSign(null);
      setTimeout(() => refetch(), 500);
    } catch (error: any) {
      toast.error(error.message || t('lms.pdek.signError'));
    } finally {
      setLoading(false);
    }
  };

  const handleEDSSignRequest = (protocol: Protocol) => {
    if (!protocol.file) {
      toast.error(t('lms.pdek.noProtocolFile') || 'Файл протокола не загружен. Обратитесь к администратору.');
      return;
    }
    setProtocolToSign(protocol);
    setShowEDSModal(true);
  };

  const handleEDSSuccess = () => {
    setShowEDSModal(false);
    setProtocolToSign(null);
    toast.success(t('lms.pdek.signSuccess'));
    setTimeout(() => refetch(), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isChairman ? t('lms.pdek.chairman') : t('lms.pdek.member')}
          </h1>
          <p className="text-gray-600">
            {t('lms.pdek.commissionDescription')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-2xl font-bold text-orange-600">{pendingProtocols.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">{t('lms.pdek.pendingSignatures')}</h3>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">{signedProtocols.length}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">{t('lms.pdek.signedByMe')}</h3>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-blue-600">
                {pendingProtocols.length + signedProtocols.length}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-600">{t('lms.pdek.totalProtocols')}</h3>
          </div>
        </div>

        {/* Pending Protocols */}
        {pendingProtocols.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.pdek.protocolsToSign')}</h2>
            <div className="space-y-4">
              {pendingProtocols.map(protocol => (
                <div key={protocol.id} className="bg-white rounded-lg shadow-md border-l-4 border-orange-500">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">{t('lms.pdek.protocolNumber', { number: protocol.number })}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            protocol.status === 'pending_pdek' 
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {protocol.status === 'pending_pdek' ? t('lms.pdek.pendingSignature') : t('lms.pdek.signedByMembers')}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-2">{protocol.courseName}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">{t('lms.pdek.student')}</span>
                            <p className="font-medium text-gray-900">{protocol.userName}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('lms.pdek.iin')}</span>
                            <p className="font-medium text-gray-900">{protocol.userIIN}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('lms.pdek.examDate')}</span>
                            <p className="font-medium text-gray-900">
                              {new Date(protocol.examDate).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">{t('lms.pdek.result')}</span>
                            <p className="font-medium text-green-600">{Number(protocol.score || 0).toFixed(2)}% ({t('lms.pdek.passed')})</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Signatures Status */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">{t('lms.pdek.signatureStatus')}</h4>
                      <div className="space-y-2">
                        {protocol.signatures.map((sig, index) => (
                            <div key={sig.userId || sig.id || `sig-${index}`} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {sig.otpVerified ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Clock className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm">
                                {sig.userName} ({sig.role === 'chairman' ? t('lms.pdek.chairmanRole') : t('lms.pdek.memberRole')})
                                {sig.signType === 'eds' && <span className="text-emerald-600 ml-1">ЭЦП</span>}
                              </span>
                            </div>
                            {sig.otpVerified && sig.signedAt && (
                              <span className="text-xs text-gray-500">
                                {new Date(sig.signedAt).toLocaleString(i18n.language)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          const fullProtocol = await protocolsService.getProtocol(protocol.id);
                          setSelectedProtocol(fullProtocol);
                          
                          const attemptId = fullProtocol.attemptId 
                            ? String(fullProtocol.attemptId) 
                            : (fullProtocol.attempt?.id ? String(fullProtocol.attempt.id) : null);
                          if (attemptId) {
                            setLoadingAttempt(true);
                            try {
                              const attempt = await examsService.getTestAttempt(attemptId);
                              setTestAttempt(attempt);
                            } catch (error) {
                              console.error('Failed to load test attempt:', error);
                              setTestAttempt(null);
                            } finally {
                              setLoadingAttempt(false);
                            }
                          } else {
                            setTestAttempt(null);
                          }
                        } catch (error) {
                          console.error('Failed to load protocol details:', error);
                          setSelectedProtocol(protocol);
                          setTestAttempt(null);
                        }
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t('lms.pdek.details')}
                    </button>
                      {showSmsButton && (
                        <button
                          onClick={() => handleSignRequest(protocol)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          <Phone className="w-4 h-4" />
                          {t('lms.pdek.signSms')}
                        </button>
                      )}
                      {showEdsButton && (
                        <button
                          onClick={() => handleEDSSignRequest(protocol)}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                          title={t('lms.pdek.signEDS') || 'Подписать ЭЦП'}
                        >
                          <Shield className="w-4 h-4" />
                          {t('lms.pdek.signEDS') || 'ЭЦП'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signed Protocols */}
        {signedProtocols.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('lms.pdek.signedProtocols')}</h2>
            <div className="space-y-4">
              {signedProtocols.map(protocol => (
                <div key={protocol.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{t('lms.pdek.protocolNumber', { number: protocol.number })}</h3>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          {t('lms.pdek.signedStatus')}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-2">{protocol.courseName && protocol.courseName !== 'Не указано' ? protocol.courseName : (protocol.testName && protocol.testName !== 'Не указано' ? protocol.testName : '—')}</p>
                      <p className="text-sm text-gray-500">{protocol.userName && protocol.userName !== 'Не указано' ? protocol.userName : '—'}</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const fullProtocol = await protocolsService.getProtocol(protocol.id);
                          setSelectedProtocol(fullProtocol);
                          
                          const attemptId = fullProtocol.attemptId 
                            ? String(fullProtocol.attemptId) 
                            : (fullProtocol.attempt?.id ? String(fullProtocol.attempt.id) : null);
                          if (attemptId) {
                            setLoadingAttempt(true);
                            try {
                              const attempt = await examsService.getTestAttempt(attemptId);
                              setTestAttempt(attempt);
                            } catch (error) {
                              console.error('Failed to load test attempt:', error);
                              setTestAttempt(null);
                            } finally {
                              setLoadingAttempt(false);
                            }
                          } else {
                            setTestAttempt(null);
                          }
                        } catch (error) {
                          console.error('Failed to load protocol details:', error);
                          setSelectedProtocol(protocol);
                          setTestAttempt(null);
                        }
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t('lms.pdek.viewProtocol')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No protocols message */}
        {pendingProtocols.length === 0 && signedProtocols.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('lms.pdek.noProtocols')}</h3>
            <p className="text-gray-600">{t('lms.pdek.noProtocolsDescription')}</p>
          </div>
        )}
      </div>

      {/* Protocol Details Modal */}
      {selectedProtocol && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl ring-4 ring-white ring-opacity-50 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">{t('lms.pdek.protocolNumber', { number: selectedProtocol.number })}</h2>
                <button
                  onClick={() => {
                    setSelectedProtocol(null);
                    setTestAttempt(null);
                    setShowDetails(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Student Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">{t('lms.pdek.studentInfo')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.fullName')}:</span>
                    <p className="font-medium">{selectedProtocol.userName || t('lms.pdek.notSpecified')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.iin')}:</span>
                    <p className="font-medium">{selectedProtocol.userIIN || t('lms.pdek.notSpecified')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.phone')}:</span>
                    <p className="font-medium">{selectedProtocol.userPhone || t('lms.pdek.notSpecified')}</p>
                  </div>
                </div>
              </div>

              {/* Course Info */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">{t('lms.pdek.examInfo')}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.course')}:</span>
                    <p className="font-medium">{selectedProtocol.courseName || t('lms.pdek.notSpecified')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.examDate')}:</span>
                    <p className="font-medium">
                      {selectedProtocol.examDate && !isNaN(new Date(selectedProtocol.examDate).getTime())
                        ? new Date(selectedProtocol.examDate).toLocaleString(i18n.language)
                        : t('lms.pdek.notSpecified')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.score')}:</span>
                    <p className="font-medium text-green-600">{Number(selectedProtocol.score || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.passingScore')}:</span>
                    <p className="font-medium">
                      {selectedProtocol.passingScore != null && selectedProtocol.passingScore !== undefined
                        ? `${selectedProtocol.passingScore}%`
                        : t('lms.pdek.notSpecified')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('lms.pdek.result')}:</span>
                    <p className="font-medium text-green-600">
                      {selectedProtocol.result === 'passed' ? t('lms.pdek.passed') : selectedProtocol.result === 'failed' ? t('lms.pdek.failed') : t('lms.pdek.notSpecified')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">{t('lms.pdek.pdekSignatures')}</h3>
                <div className="space-y-3">
                  {selectedProtocol.signatures.map((sig, index) => (
                    <div key={sig.userId || sig.id || `sig-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{sig.userName}</p>
                        <p className="text-sm text-gray-600">
                          {sig.role === 'chairman' ? t('lms.pdek.chairmanRole') : t('lms.pdek.memberRole')}
                          {sig.signType === 'eds' && (
                            <span className="ml-2 text-emerald-600">({t('lms.pdek.signEDS') || 'ЭЦП'})</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{sig.phone}</p>
                        {sig.signType === 'eds' && sig.edsCertificateInfo && (
                          <div className="mt-2 p-2 bg-white rounded border border-emerald-100 text-xs">
                            <p className="font-medium text-gray-700 mb-1">{t('lms.pdek.certificateInfo') || 'Сертификат:'}</p>
                            <p>{sig.edsCertificateInfo.full_name && <span>{sig.edsCertificateInfo.full_name}</span>}</p>
                            {sig.edsCertificateInfo.iin && <p>{t('lms.pdek.iin')} {sig.edsCertificateInfo.iin}</p>}
                            {sig.edsCertificateInfo.serial_number && <p>{t('lms.pdek.certSerial') || 'Серийный №'}: {sig.edsCertificateInfo.serial_number}</p>}
                            {sig.edsCertificateInfo.issuer && <p>{t('lms.pdek.certIssuer') || 'УЦ'}: {sig.edsCertificateInfo.issuer}</p>}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {sig.otpVerified && sig.signedAt ? (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-600 ml-auto mb-1" />
                            <p className="text-xs text-gray-500">
                              {new Date(sig.signedAt).toLocaleString(i18n.language)}
                            </p>
                          </>
                        ) : (
                          <>
                            <Clock className="w-6 h-6 text-gray-400 ml-auto mb-1" />
                            <p className="text-xs text-gray-500">{t('lms.pdek.awaitingSignatureStatus')}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Attempt Details - для членов ЭК показываем все детали */}
              {loadingAttempt ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">{t('lms.pdek.loadingAttemptDetails') || 'Загрузка деталей попытки...'}</p>
                </div>
              ) : testAttempt && (
                <>
                  {/* Video Recording Section */}
                  {(testAttempt.video_recording || testAttempt.videoRecording) && (
                    <div className="mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Video className="w-5 h-5 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">
                            {t('lms.pdek.videoRecording') || 'Видеозапись попытки'}
                          </h4>
                        </div>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <video
                            src={testAttempt.video_recording || testAttempt.videoRecording || ''}
                            controls
                            className="w-full h-full"
                            style={{ maxHeight: '400px' }}
                          >
                            {t('lms.pdek.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                          </video>
                        </div>
                      </div>
                    </div>
                  )}

                  {(testAttempt.screen_recording || testAttempt.screenRecording) && (
                    <div className="mb-6">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Monitor className="w-5 h-5 text-amber-700" />
                          <h4 className="font-semibold text-gray-900">
                            {t('lms.pdek.screenRecording') || 'Запись экрана'}
                          </h4>
                        </div>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <video
                            src={testAttempt.screen_recording || testAttempt.screenRecording || ''}
                            controls
                            className="w-full h-full"
                            style={{ maxHeight: '400px' }}
                          >
                            {t('lms.pdek.videoNotSupported') || 'Ваш браузер не поддерживает воспроизведение видео.'}
                          </video>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed Answers Section */}
                  {(() => {
                    const answerDetails = testAttempt.answer_details || testAttempt.answerDetails || [];
                    if (answerDetails.length === 0) return null;
                    
                    return (
                      <div className="mb-6">
                        <button
                          onClick={() => setShowDetails(!showDetails)}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <span className="font-semibold text-gray-900">
                            {t('lms.pdek.detailedResults', { 
                              correct: answerDetails.filter((d: any) => d.is_correct).length, 
                              total: answerDetails.length 
                            }) || `Детальные результаты (${answerDetails.filter((d: any) => d.is_correct).length} из ${answerDetails.length} правильно)`}
                          </span>
                          {showDetails ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </button>

                        {showDetails && (
                          <div className="mt-4 space-y-4">
                            {answerDetails.map((detail: any, index: number) => (
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
                                        {t('lms.pdek.questionNumber', { number: index + 1 }) || `Вопрос ${index + 1}`}: {detail.question_text || detail.questionText || ''}
                                      </p>
                                      
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium text-gray-700">{t('lms.pdek.studentAnswer') || 'Ответ студента'}: </span>
                                          <span className={`${
                                            detail.is_correct ? 'text-green-700' : 'text-red-700'
                                          } font-medium`}>
                                            {detail.user_answer_display || detail.userAnswerDisplay || t('lms.pdek.notAnswered') || 'Не отвечено'}
                                          </span>
                                        </div>
                                        
                                        {/* Для ЭК всегда показываем правильный ответ */}
                                        {!detail.is_correct && (
                                          <div>
                                            <span className="font-medium text-gray-700">{t('lms.pdek.correctAnswer') || 'Правильный ответ'}: </span>
                                            <span className="text-green-700 font-medium">
                                              {detail.correct_answer_display || detail.correctAnswerDisplay || ''}
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
                    );
                  })()}
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setSelectedProtocol(null)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('common.close')}
              </button>
                {showSmsButton && (
                  <button
                    onClick={() => {
                      handleSignRequest(selectedProtocol);
                      setSelectedProtocol(null);
                      setTestAttempt(null);
                      setShowDetails(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {t('lms.pdek.signSms')}
                  </button>
                )}
                {showEdsButton && (
                  <button
                    onClick={() => {
                      if (selectedProtocol?.file) {
                        handleEDSSignRequest(selectedProtocol);
                        setSelectedProtocol(null);
                        setTestAttempt(null);
                        setShowDetails(false);
                      } else {
                        toast.error(t('lms.pdek.noProtocolFile') || 'Файл протокола не загружен');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    {t('lms.pdek.signEDS') || 'ЭЦП'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* EDS Sign Modal */}
      {showEDSModal && protocolToSign && (
        <EDSSignModal
          protocol={protocolToSign}
          onSuccess={handleEDSSuccess}
          onCancel={() => {
            setShowEDSModal(false);
            setProtocolToSign(null);
          }}
        />
      )}

      {/* SMS Verification Modal */}
      {showSMSModal && protocolToSign && (
        <SMSVerification
          phone={currentUser?.phone || ''}
          onVerified={handleSMSVerified}
          onCancel={() => {
            setShowSMSModal(false);
            setProtocolToSign(null);
          }}
          title={t('lms.pdek.protocolNumber', { number: protocolToSign.number })}
          description={t('lms.pdek.otpDescription')}
          purpose="protocol_sign"
          onResend={async () => {
            if (protocolToSign) {
              await protocolsService.requestSignature(protocolToSign.id);
              toast.success(t('lms.pdek.otpSent'));
            }
          }}
        />
      )}
    </div>
  );
}
