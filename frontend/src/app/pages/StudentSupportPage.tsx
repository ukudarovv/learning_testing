import { Header } from '../components/Header';
import { FooterUnicover } from '../components/FooterUnicover';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, ArrowLeft } from 'lucide-react';

export function StudentSupportPage() {
  const { t } = useTranslation();
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              to="/student/dashboard"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('pages.support.backToDashboard')}
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('pages.support.title')}</h1>
            <p className="text-gray-600">{t('pages.support.description')}</p>
          </div>

          <div className="max-w-4xl mx-auto">
            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('pages.support.contactInfo')}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-start">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{t('pages.support.phone')}</h3>
                    <a href="tel:+77001234567" className="text-blue-600 hover:text-blue-700">
                      +7 (700) 123-45-67
                    </a>
                    <p className="text-sm text-gray-600 mt-1">{t('pages.support.workingHours')}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <Mail className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{t('pages.support.email')}</h3>
                    <a href="mailto:info@aqlant.com" className="text-blue-600 hover:text-blue-700">
                      info@aqlant.com
                    </a>
                    <p className="text-sm text-gray-600 mt-1">{t('pages.support.responseTime')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="bg-white rounded-lg shadow-md p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('pages.support.faq')}</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('pages.support.faq1.question')}</h3>
                  <p className="text-gray-600">
                    {t('pages.support.faq1.answer')}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('pages.support.faq2.question')}</h3>
                  <p className="text-gray-600">
                    {t('pages.support.faq2.answer')}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('pages.support.faq3.question')}</h3>
                  <p className="text-gray-600">
                    {t('pages.support.faq3.answer')}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{t('pages.support.faq4.question')}</h3>
                  <p className="text-gray-600">
                    {t('pages.support.faq4.answer')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FooterUnicover />
    </>
  );
}

