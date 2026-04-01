# Flutter SDK Integration

## Requirements

- Flutter 2.5.0 or higher
- Android SDK 30+ (Android 11+)
- iOS deployment target 11.0+

## Installation

```bash
flutter pub add flutter_authgear
```

## Portal Configuration

1. Create Native App in Authgear Portal
2. Define custom URI scheme (e.g., `com.myapp://host/path`)
3. Add as Authorized Redirect URI
4. Note Client ID and Endpoint

## SDK Initialization

```dart
import 'package:flutter_authgear/flutter_authgear.dart';

class _MyAppState extends State<MyApp> {
  late Authgear _authgear;
  bool _isInitialized = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    _authgear = Authgear(
      endpoint: "<AUTHGEAR_ENDPOINT>",
      clientID: "<CLIENT_ID>"
    );

    try {
      await _authgear.configure();
      setState(() {
        _isInitialized = true;
      });
    } catch (e) {
      print("Configuration error: $e");
    }
  }
}
```

## Platform Configuration

### Android

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<activity
  android:name="com.authgear.flutter.OAuthRedirectActivity"
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

Set minimum SDK in `android/app/build.gradle`:

```gradle
android {
  defaultConfig {
    minSdk = 30
  }
}
```

### iOS

Add to `ios/Runner/Info.plist`:

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

## Authentication

```dart
Future<void> authenticate() async {
  try {
    final userInfo = await _authgear.authenticate(
      redirectURI: "com.myapp://host/path"
    );
    print("User authenticated: ${userInfo.sub}");
  } catch (e) {
    print("Authentication error: $e");
  }
}
```

## Logout

```dart
Future<void> logout() async {
  try {
    await _authgear.logout();
  } catch (e) {
    print("Logout error: $e");
  }
}
```

## Fetch User Info

```dart
Future<void> fetchUserInfo() async {
  try {
    final userInfo = await _authgear.getUserInfo();
    print("User ID: ${userInfo.sub}");
  } catch (e) {
    print("Fetch user info error: $e");
  }
}
```

## Session State

Check authentication status:

```dart
bool get isAuthenticated => _authgear.sessionState == SessionState.authenticated;
```

## Open Settings

```dart
import 'package:flutter_authgear/flutter_authgear.dart';

Future<void> openSettings() async {
  try {
    await _authgear.open(page: SettingsPage.settings);
  } catch (e) {
    print("Error opening settings: $e");
  }
}
```

## Making Authenticated API Calls

### Using wrapped HTTP client

```dart
import 'package:http/http.dart' as http;

final client = _authgear.wrapHttpClient(http.Client());

final response = await client.get(
  Uri.parse("https://api.example.com/data")
);
```

### Manual token handling

```dart
await _authgear.refreshAccessTokenIfNeeded();
final token = _authgear.accessToken;

final response = await http.get(
  Uri.parse("https://api.example.com/data"),
  headers: {
    'Authorization': 'Bearer $token',
  },
);
```
