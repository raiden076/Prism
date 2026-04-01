# Android SDK Integration

## Requirements

- Android 5.0 (API 21) or higher
- Android Studio
- Kotlin or Java

## Installation

Add JitPack repository to `settings.gradle`:

```groovy
dependencyResolutionManagement {
  repositories {
    maven { url 'https://jitpack.io' }
  }
}
```

Add dependencies to `app/build.gradle`:

```groovy
dependencies {
  implementation 'com.github.authgear:authgear-sdk-android:2024-12-11.0'
  implementation 'androidx.appcompat:appcompat:1.6.1'  // Required for Authgear UI
}
```

**Note:** The `androidx.appcompat` dependency is required because Authgear's authentication and settings UI uses `AppCompatActivity`.

Enable Java 8+ desugaring:

```groovy
android {
  compileOptions {
    coreLibraryDesugaringEnabled true
  }
}

dependencies {
  coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'  // Use 1.1.5 or newer
}
```

## Portal Configuration

1. Create Native App in Authgear Portal
2. Define custom URI scheme (e.g., `com.example.myapp://host/path`)
3. Add as Authorized Redirect URI
4. Note Client ID and Endpoint

## Configuration Management (Optional)

For better security, avoid hardcoding credentials. Use `BuildConfig` with `gradle.properties`:

**gradle.properties:**
```properties
AUTHGEAR_CLIENT_ID=your_client_id_here
AUTHGEAR_ENDPOINT=https://your-app.authgear.cloud
```

**app/build.gradle.kts:**
```kotlin
android {
    defaultConfig {
        buildConfigField("String", "AUTHGEAR_CLIENT_ID", "\"${project.findProperty("AUTHGEAR_CLIENT_ID")}\"")
        buildConfigField("String", "AUTHGEAR_ENDPOINT", "\"${project.findProperty("AUTHGEAR_ENDPOINT")}\"")
    }
}
```

Then use `BuildConfig.AUTHGEAR_CLIENT_ID` and `BuildConfig.AUTHGEAR_ENDPOINT` in your code.

## SDK Initialization

**Important:** The Authgear constructor uses **positional parameters only** - do not use named parameters.

In `MainActivity.kt`:

```kotlin
import com.oursky.authgear.Authgear
import com.oursky.authgear.OnConfigureListener

class MainActivity : AppCompatActivity() {
    private lateinit var authgear: Authgear

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Use positional parameters (not named)
        authgear = Authgear(
            application,
            "<CLIENT_ID>",
            "<AUTHGEAR_ENDPOINT>"
        )
        // Or with BuildConfig:
        // authgear = Authgear(application, BuildConfig.AUTHGEAR_CLIENT_ID, BuildConfig.AUTHGEAR_ENDPOINT)

        authgear.configure(object : OnConfigureListener {
            override fun onConfigured() {
                // Configuration successful
            }

            override fun onConfigurationFailed(throwable: Throwable) {
                Log.e("Authgear", "Configuration failed", throwable)
            }
        })
    }
}
```

## Manifest Configuration

Add to `AndroidManifest.xml`:

```xml
<activity
    android:name="com.oursky.authgear.OAuthRedirectActivity"
    android:exported="true"
    android:launchMode="singleTask">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="com.example.myapp"
            android:host="host"
            android:pathPrefix="/path" />
    </intent-filter>
</activity>
```

## Theme Configuration

**Important:** Authgear requires an AppCompat theme. In your `AndroidManifest.xml`, ensure your application uses an AppCompat theme:

```xml
<application
    android:theme="@style/Theme.AppCompat.Light.NoActionBar"
    ...>
```

Or define a custom theme in `res/values/themes.xml`:

```xml
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <!-- Your customizations -->
    </style>
</resources>
```

Then reference it in your manifest:

```xml
<application
    android:theme="@style/AppTheme"
    ...>
```

**Why this is required:** Authgear's authentication and settings UI uses `AppCompatActivity`, which requires an AppCompat-based theme. Using a non-AppCompat theme (e.g., `android:Theme.Material.Light`) will cause the app to crash when opening Authgear UI.

## Authentication

**Important:**
- Use `AuthenticateOptions` for the redirect URI
- The `onAuthenticated` callback receives non-nullable `UserInfo` (not `UserInfo?`)

