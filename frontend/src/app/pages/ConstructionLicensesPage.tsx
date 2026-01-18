import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { FooterUnicover } from '../components/FooterUnicover';
import { FileText, Download, Award, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { licensesService, License } from '../services/licenses';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function ConstructionLicensesPage() {
  const { t, i18n } = useTranslation();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const currentLanguage = i18n.language || localStorage.getItem('language') || 'ru';
  const localeMap: Record<string, string> = {
    'ru': 'ru-RU',
    'kz': 'kk-KZ',
    'en': 'en-US'
  };
  const currentLocale = localeMap[currentLanguage] || 'ru-RU';

  const categories = [
    { value: 'all', label: t('licenses.categories.all') },
    { value: 'surveying', label: t('licenses.categories.surveying') },
    { value: 'construction', label: t('licenses.categories.construction') },
  ];

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        setLoading(true);
        const data = await licensesService.getLicenses({ is_active: true });
        setLicenses(data);
      } catch (error: any) {
        console.error('Failed to fetch licenses:', error);
        toast.error(t('licenses.errors.loadError'));
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  }, []);

  const filteredLicenses = selectedCategory === 'all' 
    ? licenses 
    : licenses.filter(license => {
        // Если category - объект, проверяем slug
        if (license.category && typeof license.category === 'object' && 'slug' in license.category) {
          return license.category.slug === selectedCategory;
        }
        // Если category - строка (старый формат)
        if (typeof license.category === 'string') {
          return license.category === selectedCategory;
        }
        return false;
      });

  const getCategoryLabel = (category: any): string => {
    // Если категория - объект LicenseCategory
    if (category && typeof category === 'object' && 'name' in category) {
      // Используем язык интерфейса
      if (currentLanguage === 'kz' && category.name_kz) {
        return category.name_kz;
      }
      if (currentLanguage === 'en' && category.name_en) {
        return category.name_en;
      }
      return category.name || '—';
    }
    // Если категория - строка (slug или старое значение)
    if (typeof category === 'string') {
      if (category === 'all') return t('licenses.categories.all');
      if (category === 'surveying') return t('licenses.categories.surveying');
      if (category === 'construction') return t('licenses.categories.construction');
      return category;
    }
    // Если категория - число (ID) или другой тип
    return '—';
  };

  const handleDownload = async (license: License) => {
    if (!license.file_url) {
      toast.error(t('licenses.errors.fileUnavailable'));
      return;
    }

    try {
      if (license.id) {
        const blob = await licensesService.downloadLicense(license.id);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${license.number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(t('licenses.success.downloadSuccess'));
      } else {
        // Fallback to direct URL
        window.open(license.file_url, '_blank');
      }
    } catch (error: any) {
      console.error('Failed to download license:', error);
      toast.error(t('licenses.errors.downloadError'));
    }
  };

  return (
    <>
      <Header />
      <main className="pt-20">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
                <Award className="w-5 h-5" />
                <span className="font-medium">{t('licenses.badge')}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">{t('licenses.title')}</h1>
              <p className="text-xl text-blue-100 leading-relaxed">
                {t('licenses.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex items-center gap-2 text-sm text-gray-600">
              <Link to="/" className="hover:text-blue-600 transition-colors">{t('common.home')}</Link>
              <span>/</span>
              <Link to="/construction" className="hover:text-blue-600 transition-colors">{t('common.construction')}</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">{t('licenses.breadcrumbs.licenses')}</span>
            </nav>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {/* Filter */}
          <div className="mb-8 flex flex-wrap gap-3">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === category.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="ml-3 text-gray-600">{t('licenses.loading')}</span>
            </div>
          ) : filteredLicenses.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">{t('licenses.notFound')}</p>
            </div>
          ) : (
            <>
              {/* Licenses Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {filteredLicenses.map((license) => (
                  <div
                    key={license.id}
                    className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow border border-gray-200 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full">
                        {license.category_display || getCategoryLabel(license.category)}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{license.title}</h3>
                    {license.description && (
                      <p className="text-sm text-gray-600 mb-4">{license.description}</p>
                    )}
                    
                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('licenses.card.number')}</span>
                        <span className="font-medium text-gray-900">{license.number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('licenses.card.issued')}</span>
                        <span className="font-medium text-gray-900">
                          {new Date(license.issued_date).toLocaleDateString(currentLocale)}
                        </span>
                      </div>
                      {license.valid_until && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">{t('licenses.card.validUntil')}</span>
                          <span className="font-medium text-gray-900">
                            {new Date(license.valid_until).toLocaleDateString(currentLocale)}
                          </span>
                        </div>
                      )}
                    </div>

                    {license.file_url ? (
                      <button
                        onClick={() => handleDownload(license)}
                        className="flex items-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        {t('licenses.card.download')}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-sm">
                        <FileText className="w-4 h-4" />
                        {t('licenses.card.fileUnavailable')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('licenses.info.title')}</h3>
            <p className="text-gray-700 mb-4">
              {t('licenses.info.description1')}
            </p>
            <p className="text-gray-700">
              {t('licenses.info.description2')}{' '}
              <Link to="/contacts" className="text-blue-600 hover:underline font-medium">
                {t('licenses.info.contactLink')}
              </Link>.
            </p>
          </div>
        </div>
      </main>
      <FooterUnicover />
    </>
  );
}

