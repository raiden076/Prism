import { vi } from 'vitest';

// Mock Svelte 5 runes for testing
export function $state<T>(value: T): T {
  return value;
}

export function $derived<T>(fn: () => T): T {
  return fn();
}

// Mock the supertokens module
vi.mock('$lib/supertokens', async () => {
  const actual = await vi.importActual('$lib/supertokens');
  
  return {
    ...actual,
    authStore: {
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null,
      state: {
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
      },
      setAuthenticated: vi.fn(),
      setUnauthenticated: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      updateUser: vi.fn(),
    },
  };
});
