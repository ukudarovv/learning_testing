import { apiClient } from './api';

export interface SiteConfig {
  id: number;
  require_sms_on_registration: boolean;
  created_at: string;
  updated_at: string;
}

export const settingsService = {
  async getSettings(): Promise<SiteConfig> {
    return apiClient.get<SiteConfig>('/core/settings/');
  },

  async updateSettings(data: Partial<Pick<SiteConfig, 'require_sms_on_registration'>>): Promise<SiteConfig> {
    return apiClient.patch<SiteConfig>('/core/settings/current/', data);
  },
};
