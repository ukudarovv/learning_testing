import { Header } from '../components/Header';
import { FooterUnicover } from '../components/FooterUnicover';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Calendar, ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { newsService } from '../services/news';
import { NewsDetail, NewsCategory } from '../types/news';

function getLocalizedContent(
  item: NewsDetail,
  lang: string
): { title: string; excerpt: string; content: string } {
  const title = lang === 'kz' && item.title_kz ? item.title_kz : lang === 'en' && item.title_en ? item.title_en : item.title || '';
  const excerpt = lang === 'kz' && item.excerpt_kz ? item.excerpt_kz : lang === 'en' && item.excerpt_en ? item.excerpt_en : item.excerpt || '';
  const content = lang === 'kz' && item.content_kz ? item.content_kz : lang === 'en' && item.content_en ? item.content_en : item.content || '';
  return { title, excerpt, content };
}

function getLocalizedCategoryName(category: NewsCategory, lang: string): string {
  if (lang === 'kz' && category.name_kz) return category.name_kz;
  if (lang === 'en' && category.name_en) return category.name_en;
  return category.name;
}

export function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'ru';
  const [news, setNews] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNews = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError(null);
        const data = await newsService.getNewsItem(id);
        setNews(data);
      } catch (err: any) {
        console.error('Failed to load news:', err);
        setError(t('news.loadError') || 'Не удалось загрузить новость');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">{t('news.loading') || 'Загрузка...'}</p>
            </div>
          </div>
        </main>
        <FooterUnicover />
      </>
    );
  }

  if (error || !news) {
    return (
      <>
        <Header />
        <main className="pt-20">
          <div className="container mx-auto px-4 py-12">
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error || (t('news.notFound') || 'Новость не найдена')}</p>
              <Link
                to="/news"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('news.backToList') || 'Вернуться к списку новостей'}
              </Link>
            </div>
          </div>
        </main>
        <FooterUnicover />
      </>
    );
  }

  const { title, content } = getLocalizedContent(news, lang);
  const dateStr = news.published_at
    ? new Date(news.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : news.created_at
      ? new Date(news.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'kz' ? 'kk-KZ' : 'ru-RU', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

  return (
    <>
      <Header />
      <main className="pt-20">
        <div className="bg-gray-900 text-white py-16">
          <div className="container mx-auto px-4">
            <Link
              to="/news"
              className="inline-flex items-center gap-2 text-blue-300 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('news.backToList') || 'Вернуться к списку новостей'}
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
            <div className="flex flex-wrap gap-6 text-blue-200">
              {news.category && (
                <div className="inline-flex items-center gap-2 bg-blue-800 px-4 py-2 rounded-full">
                  {getLocalizedCategoryName(news.category, lang)}
                </div>
              )}
              {dateStr && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span>{dateStr}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            {(news.image_url || news.image) && (
              <div className="mb-8 rounded-xl overflow-hidden shadow-lg">
                <ImageWithFallback
                  src={news.image_url || news.image}
                  alt={title}
                  className="w-full h-auto object-cover"
                />
              </div>
            )}
            <div className="prose prose-lg max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{content}</div>
            </div>
          </div>
        </div>
      </main>
      <FooterUnicover />
    </>
  );
}
