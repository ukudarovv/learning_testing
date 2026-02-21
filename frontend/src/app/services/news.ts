import { apiClient } from './api';
import { News, NewsDetail, NewsCategory } from '../types/news';

const newsService = {
  async getNews(params?: {
    category?: string;
    category_id?: string;
    is_published?: boolean;
    search?: string;
    ordering?: string;
  }): Promise<News[]> {
    const data = await apiClient.get<any>('/news/', params);

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (Array.isArray(data.data)) {
        return data.data;
      }
      if (Array.isArray(data.news)) {
        return data.news;
      }
    }

    console.warn('Unexpected response format for news, returning empty array:', data);
    return [];
  },

  async getNewsItem(id: string): Promise<NewsDetail> {
    return apiClient.get<NewsDetail>(`/news/${id}/`);
  },

  async getNewsCategories(): Promise<NewsCategory[]> {
    const data = await apiClient.get<any>('/news/categories/');

    if (Array.isArray(data)) {
      return data;
    }

    if (data && typeof data === 'object') {
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (Array.isArray(data.data)) {
        return data.data;
      }
      if (Array.isArray(data.categories)) {
        return data.categories;
      }
    }

    console.warn('Unexpected response format for news categories, returning empty array:', data);
    return [];
  },

  async createNews(news: Partial<News>, imageFile?: File): Promise<News> {
    const formData = new FormData();

    Object.entries(news).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'image') {
        formData.append(key, String(value));
      }
    });

    if (imageFile) {
      formData.append('image', imageFile);
    }

    return apiClient.post<News>('/news/', formData, {
      headers: {},
    });
  },

  async updateNews(id: string, news: Partial<News>, imageFile?: File): Promise<News> {
    const formData = new FormData();

    Object.entries(news).forEach(([key, value]) => {
      if (value !== undefined && value !== null && key !== 'image') {
        formData.append(key, String(value));
      }
    });

    if (imageFile) {
      formData.append('image', imageFile);
    }

    return apiClient.put<News>(`/news/${id}/`, formData, {
      headers: {},
    });
  },

  async deleteNews(id: string): Promise<void> {
    return apiClient.delete(`/news/${id}/`);
  },

  async createCategory(category: Partial<NewsCategory>): Promise<NewsCategory> {
    return apiClient.post<NewsCategory>('/news/categories/', category);
  },

  async updateCategory(id: string, category: Partial<NewsCategory>): Promise<NewsCategory> {
    return apiClient.put<NewsCategory>(`/news/categories/${id}/`, category);
  },

  async deleteCategory(id: string): Promise<void> {
    return apiClient.delete(`/news/categories/${id}/`);
  },
};

export { newsService };
