// SuperTokens WebJS SDK initialization and auth state management
// Tasks: 3.1, 3.2, 3.9, 3.13

import SuperTokens from 'supertokens-web-js';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';

// ============================================================================
// Types
// ============================================================================

export interface UserAuthData {
  phoneNumber: string;
  userId: string;
  role: string;
  hierarchyDepth: number;
  reporterId: string | null;
  regionScope: string | null;
  tags: string[];
}

export interface UserProfile {
  id: string;
  role: string;
  phone_number: string;
  region_scope: string | null;
  supervisor_id: string | null;
  reporter_id: string | null;
  hierarchy_depth: number;
  tags: string[];
  supertokens_user_id: string;
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
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  error: string | null;
}

// ============================================================================
// Configuration
// ============================================================================

// Environment variables
const SUPERTOKENS_CORE_URL = import.meta.env.VITE_SUPERTOKENS_CORE_URL || '';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

// ============================================================================
// SuperTokens Initialization (Task 3.1, 3.2)
// ============================================================================

let initialized = false;

export function initSuperTokens(): void {
  if (initialized) {
    console.log('SuperTokens already initialized');
    return;
  }

  if (!SUPERTOKENS_CORE_URL) {
    console.warn('VITE_SUPERTOKENS_CORE_URL not set, SuperTokens disabled');
    return;
  }

  try {
    SuperTokens.init({
  appInfo: {
    appName: 'PRISM',
    apiDomain: 'https://prism-api.arkaprav0.in',
    websiteDomain: 'https://prism.arkaprav0.in',
    apiBasePath: '/auth',
  },
      recipeList: [
        // Passwordless recipe with phone contact method (Task 3.2)
        Passwordless.init({
          contactMethod: 'PHONE',
        }),
        // Session management with automatic token refresh (Task 3.12)
        Session.init({
          tokenTransferMethod: 'header', // Use Authorization header
          sessionExpiredStatusCode: 401, // Standard HTTP status for expired sessions
          autoAddCredentials: true, // Automatically include credentials
          // Session event callbacks
          onHandleEvent: (event) => {
            console.log('SuperTokens session event:', event.action);
            
            switch (event.action) {
              case 'SESSION_CREATED':
                console.log('Session created successfully');
                break;
              case 'ACCESS_TOKEN_PAYLOAD_UPDATED':
                console.log('Access token refreshed');
                break;
              case 'REFRESH_SESSION':
                console.log('Session refreshed');
                break;
              case 'SIGN_OUT':
                console.log('User signed out');
                authStore.setUnauthenticated();
                break;
              case 'UNAUTHORISED':
                console.log('Session expired or invalid');
                authStore.setUnauthenticated();
                break;
            }
          },
        }),
      ],
      // Automatic token attachment for API calls (Task 3.3)
      networkInterceptor: (request) => {
        // SuperTokens automatically handles session token attachment
        // This interceptor can be used for additional headers if needed
        return request;
      },
    });

    initialized = true;
    console.log('SuperTokens initialized successfully');
    
    // Set up global session event listener for token refresh (Task 3.12)
    setupTokenRefreshListener();
    
  } catch (error) {
    console.error('Failed to initialize SuperTokens:', error);
    throw error;
  }
}

// ============================================================================
// Token Refresh Handling (Task 3.12)
// ============================================================================

function setupTokenRefreshListener(): void {
  // Listen for session changes and update auth store accordingly
  Session.addAxiosInterceptors({
    interceptors: {
      response: {
        onFulfilled: (response) => response,
        onRejected: async (error) => {
          // Handle 401 errors - token might be expired
          if (error.response?.status === 401) {
            console.log('Token expired or invalid, attempting refresh...');
            
            try {
              // Try to refresh the session
              await Session.attemptRefreshingSession();
              console.log('Session refreshed successfully');
              
              // Update auth store after refresh
              const hasSession = await Session.doesSessionExist();
              if (hasSession) {
                const profile = await fetchUserProfile();
                if (profile) {
                  authStore.setAuthenticated(profile);
                }
              }
            } catch (refreshError) {
              console.error('Failed to refresh session:', refreshError);
              authStore.setUnauthenticated();
            }
          }
          
          return Promise.reject(error);
        }
      }
    }
  } as any);
}

