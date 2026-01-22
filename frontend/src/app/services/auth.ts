import { apiClient } from './api';
import { User } from '../types/lms';

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterData {
  phone: string;
  password: string;
  password_confirm?: string;
  full_name: string;
  email: string;
  iin: string;
  role?: string;
  organization?: string;
  language?: string;
  verification_code?: string;
}

const authService = {
  async login(credentials: { phone: string; password: string }): Promise<LoginResponse> {
    // Backend may return { access, refresh } or { access, refresh, user }
    const response = await apiClient.post<any>('/auth/token/', {
      phone: credentials.phone,
      password: credentials.password,
    });
    
    // Save tokens
    if (response.access) {
      apiClient.setToken(response.access);
    }
    if (response.refresh) {
      localStorage.setItem('refresh_token', response.refresh);
    }
    
    // If user is not in response, fetch it separately
    let user = response.user;
    if (!user && response.access) {
      try {
        user = await this.getCurrentUser();
      } catch (error) {
        console.error('Failed to fetch user after login:', error);
      }
    }
    
    return {
      access: response.access,
      refresh: response.refresh,
      user: user,
    } as LoginResponse;
  },

  async register(data: RegisterData): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/register/', data);
    
    // Save tokens
    if (response.access) {
      apiClient.setToken(response.access);
    }
    if (response.refresh) {
      localStorage.setItem('refresh_token', response.refresh);
    }
    
    return response;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiClient.setToken(null);
    }
  },

  async getCurrentUser(): Promise<User> {
    return apiClient.get<User>('/auth/me/');
  },

  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiClient.post<{ access: string }>('/auth/token/refresh/', {
      refresh: refreshToken,
    });

    apiClient.setToken(response.access);
    return response.access;
  },

  async updateProfile(data: Partial<User> & { verification_code?: string }): Promise<User> {
    return apiClient.patch<User>('/auth/me/', data);
  },

  async requestPasswordReset(phone: string): Promise<{ message: string; expires_at?: string }> {
    const response = await apiClient.post<{ message: string; expires_at?: string }>('/auth/password-reset/request/', {
      phone,
    });
    
    return response;
  },

  async verifyPasswordResetCode(phone: string, code: string): Promise<{ verified: boolean; message?: string; error?: string }> {
    const response = await apiClient.post<{ verified: boolean; message?: string; error?: string }>('/auth/password-reset/verify-code/', {
      phone,
      code,
    });
    
    return response;
  },

  async confirmPasswordReset(phone: string, code: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/auth/password-reset/confirm/', {
      phone,
      code,
      new_password: newPassword,
      new_password_confirm: newPassword,
    });
    
    return response;
  },
};

export { authService };

