import { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { useTranslation } from 'react-i18next';
import { apiClient } from '../services/api';
import { Loader2 } from 'lucide-react';

export function TermsPage() {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setLoading(true);
        const lang = i18n.language || 'ru';
        const response = await apiClient.get<{ content: string; page_type: string; language: string }>(
          `/core/content-pages/by-type/terms/?lang=${lang}`
        );
        setContent(response.content);
        setError('');
      } catch (err: any) {
        console.error('Failed to load terms content:', err);
        setError(err.message || 'Failed to load content');
        setContent('');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [i18n.language]);

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-8">
                {t('pages.terms.title') || 'Условия использования'}
              </h1>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  {error}
                </div>
              ) : (
                <div 
                  className="prose prose-lg max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}
                />
              )}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
