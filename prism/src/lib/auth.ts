// Auth service using SuperTokens for PRISM
// Maintains backward-compatible interface while using SuperTokens under the hood
// Task 3.4: Rewrite to use SuperTokens instead of OTPless

import {
  initSuperTokens,
  authStore,
  initiatePhoneOTP,
  verifyPhoneOTP,
  resendPhoneOTP,
  checkSession,
  signOut,
  getAccessToken,
  getUserId,
  makeAuthenticatedRequest,
  restoreSession as restoreSuperTokensSession,
  type UserProfile as SuperTokensUserProfile,
} from './supertokens';

// Re-export types for backward compatibility
export interface UserAuthData {
  token: string;
  phoneNumber: string;
  userId?: string;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  role: string;
  phone_number: string;
  region_scope?: string;
  supervisor_id?: string;
  reporter_id?: string;
  hierarchy_depth: number;
  tags: string[];
  status: 'authenticated' | 'pending' | 'blocked';
}

export interface InitiateResponse {
  success: boolean;
  orderId?: string;
  channel?: 'WHATSAPP' | 'SMS';
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  token?: string;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}

class AuthService {
  private backendUrl: string = 'http://localhost:8787';
  private currentChannel: 'WHATSAPP' | 'SMS' = 'WHATSAPP';
  private currentOrderId: string | null = null;
  private initialized: boolean = false;

  constructor() {
    // Initialize SuperTokens on first use
    this.initialize();
  }

  // Initialize SuperTokens
  private initialize(): void {
    if (this.initialized) return;
    
    try {
      initSuperTokens();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize SuperTokens:', error);
    }
  }

  // Initiate authentication with WhatsApp-first, SMS fallback
  async initiate(phoneNumber: string, channel: 'WHATSAPP' | 'SMS' | 'AUTO' = 'AUTO'): Promise<InitiateResponse> {
    this.initialize();

    if (!this.initialized) {
      return { success: false, error: 'SuperTokens not initialized' };
    }

    try {
      const response = await initiatePhoneOTP(phoneNumber, channel);
      
      if (response.success) {
        this.currentOrderId = response.orderId || null;
        this.currentChannel = response.channel || 'WHATSAPP';
      }
      
      return response;
    } catch (error: any) {
      console.error('Auth initiate failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to initiate authentication',
      };
    }
  }

  // Verify OTP code
  async verify(phoneNumber: string, otp: string): Promise<VerifyResponse> {
    this.initialize();

    if (!this.initialized) {
      return { success: false, error: 'SuperTokens not initialized' };
    }

    try {
      const response = await verifyPhoneOTP(phoneNumber, otp, this.currentOrderId || undefined);
      
      if (response.success) {
        // Get access token for backward compatibility
        const token = await getAccessToken();
        
        return {
          success: true,
          token: token || undefined,
          userId: response.userId,
          isNewUser: response.isNewUser,
        };
      }
      
      return response;
    } catch (error: any) {
      console.error('Auth verify failed:', error);
      return {
        success: false,
        error: error.message || 'Verification failed',
      };
    }
  }

  // Verify token with backend and get user profile
  async verifyAndGetProfile(): Promise<UserProfile> {
    this.initialize();

    try {
      // Make authenticated request to get profile
      const response = await makeAuthenticatedRequest(`${this.backendUrl}/auth/me`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend verification failed: ${response.status}`);
      }

      const data = await response.json();
      const profile: UserProfile = data.user;

      // Store profile
      await this.storeProfile(profile);

      return profile;
    } catch (error) {
      console.error('Profile verification failed:', error);
      throw error;
    }
  }

  // Store profile data
  private async storeProfile(profile: UserProfile): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('auth.json', { autoSave: true });
        await store.set('prism_profile', profile);
        await store.save();
      } else {
        localStorage.setItem('prism_profile', JSON.stringify(profile));
      }
    } catch (error) {
      localStorage.setItem('prism_profile', JSON.stringify(profile));
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return authStore.isAuthenticated;
  }

  // Check if we have a valid session
  hasValidToken(): boolean {
    return authStore.isAuthenticated;
  }

  // Get current auth token
  async getAuthToken(): Promise<string | null> {
    return await getAccessToken();
  }

  // Get current phone number from user profile
  getPhoneNumber(): string | null {
    return authStore.user?.phone_number || null;
  }

  // Get user profile
  getUserProfile(): UserProfile | null {
    return authStore.user as UserProfile | null;
  }

  // Logout - clear all auth data
  async logout(): Promise<void> {
    this.currentOrderId = null;
    await signOut();
    
    // Clear legacy storage
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const { load } = await import('@tauri-apps/plugin-store');
        const store = await load('auth.json', { autoSave: true });
        await store.clear();
        await store.save();
      }
    } catch (error) {
      console.warn('Failed to clear Tauri storage:', error);
    }

    localStorage.removeItem('prism_auth');
    localStorage.removeItem('prism_profile');
  }

  // Restore session from storage
  async restoreSession(): Promise<boolean> {
    this.initialize();
    return await restoreSuperTokensSession();
  }

  // Get authorization header for API calls
  async getAuthHeader(): Promise<Record<string, string>> {
    // SuperTokens handles this automatically via cookies
    return {
      'Content-Type': 'application/json',
    };
  }

  // Set backend URL (for testing or production config)
  setBackendUrl(url: string): void {
    this.backendUrl = url;
  }

  // Get current channel being used
  getCurrentChannel(): 'WHATSAPP' | 'SMS' {
    return this.currentChannel;
  }

  // Resend OTP
  async resend(phoneNumber: string): Promise<InitiateResponse> {
    return await resendPhoneOTP(phoneNumber);
  }

  // Get reactive auth store for components
  getStore() {
    return authStore;
  }
}

// Singleton instance
export const authService = new AuthService();

// Also export SuperTokens utilities for direct use
export {
  initSuperTokens,
  authStore,
  checkSession,
  signOut,
  getAccessToken,
  getUserId,
  makeAuthenticatedRequest,
  restoreSession as restoreSuperTokensSession,
} from './supertokens';

// Re-export types
export type { SuperTokensUserProfile };

// Export from supertokens module for convenience
export * from './supertokens';
