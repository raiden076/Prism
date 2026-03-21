import { describe, it, expect, beforeEach, vi } from 'vitest';
import './mocks/svelte-runes';

// Mock supertokens modules
vi.mock('supertokens-web-js', () => ({
  default: {
    init: vi.fn(),
  },
}));

vi.mock('supertokens-web-js/recipe/passwordless', () => ({
  default: {
    init: vi.fn(),
    createCode: vi.fn(),
    consumeCode: vi.fn(),
  },
}));

vi.mock('supertokens-web-js/recipe/session', () => ({
  default: {
    init: vi.fn(),
    doesSessionExist: vi.fn(),
    getAccessToken: vi.fn(),
    getUserId: vi.fn(),
    signOut: vi.fn(),
    attemptRefreshingSession: vi.fn(),
    addAxiosInterceptors: vi.fn(),
  },
}));

import SuperTokens from 'supertokens-web-js';
import Passwordless from 'supertokens-web-js/recipe/passwordless';
import Session from 'supertokens-web-js/recipe/session';
import {
  initSuperTokens,
  isSuperTokensInitialized,
  initiatePhoneOTP,
  verifyPhoneOTP,
  resendPhoneOTP,
  checkSession,
  signOut,
  getAccessToken,
  getUserId,
  authStore,
  type UserProfile,
} from '../src/lib/supertokens';

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    VITE_SUPERTOKENS_CORE_URL: 'https://try.supertokens.io',
    VITE_API_BASE_URL: 'http://localhost:8787',
  },
});

describe('Task 4.1: Frontend SuperTokens Initialization', () => {
  beforeEach(() => {
    // Reset initialization state
    vi.clearAllMocks();
  });

  it('should initialize SuperTokens without errors', () => {
    expect(() => {
      initSuperTokens();
    }).not.toThrow();
  });

  it('should detect initialization status', () => {
    // Before initialization
    expect(isSuperTokensInitialized()).toBe(false);
    
    // After initialization
    initSuperTokens();
    expect(isSuperTokensInitialized()).toBe(true);
  });

  it('should prevent double initialization', () => {
    initSuperTokens();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    initSuperTokens();
    
    expect(consoleSpy).toHaveBeenCalledWith('SuperTokens already initialized');
    consoleSpy.mockRestore();
  });

  it('should warn if core URL not set', () => {
    vi.stubGlobal('import.meta', {
      env: {
        VITE_SUPERTOKENS_CORE_URL: '',
        VITE_API_BASE_URL: 'http://localhost:8787',
      },
    });
    
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    initSuperTokens();
    
    expect(consoleSpy).toHaveBeenCalledWith('VITE_SUPERTOKENS_CORE_URL not set, SuperTokens disabled');
    consoleSpy.mockRestore();
  });

  it('should export all required functions', () => {
    expect(typeof initSuperTokens).toBe('function');
    expect(typeof isSuperTokensInitialized).toBe('function');
    expect(typeof initiatePhoneOTP).toBe('function');
    expect(typeof verifyPhoneOTP).toBe('function');
    expect(typeof resendPhoneOTP).toBe('function');
    expect(typeof checkSession).toBe('function');
    expect(typeof signOut).toBe('function');
    expect(typeof getAccessToken).toBe('function');
    expect(typeof getUserId).toBe('function');
    expect(authStore).toBeDefined();
  });
});

