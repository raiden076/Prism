import React, { createContext, useContext, useState, useEffect } from 'react';
import authgear from '@authgear/web';

interface UserContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
}

const UserContext = createContext<UserContextValue>({
  isLoggedIn: false,
  isLoading: true,
});

export const UserContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authgear.delegate = {
      onSessionStateChange: (container) => {
        if (container.sessionState === "AUTHENTICATED") {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      },
    };

    authgear.configure({
      endpoint: import.meta.env.VITE_AUTHGEAR_ENDPOINT || process.env.REACT_APP_AUTHGEAR_ENDPOINT,
      clientID: import.meta.env.VITE_AUTHGEAR_CLIENT_ID || process.env.REACT_APP_AUTHGEAR_CLIENT_ID,
      sessionType: "refresh_token",
    }).then(() => {
      // Check initial session state after configuration
      if (authgear.sessionState === "AUTHENTICATED") {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    }).catch((error) => {
      console.error("Authgear configuration error:", error);
      setIsLoggedIn(false);
      setIsLoading(false);
    });
  }, []);

  return (
    <UserContext.Provider value={{ isLoggedIn, isLoading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
