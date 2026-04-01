# React Native Integration

## Installation

```bash
npm install --exact @authgear/react-native
cd ios && pod install
```

## Portal Configuration

1. Create a Native App in Authgear Portal
2. Define custom URI scheme (e.g., `com.myapp://host/path`)
3. Add URI as Authorized Redirect URI
4. Note Client ID and Endpoint

## SDK Initialization

In `App.tsx`:

```tsx
import authgear, {
  ReactNativeContainer,
  SessionState,
  SessionStateChangeReason
} from "@authgear/react-native";
import { useCallback, useEffect, useState } from "react";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    async function initAuthgear() {
      try {
        await authgear.configure({
          clientID: "<CLIENT_ID>",
          endpoint: "<AUTHGEAR_ENDPOINT>",
        });

        authgear.delegate = {
          onSessionStateChange: (container: ReactNativeContainer, reason: SessionStateChangeReason) => {
            if (container.sessionState === SessionState.Authenticated) {
              setIsLoggedIn(true);
            } else {
              setIsLoggedIn(false);
            }
          },
        };

        await postConfigure();
        setIsConfigured(true);
      } catch (error) {
        console.error("Configuration error:", error);
      }
    }

    initAuthgear();
  }, []);

  const postConfigure = async () => {
    try {
      if (authgear.sessionState === SessionState.Authenticated) {
        const userInfo = await authgear.fetchUserInfo();
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error("Post-configure error:", error);
    }
  };

  return (
    // App components
  );
};
```

## Platform-Specific Configuration

### Android

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<activity
  android:name="com.authgear.reactnative.OAuthRedirectActivity"
  android:exported="true"
  android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:scheme="com.myapp"
      android:host="host"
      android:pathPrefix="/path" />
  </intent-filter>
</activity>
```

Add CustomTabs support:

```xml
<queries>
  <intent>
    <action android:name="android.support.customtabs.action.CustomTabsService" />
  </intent>
</queries>
```

### iOS

Add to `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.myapp</string>
    </array>
  </dict>
</array>
```

## Authentication Flow

```tsx
const authenticate = useCallback(async () => {
  try {
    await authgear.authenticate({
      redirectURI: 'com.myapp://host/path',
    });
  } catch (error) {
    console.error('Authentication Error:', error);
  }
}, []);
```

## Logout

```tsx
const logout = useCallback(async () => {
  try {
    await authgear.logout();
  } catch (error) {
    console.error("Logout Error:", error);
  }
}, []);
```

## Fetch User Info

```tsx
const getUserInfo = useCallback(async () => {
  try {
    const userInfo = await authgear.fetchUserInfo();
    return userInfo;
  } catch (error) {
    console.error("Error fetching user info:", error);
  }
}, []);
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

## Session States

- `UNKNOWN` - Initial state before configuration
- `NO_SESSION` - No valid session found
- `AUTHENTICATED` - User is authenticated
