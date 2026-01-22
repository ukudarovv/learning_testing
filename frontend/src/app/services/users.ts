import { apiClient } from './api';
import { User } from '../types/lms';
import { PaginatedResponse, PaginationParams } from '../types/pagination';

const usersService = {
  async getUsers(params?: { 
    role?: string; 
    verified?: boolean;
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<User>> {
    const data = await apiClient.get<any>('/users/', params);
    
    // Backend возвращает пагинированный ответ Django REST Framework
    if (data && typeof data === 'object' && Array.isArray(data.results)) {
      return {
        results: data.results,
        count: data.count || data.results.length,
        next: data.next || null,
        previous: data.previous || null,
      };
    }
    
    // Fallback для непагинированных ответов (обратная совместимость)
    if (Array.isArray(data)) {
      return {
        results: data,
        count: data.length,
        next: null,
        previous: null,
      };
    }
    
    // Если данные в другом формате
    if (data && typeof data === 'object') {
      const results = data.data || data.users || [];
      return {
        results: Array.isArray(results) ? results : [],
        count: data.count || results.length,
        next: data.next || null,
        previous: data.previous || null,
      };
    }
    
    return {
      results: [],
      count: 0,
      next: null,
      previous: null,
    };
  },

  async getUser(id: string): Promise<User> {
    return apiClient.get<User>(`/users/${id}/`);
  },

  async createUser(user: Partial<User & { password?: string }>): Promise<User & { generated_password?: string }> {
    // Convert frontend format to backend format
    const backendUser: any = {
      ...user,
      full_name: user.fullName || user.full_name,
    };
    // Remove frontend-specific fields
    delete backendUser.fullName;
    delete backendUser.company; // Backend uses 'organization'
    if (user.company) {
      backendUser.organization = user.company;
    }
    // Пароль передается как есть (или не передается, тогда будет сгенерирован)
    const response = await apiClient.post<User & { generated_password?: string }>('/users/', backendUser);
    return response;
  },

  async updateUser(id: string, user: Partial<User & { verification_code?: string }>): Promise<User> {
    // Convert frontend format to backend format
    const backendUser: any = {
      ...user,
      full_name: user.fullName || user.full_name,
    };
    // Remove frontend-specific fields
    delete backendUser.fullName;
    delete backendUser.company; // Backend uses 'organization'
    if (user.company) {
      backendUser.organization = user.company;
    }
    // Remove password if it's empty or not provided (don't send empty password)
    if (!backendUser.password || backendUser.password.trim() === '') {
      delete backendUser.password;
    }
    // Keep verification_code if provided (for phone number change)
    if (user.verification_code) {
      backendUser.verification_code = user.verification_code;
    }
    return apiClient.put<User>(`/users/${id}/`, backendUser);
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}/`);
  },

  async exportUsers(): Promise<Blob> {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/users/export/`, {
      headers: {
        'Authorization': `Bearer ${apiClient.getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to export users');
    }
    
    return response.blob();
  },

  async importUsers(file: File): Promise<{ imported: number; errors: any[] }> {
    return apiClient.upload('/users/import_users/', file);
  },
};

export { usersService };

