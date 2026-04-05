// API Client for backend communication
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  getToken(): string | null {
    if (this.token) {
      return this.token;
    }
    const stored = localStorage.getItem('access_token');
    if (stored) {
      this.token = stored;
    }
    return stored;
  }

  private buildURL(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanBase = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    return `${cleanBase}${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { responseType?: 'json' | 'blob' } = {}
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const token = this.getToken();
    const { responseType, ...fetchOptions } = options;

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Don't set Content-Type for FormData (browser will set it automatically with boundary)
    const isFormData = options.body instanceof FormData;
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add language header for multilingual support
    const language = localStorage.getItem('language') || 'ru';
    headers['Accept-Language'] = language;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle blob responses
      if (responseType === 'blob') {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.detail || errorData.message || `HTTP ${response.status}`,
            response.status,
            errorData
          );
        }
        return response.blob() as Promise<T>;
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      let data: any;
      
      // Check if response has content
      const contentLength = response.headers.get('content-length');
      if (contentLength === '0' || (!contentType && response.status === 204)) {
        // No content response (204 No Content or empty body)
        data = null;
      } else if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } else {
        const text = await response.text();
        data = text || null;
      }

      if (!response.ok) {
        // Handle different error formats from Django REST Framework
        let errorMessage = `HTTP ${response.status}`;
        
        if (data) {
          if (typeof data === 'string') {
            errorMessage = data;
          } else if (data.detail) {
            errorMessage = data.detail;
          } else if (data.message) {
            errorMessage = data.message;
          } else if (data.error) {
            errorMessage = data.error;
          } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
            errorMessage = data.non_field_errors[0];
          } else if (typeof data === 'object') {
            // Try to extract first error message from object
            const firstKey = Object.keys(data)[0];
            if (firstKey && Array.isArray(data[firstKey])) {
              errorMessage = `${firstKey}: ${data[firstKey][0]}`;
            } else {
              // Log the full data for debugging
              console.error('API Error Response:', data);
            }
          }
        }
        
        throw new ApiError(
          errorMessage,
          response.status,
          data
        );
      }

      // Return null for empty responses (204 No Content)
      if (data === null && response.status === 204) {
        return null as T;
      }
      
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  }

  async get<T>(endpoint: string, params?: Record<string, any>, options?: { responseType?: 'json' | 'blob' }): Promise<T> {
    let url = endpoint;
    
    // Add parameters to query string only if params are provided
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }
    
    return this.request<T>(url, { method: 'GET', responseType: options?.responseType });
  }

  async post<T>(endpoint: string, data?: any, options?: { headers?: HeadersInit }): Promise<T> {
    // If data is FormData, send it directly, otherwise stringify JSON
    const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined);
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
      headers: options?.headers,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: { headers?: HeadersInit }): Promise<T> {
    // If data is FormData, send it directly, otherwise stringify JSON
    const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined);
    return this.request<T>(endpoint, {
      method: 'PUT',
      body,
      headers: options?.headers,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined);
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      });
    }

    const url = this.buildURL(endpoint);
    const token = this.getToken();

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient(API_URL);

/** Trigger file download from blob (e.g. Excel/PDF export) */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