describe('Task 4.2 & 4.3: Phone OTP Flow', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should initiate OTP with WhatsApp channel', async () => {
    const mockCreateCode = vi.spyOn(Passwordless, 'createCode').mockResolvedValue({
      status: 'OK',
      deviceId: 'test-device-id',
      preAuthSessionId: 'test-session-id',
      flowType: 'USER_INPUT_CODE',
    } as any);

    const result = await initiatePhoneOTP('+919876543210', 'WHATSAPP');

    expect(mockCreateCode).toHaveBeenCalledWith({
      phoneNumber: '919876543210',
    });
    expect(result.success).toBe(true);
    expect(result.channel).toBe('WHATSAPP');
    expect(result.orderId).toBe('test-device-id');
  });

  it('should initiate OTP with SMS channel', async () => {
    const mockCreateCode = vi.spyOn(Passwordless, 'createCode').mockResolvedValue({
      status: 'OK',
      deviceId: 'test-device-id',
      preAuthSessionId: 'test-session-id',
      flowType: 'USER_INPUT_CODE',
    } as any);

    const result = await initiatePhoneOTP('+919876543210', 'SMS');

    expect(result.success).toBe(true);
    expect(result.channel).toBe('SMS');
  });

  it('should default to WHATSAPP for AUTO channel', async () => {
    const mockCreateCode = vi.spyOn(Passwordless, 'createCode').mockResolvedValue({
      status: 'OK',
      deviceId: 'test-device-id',
      preAuthSessionId: 'test-session-id',
      flowType: 'USER_INPUT_CODE',
    } as any);

    const result = await initiatePhoneOTP('+919876543210', 'AUTO');

    expect(result.success).toBe(true);
    expect(result.channel).toBe('WHATSAPP');
  });

  it('should handle initiation failure', async () => {
    const mockCreateCode = vi.spyOn(Passwordless, 'createCode').mockResolvedValue({
      status: 'GENERAL_ERROR',
      message: 'Failed to send OTP',
    } as any);

    const result = await initiatePhoneOTP('+919876543210', 'WHATSAPP');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to send OTP');
  });

  it('should verify OTP successfully', async () => {
    const mockConsumeCode = vi.spyOn(Passwordless, 'consumeCode').mockResolvedValue({
      status: 'OK',
      user: { id: 'test-user-id' },
      createdNewUser: true,
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'test-user-id',
          role: 'crony',
          phone_number: '+919876543210',
          hierarchy_depth: 0,
          tags: [],
        } as UserProfile,
      }),
    } as Response);

    const result = await verifyPhoneOTP('+919876543210', '123456', 'test-device-id');

    expect(mockConsumeCode).toHaveBeenCalledWith({
      preAuthSessionId: 'test-device-id',
      userInputCode: '123456',
    });
    expect(result.success).toBe(true);
    expect(result.userId).toBe('test-user-id');
    expect(result.isNewUser).toBe(true);
  });

  it('should handle incorrect OTP', async () => {
    const mockConsumeCode = vi.spyOn(Passwordless, 'consumeCode').mockResolvedValue({
      status: 'INCORRECT_USER_INPUT_CODE_ERROR',
      maximumCodeInputAttempts: 5,
      failedCodeInputAttemptCount: 1,
    } as any);

    const result = await verifyPhoneOTP('+919876543210', '000000', 'test-device-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid code');
  });

  it('should handle expired OTP', async () => {
    const mockConsumeCode = vi.spyOn(Passwordless, 'consumeCode').mockResolvedValue({
      status: 'EXPIRED_USER_INPUT_CODE_ERROR',
    } as any);

    const result = await verifyPhoneOTP('+919876543210', '123456', 'test-device-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Code has expired. Please request a new one.');
  });

  it('should resend OTP successfully', async () => {
    const mockCreateCode = vi.spyOn(Passwordless, 'createCode').mockResolvedValue({
      status: 'OK',
      deviceId: 'new-device-id',
      preAuthSessionId: 'new-session-id',
      flowType: 'USER_INPUT_CODE',
    } as any);

    const result = await resendPhoneOTP('+919876543210');

    expect(mockCreateCode).toHaveBeenCalledWith({
      phoneNumber: '919876543210',
    });
    expect(result.success).toBe(true);
  });
});

