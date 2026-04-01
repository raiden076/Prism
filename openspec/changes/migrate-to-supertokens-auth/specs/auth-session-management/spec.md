## ADDED Requirements

### Requirement: System issues short-lived access tokens
The system SHALL issue access tokens with a maximum validity of 15 minutes.

#### Scenario: Access token issuance on authentication
- **WHEN** a user successfully authenticates
- **THEN** the system SHALL issue an access token valid for 15 minutes
- **AND** the token SHALL include user_id and session_id claims

#### Scenario: Access token validation
- **WHEN** a request is made with an access token
- **AND** the token has not expired
- **THEN** the system SHALL accept the token as valid
- **AND** the system SHALL extract user identity from the token

#### Scenario: Expired access token rejection
- **WHEN** a request is made with an expired access token
- **THEN** the system SHALL reject the request with 401 status
- **AND** the system SHALL indicate the token has expired

### Requirement: System issues long-lived refresh tokens with rotation
The system SHALL issue refresh tokens valid for 7 days with automatic rotation.

#### Scenario: Refresh token issuance on authentication
- **WHEN** a user successfully authenticates
- **THEN** the system SHALL issue a refresh token valid for 7 days
- **AND** the refresh token SHALL be associated with the user's session

#### Scenario: Refresh token rotation on use
- **WHEN** a refresh token is used to obtain a new access token
- **THEN** the system SHALL issue a new refresh token
- **AND** the old refresh token SHALL be invalidated
- **AND** the new refresh token SHALL have a fresh 7-day expiration

#### Scenario: Refresh token theft detection
- **WHEN** a refresh token is used that has already been rotated
- **THEN** the system SHALL detect potential token theft
- **AND** the system SHALL revoke the entire session
- **AND** the user SHALL be required to re-authenticate

### Requirement: System supports session revocation
The system SHALL support revoking active sessions.

#### Scenario: User-initiated logout
- **WHEN** a user explicitly logs out
- **THEN** the system SHALL revoke the current session
- **AND** both access and refresh tokens SHALL be invalidated
- **AND** the session SHALL be removed from the database

#### Scenario: Admin-initiated session revocation
- **WHEN** an administrator revokes a user's session
- **THEN** the system SHALL invalidate all tokens for that session
- **AND** the user SHALL be logged out on next request

#### Scenario: Revocation propagation
- **WHEN** a session is revoked
- **THEN** the revocation SHALL be effective immediately
- **AND** subsequent requests with tokens from that session SHALL be rejected

### Requirement: System stores session data securely
The system SHALL store session tokens securely in appropriate storage mechanisms.

#### Scenario: Tauri secure storage usage
- **WHEN** running in Tauri environment
- **THEN** access tokens SHALL be stored in Tauri secure storage
- **AND** refresh tokens SHALL be stored in Tauri secure storage
- **AND** tokens SHALL NOT be accessible to JavaScript directly

#### Scenario: Browser storage usage
- **WHEN** running in browser environment
- **THEN** the system SHALL use HttpOnly cookies when possible
- **AND** the system SHALL fallback to memory storage for access tokens
- **AND** refresh tokens SHALL use secure, SameSite cookies

### Requirement: System implements automatic session refresh
The system SHALL automatically refresh sessions before they expire.

#### Scenario: Pre-emptive token refresh
- **WHEN** an access token is approaching expiration (within 1 minute)
- **AND** the user is actively using the application
- **THEN** the system SHALL automatically refresh the access token
- **AND** the user SHALL NOT experience interruption

#### Scenario: Background token refresh
- **WHEN** the application regains focus after being in background
- **AND** the access token has expired
- **THEN** the system SHALL silently refresh the token
- **AND** the user SHALL NOT see a login prompt

### Requirement: System maintains session metadata
The system SHALL maintain metadata about active sessions.

#### Scenario: Session creation metadata
- **WHEN** a new session is created
- **THEN** the system SHALL store:
  - session_id
  - user_id
  - created_at timestamp
  - device/client information (if available)
  - IP address (if available)

#### Scenario: Session activity tracking
- **WHEN** a session is used
- **THEN** the system SHALL update the last_active timestamp
- **AND** the system SHALL track the session's activity for analytics

### Requirement: System supports multiple concurrent sessions
The system SHALL allow a user to have multiple active sessions from different devices.

#### Scenario: Multiple device login
- **WHEN** a user authenticates from a second device
- **THEN** the system SHALL create a new session
- **AND** the existing session on the first device SHALL remain valid
- **AND** both devices SHALL be able to make authenticated requests

#### Scenario: Session independence
- **WHEN** a user logs out from one device
- **THEN** only that device's session SHALL be revoked
- **AND** sessions on other devices SHALL remain active
