import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { authService } from '../services/auth';
import { ApiError } from '../services/api';

type Step = 'request' | 'verify' | 'setPassword';

export function PasswordResetForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await authService.requestPasswordReset(phone);
      setSuccess(t('forms.passwordReset.codeSent'));
      
      // Move to verify code step
      setStep('verify');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || t('forms.passwordReset.requestError'));
      } else {
        setError(t('forms.passwordReset.requestError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await authService.verifyPasswordResetCode(phone, code);
      
      if (response.verified) {
        setSuccess(t('forms.passwordReset.codeVerified'));
        // Move to set password step
        setTimeout(() => {
          setStep('setPassword');
          setSuccess('');
        }, 1000);
      } else {
        setError(response.error || t('forms.passwordReset.codeVerificationError'));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMessage = err.data?.error || err.message || t('forms.passwordReset.codeVerificationError');
        setError(errorMessage);
      } else {
        setError(t('forms.passwordReset.codeVerificationError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError(t('forms.passwordReset.passwordsDoNotMatch'));
      return;
    }
    
    // Validate password length
    if (newPassword.length < 8) {
      setError(t('forms.passwordReset.passwordTooShort'));
      return;
    }
    
    setLoading(true);

    try {
      await authService.confirmPasswordReset(phone, code, newPassword);
      setSuccess(t('forms.passwordReset.success'));
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login', { state: { message: t('forms.passwordReset.loginWithNewPassword') } });
      }, 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        const errorMessage = err.data?.error || err.message || t('forms.passwordReset.confirmError');
        setError(errorMessage);
      } else {
        setError(t('forms.passwordReset.confirmError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
  };

  const normalizePhone = (phoneValue: string) => {
    return phoneValue.replace(/\D/g, '');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <img 
              src="/logo.jpg" 
              alt="UNICOVER Logo" 
              className="h-16 w-auto object-contain mx-auto mb-4"
            />
            <h2 className="text-3xl font-bold text-gray-900">
              {step === 'request' 
                ? t('forms.passwordReset.title')
                : step === 'verify'
                ? t('forms.passwordReset.verifyTitle')
                : t('forms.passwordReset.setPasswordTitle')}
            </h2>
            <p className="text-gray-600 mt-2">
              {step === 'request' 
                ? t('forms.passwordReset.subtitle')
                : step === 'verify'
                ? t('forms.passwordReset.verifySubtitle')
                : t('forms.passwordReset.setPasswordSubtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestCode} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.passwordReset.phone')}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(normalizePhone(e.target.value))}
                    placeholder={t('forms.passwordReset.phonePlaceholder')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('forms.passwordReset.phoneHint')}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !phone}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('forms.passwordReset.sending') : t('forms.passwordReset.sendCode')}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  {t('forms.passwordReset.backToLogin')}
                </Link>
              </div>
            </form>
          ) : step === 'verify' ? (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.passwordReset.code')}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder={t('forms.passwordReset.codePlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-bold tracking-widest"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || !code || code.length !== 6}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('forms.passwordReset.verifying') : t('forms.passwordReset.verifyCode')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('request');
                    setCode('');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('forms.passwordReset.back')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.passwordReset.newPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('forms.passwordReset.newPasswordPlaceholder')}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {t('forms.passwordReset.passwordHint')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('forms.passwordReset.confirmPassword')}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('forms.passwordReset.confirmPasswordPlaceholder')}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('forms.passwordReset.resetting') : t('forms.passwordReset.resetPassword')}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep('verify');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('forms.passwordReset.back')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
