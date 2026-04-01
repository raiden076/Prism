## ADDED Requirements

### Requirement: OTPLess Headless SDK Integration
The system SHALL use OTPLess Headless SDK for authentication with WhatsApp-first flow and SMS fallback, avoiding OAuth redirects that fail in Android WebView.

#### Scenario: WhatsApp authentication success
- **WHEN** user enters phone number and selects WhatsApp
- **THEN** system initiates WhatsApp OTP via OTPLess Headless SDK `initiate()` method
- **AND** user receives OTP on WhatsApp
- **AND** upon `verify()` success, system receives auth token

#### Scenario: SMS fallback when WhatsApp unavailable
- **WHEN** WhatsApp initiation fails or times out
- **THEN** system automatically falls back to SMS OTP
- **AND** user receives OTP via SMS
- **AND** verification flow continues identically

### Requirement: Custom Neo-Brutalism Auth UI
The system SHALL provide a custom authentication UI following Neo-Brutalism design principles, NOT the pre-built OTPLess widget.

#### Scenario: Auth screen renders before any app content
- **WHEN** app launches with no valid session
- **THEN** only auth screen is visible
- **AND** no navigation or app content is accessible
- **AND** UI uses solid shadows, bold typography, prism-black/white palette

#### Scenario: Single phone input with aggressive minimalism
- **WHEN** auth screen renders
- **THEN** only phone number input and single CTA button are visible
- **AND** no menu bar, no navigation clutter
- **AND** button has solid shadow with translate-y on active state

### Requirement: Backend Token Validation
The system SHALL validate OTPLess tokens on the backend before granting session access.

#### Scenario: Token validation on login
- **WHEN** OTPLess Headless SDK returns auth token
- **THEN** frontend sends token to `/api/v2/auth/verify`
- **AND** backend validates token with OTPLess server
- **AND** only upon backend success is session created

#### Scenario: Invalid token rejection
- **WHEN** backend validation fails (expired, tampered, invalid)
- **THEN** frontend shows error message
- **AND** user remains on auth screen
- **AND** no session is created

### Requirement: Secure Session Management
The system SHALL store session data securely using Tauri's secure storage mechanism.

#### Scenario: Session persistence across app restarts
- **WHEN** user successfully authenticates
- **THEN** session token is stored in Tauri secure storage
- **AND** app restart does not require re-authentication (until token expiry)

#### Scenario: Session cleared on logout
- **WHEN** user initiates logout
- **THEN** session token is removed from secure storage
- **AND** user is redirected to auth screen
- **AND** all cached user data is cleared
