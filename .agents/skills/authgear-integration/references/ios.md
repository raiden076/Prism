# iOS SDK Integration

## Requirements

- iOS 11.0 or higher
- Xcode (latest version recommended)
- Swift knowledge (Swift Package Manager or CocoaPods)

## Installation

### Swift Package Manager (Recommended)

Add the SDK via Xcode:
1. File → Add Package Dependencies
2. Enter URL: `https://github.com/authgear/authgear-sdk-ios.git`
3. Select version and add to target

### CocoaPods

Add to `Podfile`:

```ruby
pod 'Authgear', :git => 'https://github.com/authgear/authgear-sdk-ios.git'
```

Then run:
```bash
pod install
```

## Portal Configuration

1. Create Native App in Authgear Portal
2. Define custom URI scheme (e.g., `com.example.authgeardemo://host/path`)
3. Add as Authorized Redirect URI
4. Note Client ID and Endpoint

## SDK Initialization

Import the SDK and create an instance:

```swift
import Authgear

private var authgear: Authgear = Authgear(
    clientId: "<CLIENT_ID>",
    endpoint: "<AUTHGEAR_ENDPOINT>"
)
```

Configure in the `.onAppear()` lifecycle method (SwiftUI) or `viewDidLoad()` (UIKit):

```swift
authgear.configure() { result in
    switch result {
    case .success():
        print("Configured successfully")
    case let .failure(error):
        print("Configuration failed: \(error)")
    }
}
```

## URI Scheme Configuration

Configure custom URL scheme in Xcode:

**Via Xcode UI:**
1. Select your project in Project Navigator
2. Select your app target
3. Go to **Info** tab
4. Expand **URL Types**
5. Click **+** to add a new URL Type
6. Set:
   - **Identifier**: `CFBundleURLTypes`
   - **URL Schemes**: `com.example.authgeardemo` (without `://host/path`)
   - **Role**: `Editor`

**Via Info.plist:**

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.example.authgeardemo</string>
        </array>
    </dict>
</array>
```

**Important:** In the URL scheme configuration, only include the scheme part (e.g., `com.example.authgeardemo`), not the full URI with `://host/path`. The full redirect URI (e.g., `com.example.authgeardemo://host/path`) is used when calling `authenticate()`.

## Authentication

### Login Flow

```swift
func startAuthentication() {
    authgear.authenticate(
        redirectURI: "com.example.authgeardemo://host/path",
        handler: { result in
            switch result {
            case let .success(userInfo):
                // User authenticated successfully
                self.userId = userInfo.sub
                self.loginState = self.authgear.sessionState
            case let .failure(error):
                print("Authentication failed: \(error)")
            }
        }
    )
}
```

### Session State Management

Check session state:

```swift
import Authgear

let sessionState = authgear.sessionState

switch sessionState {
case .unknown:
    // Initial state, not yet configured
case .noSession:
    // User is not authenticated
case .authenticated:
    // User is authenticated
}
```

**Important:** An authenticated local state doesn't guarantee the session is still valid on the server. Always call `fetchUserInfo()` to verify the session and get up-to-date user information.

## User Information

### Fetch User Info

After successful authentication or app launch, fetch user information:

```swift
func getCurrentUser() {
    authgear.fetchUserInfo { userInfoResult in
        self.loginState = self.authgear.sessionState

        switch userInfoResult {
        case let .success(userInfo):
            self.userId = userInfo.sub
            // Access other user attributes
            // userInfo.email, userInfo.phoneNumber, userInfo.name, etc.
        case let .failure(error):
            print("Fetch user info failed: \(error)")
        }
    }
}
```

Call this method:
- After successful configuration to check for existing sessions
- After successful authentication to get user details
- When you need fresh user information

## Logout

```swift
func logout() {
    authgear.logout { result in
        switch result {
        case .success():
            self.loginState = self.authgear.sessionState
            print("Logged out successfully")
        case let .failure(error):
            print("Logout failed: \(error)")
        }
    }
}
```

## User Settings Page

Display Authgear's pre-built settings interface where users can modify profile attributes and security settings:

```swift
func openUserSettings() {
    authgear.open(page: SettingsPage.settings)
}
```

## Authenticated Backend Requests

Before making API calls, refresh the access token if needed and include it in request headers:

