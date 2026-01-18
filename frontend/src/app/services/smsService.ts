import { apiClient } from './api';

export type SMSPurpose = 'protocol_sign' | 'registration' | 'password_reset' | 'verification' | 'profile_update';

export interface SendSMSResponse {
  message: string;
  expires_at: string;
  otp_code?: string; // Only in debug mode
  debug?: boolean;
}

export interface VerifySMSResponse {
  verified: boolean;
  message?: string;
  error?: string;
}

export const smsService = {
  /**
   * Send SMS verification code
   * @param phone Phone number
   * @param purpose Purpose of verification
   * @returns Promise with response containing message and expiration time
   */
  async sendVerificationCode(
    phone: string,
    purpose: SMSPurpose = 'verification'
  ): Promise<SendSMSResponse> {
    try {
      const response = await apiClient.post<SendSMSResponse>('/auth/sms/send/', {
        phone,
        purpose,
      });
      return response;
    } catch (error: any) {
      console.error('Failed to send SMS verification code:', error);
      throw new Error(
        error.data?.error || error.message || 'Failed to send verification code'
      );
    }
  },

  /**
   * Verify SMS code
   * @param phone Phone number
   * @param code 6-digit verification code
   * @param purpose Purpose of verification
   * @returns Promise with verification result
   */
  async verifyCode(
    phone: string,
    code: string,
    purpose: SMSPurpose = 'verification'
  ): Promise<VerifySMSResponse> {
    try {
      const response = await apiClient.post<VerifySMSResponse>('/auth/sms/verify/', {
        phone,
        code,
        purpose,
      });
      return response;
    } catch (error: any) {
      console.error('Failed to verify SMS code:', error);
      // Extract error message from response
      const errorMessage =
        error.data?.error ||
        error.data?.detail ||
        error.message ||
        'Failed to verify code';
      
      return {
        verified: false,
        error: errorMessage,
      };
    }
  },
};

