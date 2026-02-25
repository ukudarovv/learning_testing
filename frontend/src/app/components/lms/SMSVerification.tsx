import { useState, useEffect } from 'react';
import { Phone, Shield, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { smsService, SMSPurpose } from '../../services/smsService';

interface SMSVerificationProps {
  phone: string;
  onVerified: (otp: string) => void | Promise<void>;
  onCancel: () => void;
  title?: string;
  description?: string;
  purpose?: SMSPurpose; // Purpose of SMS verification
  onResend?: () => Promise<void>; // Optional callback for resend
  debugCode?: string | null; // OTP in debug mode (SMSC not configured)
}

export function SMSVerification({ 
  phone, 
  onVerified, 
  onCancel,
  title,
  description,
  purpose = 'verification',
  onResend,
  debugCode
}: SMSVerificationProps) {
  const { t } = useTranslation();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timeLeft, setTimeLeft] = useState(120); // 2 минуты
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  
  const displayTitle = title || t('lms.coursePlayer.smsVerificationTitle');
  const displayDescription = description || t('lms.coursePlayer.smsVerificationDescription');

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every(digit => digit !== '') && index === 5) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length !== 6) {
      setError(t('lms.coursePlayer.smsVerificationCodeError'));
      setOtp(['', '', '', '', '', '']);
      document.getElementById('otp-0')?.focus();
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      await Promise.resolve(onVerified(code));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      setError('');
      setCanResend(false);
      setTimeLeft(120);
      setOtp(['', '', '', '', '', '']);
      
      // If custom resend handler provided, use it
      if (onResend) {
        await onResend();
      } else {
        // Otherwise use default SMS service
        await smsService.sendVerificationCode(phone, purpose);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to resend SMS code');
      setCanResend(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const maskPhone = (phone: string) => {
    return phone.replace(/(\+7)(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 ($2) ***-**-$5');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl ring-4 ring-white ring-opacity-50 max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{displayTitle}</h2>
          <p className="text-gray-600 text-sm mb-4">{displayDescription}</p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <Phone className="w-4 h-4" />
            <span>{t('lms.coursePlayer.smsVerificationCodeSent', { phone: maskPhone(phone) })}</span>
          </div>
          {debugCode && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <p className="text-sm font-medium text-amber-800 mb-1">
                {t('lms.coursePlayer.smsVerificationTestCode')}
              </p>
              <p className="text-lg font-mono font-bold text-amber-900">{debugCode}</p>
              <p className="text-xs text-amber-700 mt-1">
                {t('lms.coursePlayer.smsVerificationEnterCode')}
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* OTP Input */}
        <div className="mb-6">
          <div className="flex gap-2 justify-center mb-4">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                disabled={isVerifying}
              />
            ))}
          </div>

          {/* "Код не пришёл?" hint */}
          <p className="text-center text-sm text-gray-600 mb-2">
            {t('lms.coursePlayer.codeNotReceived')}{' '}
            <span className="text-gray-500">{t('lms.coursePlayer.codeNotReceivedHint')}</span>
          </p>

          {/* Timer */}
          <div className="text-center">
            {!canResend ? (
              <p className="text-sm text-gray-500">
                {t('lms.coursePlayer.smsVerificationCodeValid', { time: formatTime(timeLeft) })}
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('lms.coursePlayer.smsVerificationResend')}
              </button>
            )}
          </div>
        </div>


        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            disabled={isVerifying}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => handleVerify(otp.join(''))}
            disabled={otp.some(d => !d) || isVerifying}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('lms.coursePlayer.smsVerificationVerifying')}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                {t('lms.coursePlayer.smsVerificationVerify')}
              </>
            )}
          </button>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-xs text-gray-500 text-center">
          {t('lms.coursePlayer.smsVerificationSecurityNotice')}
        </p>
      </div>
    </div>
  );
}
