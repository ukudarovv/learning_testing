import { apiClient } from './api';

export interface LicenseCategory {
  id: string;
  name: string;
  name_kz?: string;
  name_en?: string;
  slug: string;
  description?: string;
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface License {
  id: string;
  title: string;
  number: string;
  category?: LicenseCategory | string | number; // Может быть объект, строка (slug) или ID
  category_display?: string;
  category_id?: string | number;
  description?: string;
  file?: string;
  file_url?: string;
  issued_date: string;
  valid_until?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const licensesService = {
  async getLicenses(params?: { category?: string; is_active?: boolean }): Promise<License[]> {
    const data = await apiClient.get<any>('/licenses/', params);
    
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
      if (Array.isArray(data.licenses)) {
        return data.licenses;
      }
    }
    
    console.warn('Unexpected response format for licenses, returning empty array:', data);
    return [];
  },

  async getLicense(id: string): Promise<License> {
    return apiClient.get<License>(`/licenses/${id}/`);
  },

  async createLicense(license: Partial<License>, file?: File): Promise<License> {
    const formData = new FormData();
    
    Object.keys(license).forEach(key => {
      const value = license[key as keyof License];
      if (key === 'valid_until') {
        // Для valid_until отправляем только если есть значение
        if (value !== undefined && value !== null && value !== '') {
          formData.append(key, String(value));
        }
      } else if (key === 'category') {
        // Если category - объект, отправляем category_id, иначе - строку/число как есть
        if (value && typeof value === 'object' && 'id' in value) {
          formData.append('category_id', String(value.id));
        } else if (value !== undefined && value !== null) {
          formData.append('category', String(value));
        }
      } else if (value !== undefined && value !== null && key !== 'file' && key !== 'file_url' && key !== 'category_display') {
        formData.append(key, String(value));
      }
    });
    
    if (file) {
      formData.append('file', file);
    }
    
    return apiClient.post<License>('/licenses/', formData);
  },

  async updateLicense(id: string, license: Partial<License>, file?: File): Promise<License> {
    const formData = new FormData();
    
    Object.keys(license).forEach(key => {
      const value = license[key as keyof License];
      if (key === 'valid_until') {
        // Для valid_until явно отправляем пустую строку, если undefined/null, чтобы очистить поле
        if (value === undefined || value === null || value === '') {
          formData.append(key, '');
        } else {
          formData.append(key, String(value));
        }
      } else if (key === 'category') {
        // Если category - объект, отправляем category_id, иначе - строку/число как есть
        if (value && typeof value === 'object' && 'id' in value) {
          formData.append('category_id', String(value.id));
        } else if (value !== undefined && value !== null) {
          formData.append('category', String(value));
        }
      } else if (value !== undefined && value !== null && key !== 'file' && key !== 'file_url' && key !== 'category_display') {
        formData.append(key, String(value));
      }
    });
    
    if (file) {
      formData.append('file', file);
    }
    
    return apiClient.put<License>(`/licenses/${id}/`, formData);
  },

  async deleteLicense(id: string): Promise<void> {
    return apiClient.delete(`/licenses/${id}/`);
  },

  async downloadLicense(id: string): Promise<Blob> {
    // Use apiClient with blob response type
    return apiClient.get<Blob>(`/licenses/${id}/download/`, undefined, { responseType: 'blob' });
  },
};

const licenseCategoriesService = {
  async getCategories(): Promise<LicenseCategory[]> {
    const data = await apiClient.get<any>('/licenses/categories/');
    
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
    
    console.warn('Unexpected response format for license categories, returning empty array:', data);
    return [];
  },

  async getCategory(id: string): Promise<LicenseCategory> {
    return apiClient.get<LicenseCategory>(`/licenses/categories/${id}/`);
  },

  async createCategory(category: Partial<LicenseCategory>): Promise<LicenseCategory> {
    return apiClient.post<LicenseCategory>('/licenses/categories/', category);
  },

  async updateCategory(id: string, category: Partial<LicenseCategory>): Promise<LicenseCategory> {
    return apiClient.put<LicenseCategory>(`/licenses/categories/${id}/`, category);
  },

  async deleteCategory(id: string): Promise<void> {
    return apiClient.delete(`/licenses/categories/${id}/`);
  },
};

export { licensesService, licenseCategoriesService };