```swift
authgear.refreshAccessTokenIfNeeded() { result in
    switch result {
    case .success():
        if let accessToken = self.authgear.accessToken {
            var urlRequest = URLRequest(url: URL(string: "YOUR_SERVER_URL")!)
            urlRequest.setValue(
                "Bearer \(accessToken)",
                forHTTPHeaderField: "authorization"
            )

            // Make the request
            URLSession.shared.dataTask(with: urlRequest) { data, response, error in
                // Handle response
            }.resume()
        }
    case let .failure(error):
        print("Token refresh failed: \(error)")
    }
}
```

**Note:** The `refreshAccessTokenIfNeeded()` method will only make a network call if the access token has expired, making it efficient to call before each API request.

## Complete SwiftUI Example

Here's a minimal working example:

```swift
import SwiftUI
import Authgear

struct ContentView: View {
    @State private var authgear: Authgear = Authgear(
        clientId: "<CLIENT_ID>",
        endpoint: "<AUTHGEAR_ENDPOINT>"
    )
    @State private var loginState: SessionState = .unknown
    @State private var userId: String = ""

    var body: some View {
        VStack(spacing: 20) {
            Text("Session State: \(String(describing: loginState))")

            if loginState == .authenticated {
                Text("User ID: \(userId)")
                Button("Logout") {
                    logout()
                }
                Button("Settings") {
                    openSettings()
                }
            } else {
                Button("Login") {
                    authenticate()
                }
            }
        }
        .onAppear {
            configure()
        }
    }

    func configure() {
        authgear.configure() { result in
            switch result {
            case .success():
                getCurrentUser()
            case let .failure(error):
                print("Configuration failed: \(error)")
            }
        }
    }

    func authenticate() {
        authgear.authenticate(
            redirectURI: "com.example.authgeardemo://host/path"
        ) { result in
            switch result {
            case let .success(userInfo):
                userId = userInfo.sub
                loginState = authgear.sessionState
            case let .failure(error):
                print("Authentication failed: \(error)")
            }
        }
    }

    func getCurrentUser() {
        authgear.fetchUserInfo { result in
            loginState = authgear.sessionState

            switch result {
            case let .success(userInfo):
                userId = userInfo.sub
            case let .failure(error):
                print("Fetch user info failed: \(error)")
            }
        }
    }

    func logout() {
        authgear.logout { result in
            switch result {
            case .success():
                loginState = authgear.sessionState
                userId = ""
            case let .failure(error):
                print("Logout failed: \(error)")
            }
        }
    }

    func openSettings() {
        authgear.open(page: SettingsPage.settings)
    }
}
```

## Troubleshooting

### Authentication Not Working

If authentication redirects to the browser but doesn't return to your app:
1. Verify the custom URI scheme is correctly configured in Info.plist
2. Ensure the redirect URI in the Authgear Portal matches exactly (including `://host/path`)
3. Check that the redirect URI used in `authenticate()` matches the portal configuration
4. Make sure the URL scheme in Info.plist matches the scheme in your redirect URI (e.g., `com.example.authgeardemo`)

### "Invalid Redirect URI" Error

If you see this error during authentication:
1. Verify the redirect URI is added to **Authorized Redirect URIs** in the Authgear Portal
2. Ensure the redirect URI format is correct (e.g., `com.example.authgeardemo://host/path`)
3. Check that the redirect URI passed to `authenticate()` exactly matches the portal configuration

### Access Token Issues

If API calls fail with 401 Unauthorized:
1. Always call `refreshAccessTokenIfNeeded()` before using the access token
2. Verify your backend is correctly validating JWT tokens
3. Check that the token is included in the Authorization header as `Bearer <token>`
4. Ensure the user is authenticated (`sessionState == .authenticated`)

### SSL/Network Errors

If you encounter SSL or network errors:
1. Ensure your Authgear endpoint uses HTTPS
2. For development with custom domains, you may need to add App Transport Security exceptions in Info.plist (not recommended for production)
3. Check device/simulator network connectivity

## Resources

- [iOS SDK API Documentation](https://authgear.github.io/authgear-sdk-ios/)
- [Example iOS Project](https://github.com/authgear/authgear-example-ios/)
- [Authgear Documentation](https://docs.authgear.com)