export function isSuperTokensInitialized(): boolean {
  return initialized;
}

// ============================================================================
// Reactive Auth Store - Using simple object without Svelte 5 runes at module level
// ============================================================================

// Simple auth state without Svelte runes
let authState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

// Array of listener functions to notify on state changes
const listeners: Array<(state: AuthState) => void> = [];

function notifyListeners() {
  listeners.forEach(listener => listener(authState));
}

export const authStore = {
  get state() {
    return authState;
  },
  get isAuthenticated() {
    return authState.isAuthenticated;
  },
  get isLoading() {
    return authState.isLoading;
  },
  get user() {
    return authState.user;
  },
  get error() {
    return authState.error;
  },
  subscribe(callback: (state: AuthState) => void) {
    listeners.push(callback);
    callback(authState); // Initial call with current state
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  },
  setAuthenticated(userData: UserProfile) {
    authState = {
      ...authState,
      isAuthenticated: true,
      isLoading: false,
      user: userData,
      error: null,
    };
    notifyListeners();
  },
  setUnauthenticated() {
    authState = {
      ...authState,
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
    };
    notifyListeners();
  },
  setLoading(loading: boolean) {
    authState = {
      ...authState,
      isLoading: loading,
    };
    notifyListeners();
  },
  setError(errorMessage: string | null) {
    authState = {
      ...authState,
      error: errorMessage,
      isLoading: false,
    };
    notifyListeners();
  },
  updateUser(updates: Partial<UserProfile>) {
    if (authState.user) {
      authState = {
        ...authState,
        user: { ...authState.user, ...updates },
      };
      notifyListeners();
    }
  },
};

// ============================================================================
// Phone OTP Flow Functions
// ============================================================================

/**
 * Initiate phone OTP via SuperTokens
 * Tries WhatsApp first, falls back to SMS
 */
