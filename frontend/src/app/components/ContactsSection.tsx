import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { contactsService, ContactMessageCreate } from '../services/contacts';
import { toast } from 'sonner';
import { formatRuKzPhoneInput } from '../utils/phoneInput';

export function ContactsSection() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ContactMessageCreate>({
    name: '',
    company: '',
    email: '',
    phone: '',
    direction: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Очищаем пустые поля перед отправкой
      const dataToSend: ContactMessageCreate = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        message: formData.message,
      };

      if (formData.company && formData.company.trim()) {
        dataToSend.company = formData.company.trim();
      }

      if (formData.direction && formData.direction.trim()) {
        dataToSend.direction = formData.direction as any;
      }

      await contactsService.createMessage(dataToSend);
      toast.success(t('homepage.contacts.form.successMessage'));
      setSubmitted(true);
      
      // Очищаем форму
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        direction: '',
        message: '',
      });
      
      // Сбрасываем состояние через 3 секунды
      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (error: any) {
      toast.error(error.message || t('homepage.contacts.form.errorMessage'));
      console.error('Failed to send contact message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contacts" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="inline-block bg-blue-100 text-blue-600 px-4 py-2 rounded-full mb-4">
            {t('homepage.contacts.badge')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('homepage.contacts.title')}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {t('homepage.contacts.description')}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {getContactInfo(t).map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">{t(item.titleKey)}</h3>
                    <p className="text-gray-600 whitespace-pre-line text-sm">{t(item.contentKey, item.contentParams)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('homepage.contacts.form.title')}</h3>
            
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-green-900 mb-2">{t('homepage.contacts.form.thankYou')}</h4>
                <p className="text-green-700">{t('homepage.contacts.form.contactSoon')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('homepage.contacts.form.name')} *
                  </label>
                  <input
                    type="text"
                    id="contact-name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    placeholder={t('homepage.contacts.form.namePlaceholder')}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="contact-company" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('homepage.contacts.form.company')}
                  </label>
                  <input
                    type="text"
                    id="contact-company"
                    value={formData.company || ''}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    placeholder={t('homepage.contacts.form.companyPlaceholder')}
                    disabled={loading}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('homepage.contacts.form.email')} *
                    </label>
                    <input
                      type="email"
                      id="contact-email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder={t('homepage.contacts.form.emailPlaceholder')}
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('homepage.contacts.form.phone')} *
                    </label>
                    <input
                      type="tel"
                      id="contact-phone"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: formatRuKzPhoneInput(e.target.value) })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder={t('homepage.contacts.form.phonePlaceholder')}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-direction" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('homepage.contacts.form.direction')}
                  </label>
                  <select
                    id="contact-direction"
                    value={formData.direction || ''}
                    onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    disabled={loading}
                  >
                    <option value="">{t('homepage.contacts.form.directionPlaceholder')}</option>
                    <option value="education">{t('homepage.contacts.form.directions.education')}</option>
                    <option value="other">{t('homepage.contacts.form.directions.other')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('homepage.contacts.form.message')} *
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all resize-none"
                    placeholder={t('homepage.contacts.form.messagePlaceholder')}
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white px-8 py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('homepage.contacts.form.sending') : t('homepage.contacts.form.submit')}
                </button>

                <p className="text-sm text-gray-500 text-center">
                  * {t('homepage.contacts.form.requiredFields')}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function getContactInfo(t: (key: string) => string) {
  return [
    {
      icon: Building2,
      titleKey: 'homepage.contacts.info.bin.title',
      contentKey: 'homepage.contacts.info.bin.content',
      contentParams: {},
    },
    {
      icon: MapPin,
      titleKey: 'homepage.contacts.info.address.title',
      contentKey: 'homepage.contacts.info.address.content',
      contentParams: {},
    },
    {
      icon: Phone,
      titleKey: 'homepage.contacts.info.phone.title',
      contentKey: 'homepage.contacts.info.phone.content',
      contentParams: {},
    },
    {
      icon: Mail,
      titleKey: 'homepage.contacts.info.email.title',
      contentKey: 'homepage.contacts.info.email.content',
      contentParams: {},
    },
    {
      icon: Clock,
      titleKey: 'homepage.contacts.info.workingHours.title',
      contentKey: 'homepage.contacts.info.workingHours.content',
      contentParams: {},
    },
  ];
}