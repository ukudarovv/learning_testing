import { apiClient } from './api';

export interface CategoryEcReviewer {
  id: number | string;
  full_name?: string;
  phone?: string;
  role?: string;
}

export interface Category {
  id: string;
  name: string;
  name_kz?: string;
  name_en?: string;
  description?: string;
  icon?: string;
  order: number;
  is_active: boolean;
  courses_count?: number;
  ec_reviewers?: CategoryEcReviewer[];
  /** Send on create/update; empty = all EC members */
  ec_reviewer_ids?: number[];
  created_at?: string;
  updated_at?: string;
}

const categoriesService = {
  async getCategories(params?: { is_active?: boolean }): Promise<Category[]> {
    const data = await apiClient.get<any>('/courses/categories/', params);
    
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return data.results;
    }
    
    return [];
  },

  async getCategory(id: string): Promise<Category> {
    return apiClient.get<Category>(`/courses/categories/${id}/`);
  },

  async createCategory(category: Partial<Category>): Promise<Category> {
    return apiClient.post<Category>('/courses/categories/', category);
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category> {
    return apiClient.put<Category>(`/courses/categories/${id}/`, category);
  },

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/courses/categories/${id}/`);
  },
};

export { categoriesService };