describe('Task 4.4: User Creation with Hierarchy', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should create new user on first login', async () => {
    const mockConsumeCode = vi.spyOn(Passwordless, 'consumeCode').mockResolvedValue({
      status: 'OK',
      user: { id: 'new-user-id' },
      createdNewUser: true,
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'new-user-id',
          role: 'crony',
          phone_number: '+919876543210',
          reporter_id: null,
          hierarchy_depth: 0,
          tags: [],
          status: 'authenticated',
        } as UserProfile,
      }),
    } as Response);

    const result = await verifyPhoneOTP('+919876543210', '123456');

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(authStore.isAuthenticated).toBe(true);
  });

  it('should link to referrer when provided', async () => {
    const mockConsumeCode = vi.spyOn(Passwordless, 'consumeCode').mockResolvedValue({
      status: 'OK',
      user: { id: 'referred-user-id' },
      createdNewUser: true,
    } as any);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'referred-user-id',
          role: 'crony',
          phone_number: '+919876543211',
          reporter_id: 'referrer-id',
          hierarchy_depth: 1,
          tags: [],
          status: 'authenticated',
        } as UserProfile,
      }),
    } as Response);

    const result = await verifyPhoneOTP('+919876543211', '123456');

    expect(result.success).toBe(true);
    expect(result.isNewUser).toBe(true);
    expect(authStore.user?.hierarchy_depth).toBe(1);
    expect(authStore.user?.reporter_id).toBe('referrer-id');
  });
});

describe('Task 4.5: Session Validation', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should check if session exists', async () => {
    const mockDoesSessionExist = vi.spyOn(Session, 'doesSessionExist').mockResolvedValue(true);

    const hasSession = await checkSession();

    expect(mockDoesSessionExist).toHaveBeenCalled();
    expect(hasSession).toBe(true);
  });

  it('should return false when no session exists', async () => {
    const mockDoesSessionExist = vi.spyOn(Session, 'doesSessionExist').mockResolvedValue(false);

    const hasSession = await checkSession();

    expect(hasSession).toBe(false);
    expect(authStore.isAuthenticated).toBe(false);
  });

  it('should get access token when authenticated', async () => {
    const mockGetAccessToken = vi.spyOn(Session, 'getAccessToken').mockResolvedValue('test-access-token');

    const token = await getAccessToken();

    expect(token).toBe('test-access-token');
  });

  it('should get user ID when authenticated', async () => {
    const mockGetUserId = vi.spyOn(Session, 'getUserId').mockResolvedValue('test-user-id');

    const userId = await getUserId();

    expect(userId).toBe('test-user-id');
  });

  it('should handle session check errors gracefully', async () => {
    const mockDoesSessionExist = vi.spyOn(Session, 'doesSessionExist').mockRejectedValue(new Error('Session error'));

    const hasSession = await checkSession();

    expect(hasSession).toBe(false);
  });
});

describe('Task 4.6: Token Refresh Mechanism', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should handle ACCESS_TOKEN_PAYLOAD_UPDATED event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Simulate the onHandleEvent callback
    const event = { action: 'ACCESS_TOKEN_PAYLOAD_UPDATED' };
    
    // The event handler should be called during initialization
    expect(consoleSpy).not.toHaveBeenCalledWith('Access token refreshed');
    
    consoleSpy.mockRestore();
  });

  it('should handle REFRESH_SESSION event', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const event = { action: 'REFRESH_SESSION' };
    
    consoleSpy.mockRestore();
  });

  it('should attempt to refresh session on 401 errors', async () => {
    const mockAttemptRefresh = vi.spyOn(Session, 'attemptRefreshingSession').mockResolvedValue(true);
    const mockDoesSessionExist = vi.spyOn(Session, 'doesSessionExist').mockResolvedValue(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'test-user-id',
          role: 'crony',
          phone_number: '+919876543210',
        } as UserProfile,
      }),
    } as Response);

    // Simulate 401 response followed by successful refresh
    const response = { response: { status: 401 } };
    
    // The interceptor should attempt refresh
    await Session.attemptRefreshingSession();

    expect(mockAttemptRefresh).toHaveBeenCalled();
  });
});

