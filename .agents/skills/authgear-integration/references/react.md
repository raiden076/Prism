# React SPA Integration

## Installation

```bash
npm install --save --save-exact @authgear/web
```

## Configuration

Configure in your main entry file (e.g., `src/main.tsx` or `src/index.tsx`):

```tsx
import authgear from "@authgear/web";

await authgear.configure({
  endpoint: process.env.REACT_APP_AUTHGEAR_ENDPOINT,
  clientID: process.env.REACT_APP_AUTHGEAR_CLIENT_ID,
  sessionType: "refresh_token",
});
```

Environment variables (`.env`):
```properties
REACT_APP_AUTHGEAR_CLIENT_ID=<CLIENT_ID>
REACT_APP_AUTHGEAR_ENDPOINT=<AUTHGEAR_ENDPOINT>
REACT_APP_AUTHGEAR_REDIRECT_URL=http://localhost:3000/auth-redirect
```

For Vite projects, use `VITE_` prefix instead of `REACT_APP_`.

## Context Provider Pattern

Create `UserProvider.tsx` to manage authentication state:

```tsx
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
      endpoint: import.meta.env.VITE_AUTHGEAR_ENDPOINT,
      clientID: import.meta.env.VITE_AUTHGEAR_CLIENT_ID,
      sessionType: "refresh_token",
    }).then(() => {
      // Check initial session state after configuration
      if (authgear.sessionState === "AUTHENTICATED") {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
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
```

## Auth Redirect Handler

Create `AuthRedirect.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import authgear from "@authgear/web";
import { useUser } from "./UserProvider";

const AuthRedirect = () => {
  const navigate = useNavigate();
  const { isLoading } = useUser();
  const isFinished = useRef(false);

  useEffect(() => {
    async function finishAuth() {
      // Wait for Authgear to be configured
      if (isLoading) return;

      if (isFinished.current) return;
      isFinished.current = true;

      try {
        await authgear.finishAuthentication();
        navigate("/");
      } catch (error) {
        console.error("Authentication error:", error);
        navigate("/");
      }
    }

    finishAuth();
  }, [navigate, isLoading]);

  return <div>Redirecting...</div>;
};

export default AuthRedirect;
```

## Routing Setup

```tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UserContextProvider } from "./UserProvider";
import AuthRedirect from "./AuthRedirect";
import Home from "./Home";

function App() {
  return (
    <UserContextProvider>
      <Router>
        <Routes>
          <Route path="/auth-redirect" element={<AuthRedirect />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </Router>
    </UserContextProvider>
  );
}
```

## Authentication Actions

### Login

```tsx
import authgear from "@authgear/web";

const handleLogin = async () => {
  try {
    await authgear.startAuthentication({
      redirectURI: "http://localhost:3000/auth-redirect",
      prompt: "login",
    });
  } catch (error) {
    console.error("Login error:", error);
  }
};
```

### Logout

```tsx
const handleLogout = async () => {
  try {
    await authgear.logout({
      redirectURI: "http://localhost:3000/",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
};
```

### Open Settings

```tsx
import { Page } from "@authgear/web";

const handleSettings = () => {
  authgear.open(Page.Settings);
};
```

## Fetching User Info

```tsx
import { useEffect, useState } from "react";
import authgear from "@authgear/web";

const UserProfile = () => {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const info = await authgear.fetchUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    }

    loadUser();
  }, []);

  return (
    <div>
      {userInfo && <p>User ID: {userInfo.sub}</p>}
    </div>
  );
};
```

## Making Authenticated API Calls

### Option 1: Using authgear.fetch()

```tsx
const response = await authgear.fetch("https://api.example.com/data");
const data = await response.json();
```

### Option 2: Manual token handling

```tsx
await authgear.refreshAccessTokenIfNeeded();
const token = authgear.accessToken;

const response = await fetch("https://api.example.com/data", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```
