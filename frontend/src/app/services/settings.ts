import { apiClient } from './api';

export interface SiteConfig {
  id: number;
  require_sms_on_registration: boolean;
  require_course_enrollment_request: boolean;
  require_test_enrollment_request: boolean;
  default_protocol_sign_method?: 'both' | 'sms' | 'eds' | 'none';
  require_sms_for_course_completion?: boolean;
  require_sms_for_test_completion?: boolean;
  created_at: string;
  updated_at: string;
}

export const settingsService = {
  async getSettings(): Promise<SiteConfig> {
    return apiClient.get<SiteConfig>('/core/settings/');
  },

  async updateSettings(data: Partial<Pick<SiteConfig, 'require_sms_on_registration' | 'require_course_enrollment_request' | 'require_test_enrollment_request' | 'default_protocol_sign_method' | 'require_sms_for_course_completion' | 'require_sms_for_test_completion'>>): Promise<SiteConfig> {
    return apiClient.patch<SiteConfig>('/core/settings/current/', data);
  },
};
