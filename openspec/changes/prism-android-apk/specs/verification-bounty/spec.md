## ADDED Requirements

### Requirement: Mappls Map Integration
The system SHALL use Mappls JavaScript SDK for all verification bounty mapping.

#### Scenario: Map renders with nearby bounties
- **WHEN** user opens Verification Bounty view
- **THEN** Mappls map initializes with user's current location centered
- **AND** nearby verification bounties appear as markers
- **AND** map uses dark mode styling

#### Scenario: Dummy keys for development
- **WHEN** running in development mode
- **THEN** dummy Mappls API keys are used
- **AND** map still renders with placeholder tiles
- **AND** real keys can be swapped via environment variable

### Requirement: Nearby Bounty Display
The system SHALL display verification bounties within user's vicinity.

#### Scenario: Bounties filtered by proximity
- **WHEN** map loads
- **THEN** only bounties within 5km radius are shown
- **AND** bounty markers show reward amount (₹5-10)
- **AND** cluster markers for dense areas

#### Scenario: Bounty detail on tap
- **WHEN** user taps a bounty marker
- **THEN** detail card shows original photo, location, reward amount
- **AND** "CLAIM" button is visible
- **AND** distance from current location is shown

### Requirement: Claim Workflow
The system SHALL allow users to claim verification bounties.

#### Scenario: Claim bounty
- **WHEN** user taps "CLAIM" on a bounty
- **THEN** bounty is temporarily locked to user (15 min)
- **AND** user must navigate to location
- **AND** camera interface opens for verification photo

### Requirement: Verification with Picture and Location
The system SHALL require photo and GPS verification for bounty completion.

#### Scenario: Submit verification
- **WHEN** user captures verification photo at location
- **THEN** GPS coordinates are captured
- **AND** Haversine distance from original report is calculated
- **AND** if distance ≤30m, verification is accepted

#### Scenario: Spatial drift exceeds threshold
- **WHEN** verification GPS is >30m from original
- **THEN** verification is flagged for manual review
- **AND** user is notified of potential fraud
- **AND** no reward is credited immediately

### Requirement: Bounty Reward System
The system SHALL credit ₹5-10 rewards for successful verifications.

#### Scenario: Reward credited on successful verification
- **WHEN** verification is accepted
- **THEN** user's balance is credited with bounty amount
- **AND** transaction is logged in database
- **AND** user sees updated total in profile