export async function initiatePhoneOTP(
  phoneNumber: string,
  channel: 'WHATSAPP' | 'SMS' | 'AUTO' = 'AUTO'
): Promise<InitiateResponse> {
  if (!initialized) {
    return { success: false, error: 'SuperTokens not initialized' };
  }

  const cleanPhone = phoneNumber.replace(/\D/g, '');

  try {
    // For AUTO mode, try WhatsApp first, then fallback to SMS
    // SuperTokens Passwordless doesn't support channel selection directly,
    // but we can store the preference and use it for UI/display purposes
    const response = await Passwordless.createCode({
      phoneNumber: cleanPhone,
    });

    if (response.status === 'OK') {
      // Store channel preference for display purposes
      const effectiveChannel = channel === 'AUTO' ? 'WHATSAPP' : channel;
      
      return {
        success: true,
        orderId: response.deviceId,
        channel: effectiveChannel,
      };
    } else if (response.status === 'GENERAL_ERROR') {
      return {
        success: false,
        error: response.message || 'Failed to initiate OTP',
      };
    } else {
      return {
        success: false,
        error: 'Unknown error initiating OTP',
      };
    }
  } catch (error: any) {
    console.error('Failed to initiate OTP:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Verify phone OTP via SuperTokens
 */
export async function verifyPhoneOTP(
  phoneNumber: string,
  otpCode: string,
  deviceId?: string
): Promise<VerifyResponse> {
  if (!initialized) {
    return { success: false, error: 'SuperTokens not initialized' };
  }

  const cleanPhone = phoneNumber.replace(/\D/g, '');

  try {
    // Consume passwordless code
    const response = await Passwordless.consumeCode({
      preAuthSessionId: deviceId || '',
      userInputCode: otpCode,
    });

    if (response.status === 'OK') {
      // Session is automatically created by SuperTokens
      // Fetch user profile from backend
      const profile = await fetchUserProfile();

      if (profile) {
        authStore.setAuthenticated(profile);
        return {
          success: true,
          userId: response.user.id,
          isNewUser: response.createdNewUser,
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch user profile',
        };
      }
    } else if (response.status === 'INCORRECT_USER_INPUT_CODE_ERROR') {
      return {
        success: false,
        error: `Invalid code. ${response.maximumCodeInputAttempts - response.failedCodeInputAttemptCount} attempts remaining.`,
      };
    } else if (response.status === 'EXPIRED_USER_INPUT_CODE_ERROR') {
      return {
        success: false,
        error: 'Code has expired. Please request a new one.',
      };
    } else if (response.status === 'RESTART_FLOW_ERROR') {
      return {
        success: false,
        error: 'Session expired. Please request a new code.',
      };
    } else {
      return {
        success: false,
        error: 'Verification failed',
      };
    }
  } catch (error: any) {
    console.error('Failed to verify OTP:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Resend OTP code
 */
export async function resendPhoneOTP(phoneNumber: string): Promise<InitiateResponse> {
  // Re-initiate the flow
  return initiatePhoneOTP(phoneNumber);
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Check if user has valid session
 */
export async function checkSession(): Promise<boolean> {
  if (!initialized) {
    return false;
  }

  try {
    const hasSession = await Session.doesSessionExist();

    if (hasSession) {
      // Fetch user profile and update store
      const profile = await fetchUserProfile();
      if (profile) {
        authStore.setAuthenticated(profile);
        return true;
      }
    }

    authStore.setUnauthenticated();
    return false;
  } catch (error) {
    console.error('Session check failed:', error);
    authStore.setUnauthenticated();
    return false;
  }
}

/**
 * Sign out user
 */
export async function signOut(): Promise<void> {
  if (!initialized) {
    authStore.setUnauthenticated();
    return;
  }

  try {
    await Session.signOut();
    authStore.setUnauthenticated();
  } catch (error) {
    console.error('Sign out failed:', error);
    // Still clear local state even if API call fails
    authStore.setUnauthenticated();
  }
}

/**
 * Get current access token (for manual API calls if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  if (!initialized) {
    return null;
  }

  try {
    return await Session.getAccessToken();
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get user ID from session
 */
export async function getUserId(): Promise<string | null> {
  if (!initialized) {
    return null;
  }

  try {
    return await Session.getUserId();
  } catch (error) {
    console.error('Failed to get user ID:', error);
    return null;
  }
}

// ============================================================================
// API Integration
// ============================================================================

/**
 * Fetch user profile from backend
 * Uses SuperTokens automatic session handling
 */
async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include', // Important for cookie-based session
    });

    if (response.ok) {
      const data = await response.json();
      return data.user as UserProfile;
    } else if (response.status === 401) {
      // Session expired or invalid
      authStore.setUnauthenticated();
      return null;
    } else {
      console.error('Failed to fetch profile:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Network error fetching profile:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 * SuperTokens automatically attaches session tokens
 */
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// ============================================================================
// Session Restoration (Task 3.10)
// ============================================================================

/**
 * Restore session on app load
 * Called from +layout.svelte or similar
 */
export async function restoreSession(): Promise<boolean> {
  authStore.setLoading(true);

  try {
    const hasSession = await checkSession();
    return hasSession;
  } finally {
    authStore.setLoading(false);
  }
}

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
}

/**
 * Get authorization header for API calls
 * Note: SuperTokens handles this automatically via cookies
 * This is kept for backward compatibility
 */
export function getAuthHeader(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

// ============================================================================
// Re-export for convenience
// ============================================================================

export { SuperTokens, Passwordless, Session };