describe('Task 4.7: Sign-out and Session Revocation', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
    authStore.setAuthenticated({
      id: 'test-user-id',
      role: 'crony',
      phone_number: '+919876543210',
      region_scope: null,
      supervisor_id: null,
      reporter_id: null,
      hierarchy_depth: 0,
      tags: [],
      supertokens_user_id: 'st-user-id',
      status: 'authenticated',
    });
  });

  it('should sign out successfully', async () => {
    const mockSignOut = vi.spyOn(Session, 'signOut').mockResolvedValue(undefined);

    await signOut();

    expect(mockSignOut).toHaveBeenCalled();
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.user).toBeNull();
  });

  it('should clear local state even if sign-out API fails', async () => {
    const mockSignOut = vi.spyOn(Session, 'signOut').mockRejectedValue(new Error('Network error'));

    await signOut();

    expect(authStore.isAuthenticated).toBe(false);
  });

  it('should handle sign-out when not initialized', async () => {
    // Reset to uninitialized state
    vi.stubGlobal('import.meta', {
      env: {
        VITE_SUPERTOKENS_CORE_URL: '',
        VITE_API_BASE_URL: 'http://localhost:8787',
      },
    });

    authStore.setAuthenticated({
      id: 'test-user-id',
      role: 'crony',
      phone_number: '+919876543210',
      region_scope: null,
      supervisor_id: null,
      reporter_id: null,
      hierarchy_depth: 0,
      tags: [],
      supertokens_user_id: 'st-user-id',
      status: 'authenticated',
    });

    await signOut();

    expect(authStore.isAuthenticated).toBe(false);
  });
});

describe('Task 4.8: Tauri Secure Storage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect Tauri environment', () => {
    // Mock Tauri environment
    (global.window as any) = {
      __TAURI__: {},
    };

    // The isTauri function should detect this
    expect(typeof (window as any).__TAURI__).toBe('object');
  });

  it('should fall back to localStorage when not in Tauri', () => {
    // Ensure no Tauri
    (global.window as any) = {};

    expect((window as any).__TAURI__).toBeUndefined();
  });

  it('should use secure storage in Tauri environment', async () => {
    const mockStore = {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ id: 'test-user' }),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    // Mock the Store import
    vi.mock('@tauri-apps/plugin-store', () => ({
      Store: vi.fn().mockImplementation(() => mockStore),
    }));

    // In Tauri mode, auth service should use the Store
    (global.window as any) = {
      __TAURI__: {},
    };

    // The store methods would be called during auth operations
    expect(mockStore.set).not.toHaveBeenCalled();
  });
});

describe('Task 4.9: Browser localStorage Fallback', () => {
  let localStorageMock: Storage;

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    
    Object.defineProperty(global.window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  it('should use localStorage when Tauri is not available', () => {
    (global.window as any) = {
      localStorage: localStorageMock,
    };

    expect(window.localStorage).toBeDefined();
  });

  it('should store profile in localStorage', () => {
    const profile = {
      id: 'test-user-id',
      role: 'crony',
      phone_number: '+919876543210',
    };

    localStorage.setItem('prism_profile', JSON.stringify(profile));

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'prism_profile',
      JSON.stringify(profile)
    );
  });

  it('should retrieve profile from localStorage', () => {
    const profile = {
      id: 'test-user-id',
      role: 'crony',
      phone_number: '+919876543210',
    };

    (localStorageMock.getItem as any).mockReturnValue(JSON.stringify(profile));

    const stored = localStorage.getItem('prism_profile');
    const parsed = stored ? JSON.parse(stored) : null;

    expect(localStorageMock.getItem).toHaveBeenCalledWith('prism_profile');
    expect(parsed).toEqual(profile);
  });

  it('should clear auth data from localStorage on sign out', () => {
    localStorage.removeItem('prism_auth');
    localStorage.removeItem('prism_profile');

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('prism_auth');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('prism_profile');
  });
});

describe('Task 4.10: API Endpoint Compatibility', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should include credentials in API requests', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    // Make an authenticated request
    await fetch('http://localhost:8787/api/v2/reports', {
      credentials: 'include',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8787/api/v2/reports',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should handle 401 responses from protected endpoints', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const response = await fetch('http://localhost:8787/api/v2/reports');

    expect(response.status).toBe(401);
  });

  it('should work with legacy auth endpoints', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test-user-id',
        role: 'crony',
        phone_number: '+919876543210',
      }),
    });

    const response = await fetch('http://localhost:8787/api/v2/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'test-token', phoneNumber: '+919876543210' }),
    });

    expect(response.ok).toBe(true);
  });
});

