import { apiClient } from './api';
import type { UserCategory } from '../types/lms';

export type UserCategoryPayload = Partial<
  Pick<
    UserCategory,
    'parent' | 'name' | 'name_kz' | 'name_en' | 'order' | 'is_active'
  >
>;

const userCategoriesService = {
  async getList(): Promise<UserCategory[]> {
    const data = await apiClient.get<UserCategory[] | { results?: UserCategory[] }>(
      '/user-categories/'
    );
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray(data.results)) return data.results;
    return [];
  },

  async getNested(): Promise<UserCategoryNested[]> {
    return apiClient.get<UserCategoryNested[]>('/user-categories/?nested=1');
  },

  async create(payload: UserCategoryPayload): Promise<UserCategory> {
    return apiClient.post<UserCategory>('/user-categories/', payload);
  },

  async update(id: string | number, payload: UserCategoryPayload): Promise<UserCategory> {
    return apiClient.patch<UserCategory>(`/user-categories/${id}/`, payload);
  },

  async delete(id: string | number): Promise<void> {
    await apiClient.delete(`/user-categories/${id}/`);
  },
};

/** Ответ GET ?nested=1 */
export type UserCategoryNested = UserCategory & { children?: UserCategoryNested[] };

export { userCategoriesService };
