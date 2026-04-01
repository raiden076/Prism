## ADDED Requirements

### Requirement: Backend initializes SuperTokens with Passwordless recipe
The backend SHALL initialize SuperTokens with the Passwordless recipe configured for phone-based authentication.

#### Scenario: SuperTokens initialization on startup
- **WHEN** the backend application starts
- **THEN** SuperTokens SHALL be initialized with Passwordless recipe
- **AND** the configuration SHALL include connection URI, API key, and app info
- **AND** the backend SHALL be ready to handle authentication requests

### Requirement: Backend creates user on successful phone verification
The backend SHALL create a new user entry in the Users table when a phone number is verified for the first time.

#### Scenario: New user sign up via phone
- **WHEN** a user successfully verifies their phone number via SuperTokens
- **THEN** the system SHALL create a new user record with role 'crony'
- **AND** the system SHALL store the SuperTokens user_id in the user record
- **AND** the system SHALL set hierarchy_depth to 0 and reporter_id to NULL

#### Scenario: Existing user sign in via phone
- **WHEN** a user with an existing account verifies their phone number
- **THEN** the system SHALL retrieve the existing user record
- **AND** the system SHALL update the last login timestamp
- **AND** the system SHALL NOT create a duplicate user record

### Requirement: Backend validates SuperTokens session on protected endpoints
The backend SHALL validate SuperTokens session tokens on all protected API endpoints.

#### Scenario: Valid session token
- **WHEN** a request is made to a protected endpoint with a valid SuperTokens session token
- **THEN** the system SHALL allow the request to proceed
- **AND** the system SHALL make the user_id available to the endpoint handler

#### Scenario: Invalid session token
- **WHEN** a request is made to a protected endpoint with an invalid or expired session token
- **THEN** the system SHALL reject the request with a 401 Unauthorized status
- **AND** the system SHALL include an error message indicating authentication is required

#### Scenario: Missing session token
- **WHEN** a request is made to a protected endpoint without a session token
- **THEN** the system SHALL reject the request with a 401 Unauthorized status

### Requirement: Backend stores PRISM-specific user metadata in SuperTokens
The backend SHALL store PRISM-specific user attributes (role, hierarchy_depth, reporter_id, region_scope) in SuperTokens user metadata.

#### Scenario: Storing user metadata on user creation
- **WHEN** a new user is created
- **THEN** the system SHALL store PRISM-specific fields in SuperTokens user metadata
- **AND** the metadata SHALL include: role, hierarchy_depth, reporter_id, region_scope

#### Scenario: Retrieving user metadata during session validation
- **WHEN** a session is validated
- **THEN** the system SHALL fetch PRISM-specific metadata from SuperTokens
- **AND** the system SHALL make this metadata available to endpoint handlers

### Requirement: Backend maintains referrer hierarchy on new user creation
The backend SHALL support establishing hierarchy relationships when a new user signs up with a referrer phone number.

#### Scenario: New user with valid referrer
- **WHEN** a new user signs up and provides a referrer phone number
- **AND** the referrer exists in the system
- **THEN** the new user's reporter_id SHALL be set to the referrer's user_id
- **AND** the new user's hierarchy_depth SHALL be referrer's depth + 1

#### Scenario: New user without referrer
- **WHEN** a new user signs up without a referrer phone number
- **THEN** the new user's reporter_id SHALL be NULL
- **AND** the new user's hierarchy_depth SHALL be 0

### Requirement: Backend provides sign-out endpoint
The backend SHALL provide an endpoint to invalidate user sessions.

#### Scenario: User signs out
- **WHEN** a user makes a request to the sign-out endpoint
- **THEN** the system SHALL invalidate the current session
- **AND** the system SHALL revoke the refresh token
- **AND** the system SHALL return a success response
