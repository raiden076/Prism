# Common Integration Patterns

## Protected Routes

### React Router v6

```tsx
import { Navigate } from "react-router-dom";
import { useUser } from "./UserProvider";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading } = useUser();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Usage in routes
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### React Native Navigation

```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import authgear, { SessionState } from '@authgear/react-native';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const isAuthenticated = authgear.sessionState === SessionState.Authenticated;

  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};
```

### Flutter Navigator

```dart
class AuthGuard extends StatelessWidget {
  final Widget child;

  const AuthGuard({required this.child});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _checkAuth(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return CircularProgressIndicator();
        }

        if (snapshot.data == true) {
          return child;
        }

        return LoginScreen();
      },
    );
  }

  Future<bool> _checkAuth() async {
    return authgear.sessionState == SessionState.authenticated;
  }
}
```

## User Profile Page

### React

```tsx
import { useEffect, useState } from "react";
import authgear, { Page } from "@authgear/web";

const UserProfile = () => {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserInfo() {
      try {
        const info = await authgear.fetchUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      } finally {
        setLoading(false);
      }
    }

    loadUserInfo();
  }, []);

  const handleOpenSettings = () => {
    authgear.open(Page.Settings);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Profile</h1>
      <p>User ID: {userInfo?.sub}</p>
      <p>Email: {userInfo?.email}</p>
      <button onClick={handleOpenSettings}>Settings</button>
    </div>
  );
};
```

### React Native

```tsx
import { useState, useEffect } from 'react';
import { View, Text, Button } from 'react-native';
import authgear from '@authgear/react-native';

const ProfileScreen = () => {
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const info = await authgear.fetchUserInfo();
        setUserInfo(info);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    }

    loadUser();
  }, []);

  return (
    <View>
      <Text>User ID: {userInfo?.sub}</Text>
      <Text>Email: {userInfo?.email}</Text>
    </View>
  );
};
```

### Flutter

```dart
class ProfileScreen extends StatefulWidget {
  @override
  _ProfileScreenState createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  UserInfo? _userInfo;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  Future<void> _loadUserInfo() async {
    try {
      final userInfo = await authgear.getUserInfo();
      setState(() {
        _userInfo = userInfo;
        _isLoading = false;
      });
    } catch (e) {
      print('Failed to fetch user info: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return CircularProgressIndicator();
    }

    return Column(
      children: [
        Text('User ID: ${_userInfo?.sub}'),
        Text('Email: ${_userInfo?.email}'),
        ElevatedButton(
          onPressed: () => authgear.open(page: SettingsPage.settings),
          child: Text('Settings'),
        ),
      ],
    );
  }
}
```

## API Integration with Backend

### Using Authgear's Built-in Fetch (Recommended)

**For Web/React Applications:**

Authgear's JavaScript SDK provides a built-in `fetch` function that automatically handles authorization:

```tsx
import authgear from '@authgear/web';

// Simple GET request
const fetchUserData = async () => {
  try {
    const response = await authgear.fetch('https://api.example.com/api/profile');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('API request failed:', error);
  }
};

// POST request with body
const createPost = async (postData: any) => {
  try {
    const response = await authgear.fetch('https://api.example.com/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData),
    });
    return await response.json();
  } catch (error) {
    console.error('Failed to create post:', error);
  }
};
```

**Benefits:**
- ✅ Automatically includes `Authorization: Bearer <token>` header
- ✅ Handles token refresh automatically before each request
- ✅ Standard fetch API - works like native fetch()
- ✅ No manual token management required

**Important:** This is JavaScript/Web SDK only. For React Native, iOS, Android, and Xamarin, manually call `refreshAccessTokenIfNeeded()` and construct the Authorization header.

### React - Axios Integration

```tsx
import axios from 'axios';
import authgear from '@authgear/web';

const apiClient = axios.create({
  baseURL: 'https://api.example.com',
});