```kotlin
import com.oursky.authgear.OnAuthenticateListener
import com.oursky.authgear.AuthenticateOptions
import com.oursky.authgear.UserInfo

fun authenticate() {
    val options = AuthenticateOptions("com.example.myapp://host/path")

    authgear.authenticate(options, object : OnAuthenticateListener {
        override fun onAuthenticated(userInfo: UserInfo) {  // UserInfo is non-null
            // User authenticated successfully
            val userId = userInfo.sub
        }

        override fun onAuthenticationFailed(throwable: Throwable) {
            Log.e("Authgear", "Authentication failed", throwable)
        }
    })
}
```

**Note:** Use `userInfo: UserInfo` (non-null) in `onAuthenticated`; the SDK interface does not use a nullable type.

## Logout

**Important:** First parameter is a boolean (force logout), callback method is `onLogout()` (not `onLoggedOut`):

```kotlin
import com.oursky.authgear.OnLogoutListener

fun logout() {
    authgear.logout(true, object : OnLogoutListener {
        override fun onLogout() {
            // User logged out successfully
        }

        override fun onLogoutFailed(throwable: Throwable) {
            Log.e("Authgear", "Logout failed", throwable)
        }
    })
}
```

## Fetch User Info

```kotlin
import com.oursky.authgear.OnFetchUserInfoListener
import com.oursky.authgear.UserInfo

fun fetchUserInfo() {
    authgear.fetchUserInfo(object : OnFetchUserInfoListener {
        override fun onFetchedUserInfo(userInfo: UserInfo) {
            val userId = userInfo.sub
            // Use user info
        }

        override fun onFetchingUserInfoFailed(throwable: Throwable) {
            Log.e("Authgear", "Fetch user info failed", throwable)
        }
    })
}
```

## Access Tokens

Before making API calls, refresh token if needed:

```kotlin
try {
    authgear.refreshAccessTokenIfNeededSync()
    val accessToken = authgear.accessToken

    // Use token in API calls
    val request = Request.Builder()
        .url("https://api.example.com/data")
        .header("Authorization", "Bearer $accessToken")
        .build()
} catch (e: Exception) {
    Log.e("Authgear", "Token refresh failed", e)
}
```

## Open Settings Page

```kotlin
import com.oursky.authgear.Page

authgear.open(Page.SETTINGS)
```

## Session State

Check session state:

```kotlin
import com.oursky.authgear.SessionState

val isAuthenticated = authgear.sessionState == SessionState.AUTHENTICATED
```

## Troubleshooting

### "You need to use a Theme.AppCompat theme" (CRITICAL)

If the app crashes when tapping Login or opening Settings with:
```
java.lang.IllegalStateException: You need to use a Theme.AppCompat theme (or descendant) with this activity.
```

**Solution:**
1. Add the AppCompat dependency if not already present:
   ```groovy
   implementation 'androidx.appcompat:appcompat:1.6.1'
   ```

2. Change your app theme to an AppCompat theme in `AndroidManifest.xml`:
   ```xml
   <application
       android:theme="@style/Theme.AppCompat.Light.NoActionBar"
       ...>
   ```

   Or use a custom theme that inherits from AppCompat:
   ```xml
   <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
       <!-- Your customizations -->
   </style>
   ```

**Why:** Authgear's authentication and settings UI uses `AppCompatActivity`, which requires an AppCompat-based theme. Non-AppCompat themes like `android:Theme.Material.Light` will cause crashes.

### "Unable to resolve host" / DNS Issues

If you encounter `UnknownHostException` or "Unable to resolve host" errors:
1. Check that your device/emulator has network connectivity
2. Verify the endpoint URL is correct in your configuration
3. Test the endpoint URL in a browser to ensure it's accessible
4. If using an emulator, ensure it has proper network settings

### "This Activity already has an action bar"

If you see this error when opening Authgear settings:
- Ensure activities that show Authgear UI use a `NoActionBar` theme
- Example: `android:theme="@style/Theme.AppCompat.Light.NoActionBar"`

### "No parameter with name 'endpoint' found"

If you encounter this error:
- Use positional parameters in the Authgear constructor (see SDK Initialization section)
- Do NOT use named parameters like `endpoint =`
