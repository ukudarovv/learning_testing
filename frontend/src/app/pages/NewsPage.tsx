import { Header } from '../components/Header';
import { SiteFooter } from '../components/SiteFooter';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Newspaper, Calendar, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { newsService } from '../services/news';
import { News, NewsCategory } from '../types/news';

function getLocalizedField<T extends { title?: string; title_kz?: string; title_en?: string; excerpt?: string; excerpt_kz?: string; excerpt_en?: string }>(
  item: T,
  field: 'title' | 'excerpt',
  lang: string
): string {
  if (lang === 'kz' && field === 'title' && item.title_kz) return item.title_kz;
  if (lang === 'kz' && field === 'excerpt' && item.excerpt_kz) return item.excerpt_kz;
  if (lang === 'en' && field === 'title' && item.title_en) return item.title_en;
  if (lang === 'en' && field === 'excerpt' && item.excerpt_en) return item.excerpt_en;
  return (item as any)[field] || '';
}

function getLocalizedCategoryName(category: NewsCategory, lang: string): string {
  if (lang === 'kz' && category.name_kz) return category.name_kz;
  if (lang === 'en' && category.name_en) return category.name_en;
  return category.name;
}

export function NewsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'ru';
  const [newsList, setNewsList] = useState<News[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [newsData, categoriesData] = await Promise.all([
          newsService.getNews({ ordering: '-published_at' }),
          newsService.getNewsCategories(),
        ]);
        setNewsList(newsData);
        setCategories(categoriesData);
      } catch (err: any) {
        console.error('Failed to load news:', err);
        setError(t('news.loadError') || 'Не удалось загрузить новости');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, string> = { ordering: '-published_at' };
        if (selectedCategory) {
          params.category_id = selectedCategory;
        }
        if (searchQuery) {
          params.search = searchQuery;
        }
        const data = await newsService.getNews(params);
        setNewsList(data);
      } catch (err: any) {
        console.error('Failed to load news:', err);
        setError(t('news.loadError') || 'Не удалось загрузить новости');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [selectedCategory, searchQuery]);

  return (
    <>
      <Header />
      <main className="pt-20">
        <div className="bg-gray-50 py-12">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-600 px-4 py-2 rounded-full mb-4">
                <Newspaper className="w-5 h-5" />
                <span className="font-medium">{t('news.badge') || 'Новости'}</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{t('news.pageTitle') || 'Новости'}</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                {t('news.description') || 'Актуальные новости и события'}
              </p>
            </div>

            <div className="max-w-4xl mx-auto mb-8">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder={t('news.searchPlaceholder') || 'Поиск по заголовку...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div className="md:w-64">
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                      >
                        <option value="">{t('news.allCategories') || 'Все категории'}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {getLocalizedCategoryName(category, lang)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">{t('news.loading') || 'Загрузка...'}</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && newsList.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600">{t('news.notFound') || 'Новости не найдены'}</p>
            </div>
          )}

          {!loading && !error && newsList.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {newsList.map((item) => (
                <Link
                  key={item.id}
                  to={`/news/${item.id}`}
                  className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow group block"
                >
                  <div className="relative overflow-hidden h-48 bg-gray-200">
                    <ImageWithFallback
                      src={item.image_url || item.image}
                      alt={getLocalizedField(item, 'title', lang)}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    {item.category && (
                      <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {getLocalizedCategoryName(item.category, lang)}
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">
                      {getLocalizedField(item, 'title', lang)}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {getLocalizedField(item, 'excerpt', lang) || (item.excerpt || '').slice(0, 150)}
                    </p>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {item.published_at
                          ? new Date(item.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'kz' ? 'kk-KZ' : 'ru-RU')
                          : item.created_at
                            ? new Date(item.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : lang === 'kz' ? 'kk-KZ' : 'ru-RU')
                            : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
