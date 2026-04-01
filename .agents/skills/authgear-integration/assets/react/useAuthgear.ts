import { useCallback } from 'react';
import authgear, { Page } from '@authgear/web';

export const useAuthgear = () => {
  const login = useCallback(async () => {
    try {
      await authgear.startAuthentication({
        redirectURI: window.location.origin + '/auth-redirect',
        prompt: 'login',
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authgear.logout({
        redirectURI: window.location.origin + '/',
      });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  const openSettings = useCallback(() => {
    authgear.open(Page.Settings);
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const userInfo = await authgear.fetchUserInfo();
      return userInfo;
    } catch (error) {
      console.error('Fetch user info error:', error);
      throw error;
    }
  }, []);

  return {
    login,
    logout,
    openSettings,
    fetchUserInfo,
  };
};
