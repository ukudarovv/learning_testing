import { apiClient, downloadBlob } from './api';

export interface ContactMessage {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  direction?: 'construction' | 'engineering' | 'education' | 'safety' | 'other' | '';
  direction_display?: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  status_display?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMessageCreate {
  name: string;
  company?: string;
  email: string;
  phone: string;
  direction?: 'construction' | 'engineering' | 'education' | 'safety' | 'other' | '';
  message: string;
}

const contactsService = {
  async getMessages(params?: { status?: string; direction?: string }): Promise<ContactMessage[]> {
    const data = await apiClient.get<any>('/contacts/', params);
    
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
    }
    
    return [];
  },

  async getMessage(id: string): Promise<ContactMessage> {
    return apiClient.get<ContactMessage>(`/contacts/${id}/`);
  },

  async createMessage(message: ContactMessageCreate): Promise<ContactMessage> {
    return apiClient.post<ContactMessage>('/contacts/', message);
  },

  async updateMessageStatus(id: string, status: 'new' | 'read' | 'replied' | 'archived'): Promise<ContactMessage> {
    return apiClient.patch<ContactMessage>(`/contacts/${id}/`, { status });
  },

  async deleteMessage(id: string): Promise<void> {
    return apiClient.delete(`/contacts/${id}/`);
  },

  async exportMessages(): Promise<void> {
    const blob = await apiClient.get<Blob>('/contacts/export/', undefined, { responseType: 'blob' });
    downloadBlob(blob, 'contact_messages.xlsx');
  },
};

export { contactsService };

