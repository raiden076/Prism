## ADDED Requirements

### Requirement: Frontend initializes SuperTokens WebJS SDK
The frontend SHALL initialize the SuperTokens WebJS SDK with Passwordless recipe configuration.

#### Scenario: SDK initialization on app load
- **WHEN** the application loads
- **THEN** the SuperTokens SDK SHALL be initialized with:
  - supertokens.networkInterceptor to auto-attach tokens to API calls
  - passwordless configuration with phone number as contact method
  - proper API domain and base path configuration

#### Scenario: SDK initialization in Tauri environment
- **WHEN** the application loads within Tauri WebView
- **THEN** the SDK SHALL use Tauri secure storage for token persistence
- **AND** the SDK SHALL fall back to localStorage in browser environment

### Requirement: Frontend initiates phone OTP via SuperTokens
The frontend SHALL use SuperTokens to initiate phone OTP delivery via WhatsApp or SMS.

#### Scenario: Initiate WhatsApp OTP
- **WHEN** a user enters their phone number and requests OTP
- **AND** WhatsApp is available on the device
- **THEN** the system SHALL initiate OTP via WhatsApp through SuperTokens
- **AND** the system SHALL display a loading state

#### Scenario: Fallback to SMS when WhatsApp unavailable
- **WHEN** a user enters their phone number and requests OTP
- **AND** WhatsApp is not available
- **THEN** the system SHALL automatically fallback to SMS delivery
- **AND** the system SHALL display a message indicating SMS is being sent

#### Scenario: Resend OTP
- **WHEN** a user requests to resend the OTP
- **THEN** the system SHALL respect SuperTokens rate limiting
- **AND** the system SHALL initiate a new OTP delivery
- **AND** the system SHALL display the remaining retry count

### Requirement: Frontend verifies phone OTP via SuperTokens
The frontend SHALL use SuperTokens to verify the OTP code entered by the user.

#### Scenario: Successful OTP verification
- **WHEN** a user enters the correct OTP code
- **THEN** the system SHALL verify the code via SuperTokens
- **AND** the system SHALL receive session tokens (access + refresh)
- **AND** the system SHALL store tokens securely
- **AND** the system SHALL redirect to the main application

#### Scenario: Invalid OTP verification
- **WHEN** a user enters an incorrect OTP code
- **THEN** the system SHALL display an error message
- **AND** the system SHALL allow retry up to maximum attempts
- **AND** the system SHALL clear the OTP input field

#### Scenario: Expired OTP verification
- **WHEN** a user enters an OTP code that has expired
- **THEN** the system SHALL display an expiration message
- **AND** the system SHALL prompt the user to request a new OTP

### Requirement: Frontend automatically attaches session tokens to API calls
The frontend SHALL automatically include SuperTokens session tokens in all API requests to the backend.

#### Scenario: API call with valid session
- **WHEN** the frontend makes an API call
- **AND** a valid session exists
- **THEN** the system SHALL automatically attach the access token
- **AND** the request SHALL include the Authorization header with Bearer token

#### Scenario: Automatic token refresh
- **WHEN** an API call is made with an expired access token
- **THEN** the system SHALL automatically refresh the token using the refresh token
- **AND** the system SHALL retry the original API call with the new token
- **AND** this process SHALL be transparent to the user

#### Scenario: Refresh token expired
- **WHEN** the refresh token has expired
- **THEN** the system SHALL redirect the user to the login page
- **AND** the system SHALL clear the expired session

### Requirement: Frontend provides sign-out functionality
The frontend SHALL provide a sign-out mechanism that invalidates the session.

#### Scenario: User initiates sign-out
- **WHEN** a user clicks the sign-out button
- **THEN** the system SHALL call the SuperTokens sign-out endpoint
- **AND** the system SHALL clear all local session data
- **AND** the system SHALL redirect to the login page

### Requirement: Frontend maintains auth state with reactive store
The frontend SHALL maintain authentication state in a reactive store for Svelte 5 components.

#### Scenario: Auth state on successful login
- **WHEN** a user successfully authenticates
- **THEN** the auth store SHALL update with isAuthenticated = true
- **AND** the store SHALL include user metadata (role, phone_number)
- **AND** all subscribed components SHALL re-render

#### Scenario: Auth state on logout
- **WHEN** a user signs out
- **THEN** the auth store SHALL update with isAuthenticated = false
- **AND** the store SHALL clear user metadata
- **AND** protected routes SHALL redirect to login

#### Scenario: Auth state restoration on app load
- **WHEN** the application loads with existing session
- **THEN** the system SHALL restore the session from storage
- **AND** the auth store SHALL update with isAuthenticated = true
- **AND** the user SHALL remain logged in