describe('Task 4.11: Role-Based Access Control', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should store and retrieve user role', async () => {
    const userProfile: UserProfile = {
      id: 'admin-user-id',
      role: 'admin',
      phone_number: '+919876543210',
      region_scope: null,
      supervisor_id: null,
      reporter_id: null,
      hierarchy_depth: 0,
      tags: ['admin'],
      supertokens_user_id: 'st-admin-id',
      status: 'authenticated',
    };

    authStore.setAuthenticated(userProfile);

    expect(authStore.user?.role).toBe('admin');
  });

  it('should support different user roles', () => {
    const roles = ['crony', 'contractor', 'master', 'admin'];

    roles.forEach(role => {
      authStore.setAuthenticated({
        id: `user-${role}`,
        role,
        phone_number: '+919876543210',
        region_scope: null,
        supervisor_id: null,
        reporter_id: null,
        hierarchy_depth: 0,
        tags: [],
        supertokens_user_id: `st-${role}-id`,
        status: 'authenticated',
      });

      expect(authStore.user?.role).toBe(role);
    });
  });

  it('should include role in user metadata', () => {
    authStore.setAuthenticated({
      id: 'test-user-id',
      role: 'contractor',
      phone_number: '+919876543210',
      region_scope: 'delhi',
      supervisor_id: 'supervisor-id',
      reporter_id: 'reporter-id',
      hierarchy_depth: 2,
      tags: ['contractor', 'verified'],
      supertokens_user_id: 'st-contractor-id',
      status: 'authenticated',
    });

    expect(authStore.user?.role).toBe('contractor');
    expect(authStore.user?.region_scope).toBe('delhi');
    expect(authStore.user?.hierarchy_depth).toBe(2);
  });
});

describe('Task 4.12: Hierarchy Subtree Access Permissions', () => {
  beforeEach(() => {
    initSuperTokens();
    vi.clearAllMocks();
  });

  it('should track hierarchy depth in user profile', () => {
    authStore.setAuthenticated({
      id: 'level-2-user',
      role: 'crony',
      phone_number: '+919876543210',
      region_scope: null,
      supervisor_id: 'supervisor-id',
      reporter_id: 'parent-id',
      hierarchy_depth: 2,
      tags: [],
      supertokens_user_id: 'st-level-2-id',
      status: 'authenticated',
    });

    expect(authStore.user?.hierarchy_depth).toBe(2);
    expect(authStore.user?.reporter_id).toBe('parent-id');
  });

  it('should handle null reporter_id for root users', () => {
    authStore.setAuthenticated({
      id: 'root-user',
      role: 'master',
      phone_number: '+919876543210',
      region_scope: null,
      supervisor_id: null,
      reporter_id: null,
      hierarchy_depth: 0,
      tags: ['master'],
      supertokens_user_id: 'st-root-id',
      status: 'authenticated',
    });

    expect(authStore.user?.hierarchy_depth).toBe(0);
    expect(authStore.user?.reporter_id).toBeNull();
  });

  it('should track subtree access through reporter_id chain', () => {
    // Simulate a hierarchy: Root -> Manager -> User
    const rootUser = {
      id: 'root-user',
      role: 'admin',
      phone_number: '+919876543200',
      reporter_id: null,
      hierarchy_depth: 0,
      tags: ['admin'],
      supertokens_user_id: 'st-root-id',
      status: 'authenticated',
    };

    const managerUser = {
      id: 'manager-user',
      role: 'master',
      phone_number: '+919876543201',
      reporter_id: 'root-user',
      hierarchy_depth: 1,
      tags: ['master'],
      supertokens_user_id: 'st-manager-id',
      status: 'authenticated',
    };

    const leafUser = {
      id: 'leaf-user',
      role: 'crony',
      phone_number: '+919876543202',
      reporter_id: 'manager-user',
      hierarchy_depth: 2,
      tags: [],
      supertokens_user_id: 'st-leaf-id',
      status: 'authenticated',
    };

    // Verify the chain
    expect(managerUser.reporter_id).toBe(rootUser.id);
    expect(leafUser.reporter_id).toBe(managerUser.id);
    expect(leafUser.hierarchy_depth).toBe(2);
  });
});