// Request interceptor to add access token
apiClient.interceptors.request.use(
  async (config) => {
    await authgear.refreshAccessTokenIfNeeded();
    const token = authgear.accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      await authgear.startAuthentication({
        redirectURI: window.location.origin + '/auth-redirect',
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### React Native - Fetch Integration

```tsx
import authgear from '@authgear/react-native';

class ApiService {
  private baseURL = 'https://api.example.com';

  async request(endpoint: string, options: RequestInit = {}) {
    await authgear.refreshAccessTokenIfNeeded();
    const token = authgear.accessToken;

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized
        await authgear.authenticate({
          redirectURI: 'com.myapp://host/path',
        });
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiService();
```

### Flutter - HTTP Client Integration

```dart
import 'package:http/http.dart' as http;
import 'package:flutter_authgear/flutter_authgear.dart';

class ApiService {
  final Authgear _authgear;
  final String baseUrl = 'https://api.example.com';
  late http.Client _client;

  ApiService(this._authgear) {
    _client = _authgear.wrapHttpClient(http.Client());
  }

  Future<dynamic> get(String endpoint) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$endpoint'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else if (response.statusCode == 401) {
      // Handle unauthorized
      throw Exception('Unauthorized');
    } else {
      throw Exception('Failed to load data');
    }
  }

  Future<dynamic> post(String endpoint, Map<String, dynamic> data) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to post data');
    }
  }
}
```

## Role-Based Access Control

### React - Role-based Components

```tsx
import { useEffect, useState } from 'react';
import authgear from '@authgear/web';

const useUserRoles = () => {
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    async function loadRoles() {
      try {
        const userInfo = await authgear.fetchUserInfo();
        // Assuming roles are in userInfo.roles or custom claims
        setRoles(userInfo.roles || []);
      } catch (error) {
        console.error('Failed to fetch roles:', error);
      }
    }

    loadRoles();
  }, []);

  const hasRole = (role: string) => roles.includes(role);
  const hasAnyRole = (requiredRoles: string[]) =>
    requiredRoles.some(role => roles.includes(role));

  return { roles, hasRole, hasAnyRole };
};

// Usage
const AdminPanel = () => {
  const { hasRole } = useUserRoles();

  if (!hasRole('admin')) {
    return <div>Access denied</div>;
  }

  return <div>Admin Panel Content</div>;
};

// Role-based route protection
const RoleProtectedRoute = ({
  children,
  requiredRoles
}: {
  children: React.ReactNode;
  requiredRoles: string[]
}) => {
  const { hasAnyRole } = useUserRoles();
  const { isLoggedIn } = useUser();

  if (!isLoggedIn) {
    return <Navigate to="/login" />;
  }

  if (!hasAnyRole(requiredRoles)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};
```

### React Native - Permission Checks

```tsx
import { useState, useEffect } from 'react';
import authgear from '@authgear/react-native';

const usePermissions = () => {
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    async function loadPermissions() {
      try {
        const userInfo = await authgear.fetchUserInfo();
        setPermissions(userInfo.permissions || []);
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      }
    }

    loadPermissions();
  }, []);

  const hasPermission = (permission: string) => permissions.includes(permission);

  return { permissions, hasPermission };
};

// Usage in component
const AdminButton = () => {
  const { hasPermission } = usePermissions();

  if (!hasPermission('admin.write')) {
    return null;
  }

  return <Button title="Admin Action" onPress={handleAdminAction} />;
};
```

### Flutter - Role Checks

```dart
class UserRoles {
  final Authgear _authgear;
  List<String> _roles = [];

  UserRoles(this._authgear);

  Future<void> loadRoles() async {
    try {
      final userInfo = await _authgear.getUserInfo();
      _roles = userInfo.roles ?? [];
    } catch (e) {
      print('Failed to load roles: $e');
    }
  }

  bool hasRole(String role) => _roles.contains(role);

  bool hasAnyRole(List<String> requiredRoles) =>
      requiredRoles.any((role) => _roles.contains(role));
}

// Usage
class AdminWidget extends StatelessWidget {
  final UserRoles userRoles;

  const AdminWidget({required this.userRoles});

  @override
  Widget build(BuildContext context) {
    if (!userRoles.hasRole('admin')) {
      return Text('Access denied');
    }

    return Column(
      children: [
        Text('Admin Panel'),
        // Admin content
      ],
    );
  }
}
```
