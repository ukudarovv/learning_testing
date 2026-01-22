import { Header } from '../components/Header';
import { FooterUnicover } from '../components/FooterUnicover';
import { Search, CheckCircle, XCircle, Calendar, User, BookOpen, Award, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { certificatesService } from '../services/certificates';
import { Certificate } from '../types/lms';

export function VerifyCertificatePage() {
  const { t, i18n } = useTranslation();
  const { certificateNumber } = useParams<{ certificateNumber?: string }>();
  const navigate = useNavigate();
  const [certificateNumberInput, setCertificateNumberInput] = useState(certificateNumber || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    certificate?: Certificate;
    error?: string;
    message?: string;
  } | null>(null);

  const currentLanguage = i18n.language || localStorage.getItem('language') || 'ru';
  const localeMap: Record<string, string> = {
    'ru': 'ru-RU',
    'kz': 'kk-KZ',
    'en': 'en-US'
  };
  const currentLocale = localeMap[currentLanguage] || 'ru-RU';

  useEffect(() => {
    // Если номер сертификата передан в URL, автоматически проверить
    if (certificateNumber) {
      handleVerify(certificateNumber);
    }
  }, [certificateNumber]);

  const handleVerify = async (number?: string) => {
    const certNumber = number || certificateNumberInput.trim();
    
    if (!certNumber) {
      setResult({
        valid: false,
        error: t('pages.verifyCertificate.enterNumber'),
        message: t('pages.verifyCertificate.enterNumberMessage')
      });
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      
      const response = await certificatesService.verifyCertificate(certNumber);
      
      setResult(response);
      
      // Обновить URL если проверка успешна
      if (response.valid && response.certificate) {
        navigate(`/verify/${certNumber}`, { replace: true });
      }
    } catch (error: any) {
      console.error('Error verifying certificate:', error);
      setResult({
        valid: false,
        error: error.message || t('pages.verifyCertificate.verificationError'),
        message: t('pages.verifyCertificate.verificationErrorMessage')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Award className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                {t('pages.verifyCertificate.title')}
              </h1>
              <p className="text-gray-600">
                {t('pages.verifyCertificate.description')}
              </p>
            </div>

            {/* Search Form */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-6">
              <form onSubmit={handleSubmit} className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={certificateNumberInput}
                    onChange={(e) => setCertificateNumberInput(e.target.value)}
                    placeholder={t('pages.verifyCertificate.placeholder')}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !certificateNumberInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('common.loading')}</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      <span>{t('pages.verifyCertificate.verify')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Results */}
            {result && (
              <div className="bg-white rounded-xl shadow-md p-6">
                {result.valid && result.certificate ? (
                  <div>
                    {/* Success Header */}
                    <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-200">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {t('pages.verifyCertificate.valid')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {result.message || t('pages.verifyCertificate.validDescription')}
                        </p>
                      </div>
                    </div>

                    {/* Certificate Details */}
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Award className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.certificateNumber')}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">{result.certificate.number}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <BookOpen className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.course')}</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">
                            {result.certificate.course?.title || result.certificate.courseName || result.certificate.test?.title || result.certificate.testName || t('common.error')}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <User className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.student')}</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">
                            {result.certificate.student?.full_name || result.certificate.userName || t('common.error')}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-gray-600 mb-2">
                            <Calendar className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.issueDate')}</span>
                          </div>
                          <p className="text-lg font-semibold text-gray-900">
                            {result.certificate.issued_at || result.certificate.issuedAt
                              ? new Date(result.certificate.issued_at || result.certificate.issuedAt).toLocaleDateString(currentLocale, {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })
                              : t('common.error')}
                          </p>
                        </div>
                      </div>

                      {result.certificate.valid_until || result.certificate.validUntil ? (
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                          <div className="flex items-center gap-2 text-blue-800 mb-1">
                            <Calendar className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.validUntil')}</span>
                          </div>
                          <p className="text-lg font-semibold text-blue-900">
                            {new Date(result.certificate.valid_until || result.certificate.validUntil).toLocaleDateString(currentLocale, {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                          <div className="flex items-center gap-2 text-green-800">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">{t('pages.verifyCertificate.valid')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Error Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {t('pages.verifyCertificate.notFound')}
                        </h2>
                        <p className="text-sm text-gray-600">
                          {result.message || result.error || t('pages.verifyCertificate.notFoundMessage')}
                        </p>
                      </div>
                    </div>

                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <p className="text-red-800">
                        {result.error && (result.error.includes('не найден') || result.error.includes('not found') || result.error.includes('табылмады'))
                          ? t('pages.verifyCertificate.errorCheckMessage')
                          : result.error || t('pages.verifyCertificate.verificationErrorMessage')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Section */}
            {!result && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  {t('pages.verifyCertificate.howToVerify')}
                </h3>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">1.</span>
                    <span>{t('pages.verifyCertificate.instruction1')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">2.</span>
                    <span>{t('pages.verifyCertificate.instruction2')}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">3.</span>
                    <span>{t('pages.verifyCertificate.instruction3')}</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
      <FooterUnicover />
    </>
  );
}

