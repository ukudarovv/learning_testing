import { apiClient } from './api';
import { User } from '../types/lms';
import { PaginatedResponse, PaginationParams } from '../types/pagination';

export type AdminUserPayload = Partial<
  User & {
    password?: string;
    verification_code?: string;
    profile_photo?: File | null;
    clear_profile_photo?: boolean;
    /** ID категорий пользователя (accounts.UserCategory); пустой массив снимает все */
    user_category_ids?: number[];
  }
>;

function appendUserFieldsToFormData(form: FormData, user: AdminUserPayload): void {
  const full_name = user.fullName || user.full_name;
  if (full_name !== undefined) form.append('full_name', String(full_name));
  if (user.phone !== undefined) form.append('phone', String(user.phone));
  if (user.email !== undefined) form.append('email', String(user.email));
  if (user.iin !== undefined) form.append('iin', String(user.iin ?? ''));
  if (user.role !== undefined) form.append('role', String(user.role));
  if (user.city !== undefined) form.append('city', String(user.city ?? ''));
  const org = user.organization ?? (user as { company?: string }).company;
  if (org !== undefined) form.append('organization', String(org ?? ''));
  if (user.language !== undefined) form.append('language', String(user.language));
  if (user.verified !== undefined) form.append('verified', user.verified ? 'true' : 'false');
  if (user.is_active !== undefined) form.append('is_active', user.is_active ? 'true' : 'false');
  if (user.password?.trim()) form.append('password', user.password);
  if (user.verification_code) form.append('verification_code', user.verification_code);
  const psm = (user as { protocol_sign_method?: string }).protocol_sign_method;
  if (psm !== undefined) form.append('protocol_sign_method', String(psm));
  const catIds = user.user_category_ids;
  if (catIds !== undefined && catIds.length > 0) {
    for (const id of catIds) {
      form.append('user_category_ids', String(id));
    }
  }
}

const usersService = {
  async getUsers(params?: { 
    role?: string; 
    verified?: boolean;
    is_active?: boolean;
    search?: string;
    page?: number;
    page_size?: number;
    /** Фильтр по категории пользователя и всем потомкам (backend) */
    category?: string | number;
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

  async createUser(user: AdminUserPayload): Promise<User & { generated_password?: string }> {
    const profile_photo = user.profile_photo;
    const hasFile = profile_photo instanceof File;

    if (hasFile) {
      const form = new FormData();
      appendUserFieldsToFormData(form, user);
      form.append('profile_photo', profile_photo);
      return apiClient.post<User & { generated_password?: string }>('/users/', form);
    }

    const backendUser: any = {
      ...user,
      full_name: user.fullName || user.full_name,
    };
    delete backendUser.fullName;
    delete backendUser.company;
    delete backendUser.profile_photo;
    delete backendUser.clear_profile_photo;
    if (user.company) {
      backendUser.organization = user.company;
    }
    if (user.user_category_ids !== undefined) {
      backendUser.user_category_ids = user.user_category_ids;
    }
    const response = await apiClient.post<User & { generated_password?: string }>('/users/', backendUser);
    return response;
  },

  async updateUser(id: string, user: AdminUserPayload): Promise<User> {
    const profile_photo = user.profile_photo;
    const clear_profile_photo = user.clear_profile_photo === true;
    const hasFile = profile_photo instanceof File;
    const categoryIds = user.user_category_ids;
    const needsCategoryPatch =
      categoryIds !== undefined && (hasFile || clear_profile_photo);

    if (needsCategoryPatch) {
      await apiClient.patch<User>(`/users/${id}/`, { user_category_ids: categoryIds });
    }

    if (hasFile || clear_profile_photo) {
      const form = new FormData();
      const { user_category_ids: _omit, ...userForForm } = user;
      appendUserFieldsToFormData(form, userForForm);
      if (hasFile && profile_photo) {
        form.append('profile_photo', profile_photo);
      }
      if (clear_profile_photo) {
        form.append('clear_profile_photo', 'true');
      }
      return apiClient.put<User>(`/users/${id}/`, form);
    }

    const backendUser: any = {
      ...user,
      full_name: user.fullName || user.full_name,
    };
    delete backendUser.fullName;
    delete backendUser.company;
    delete backendUser.profile_photo;
    delete backendUser.clear_profile_photo;
    if (user.company) {
      backendUser.organization = user.company;
    }
    if (!backendUser.password || backendUser.password.trim() === '') {
      delete backendUser.password;
    }
    if (user.verification_code) {
      backendUser.verification_code = user.verification_code;
    }
    if (!needsCategoryPatch && categoryIds !== undefined) {
      backendUser.user_category_ids = categoryIds;
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

