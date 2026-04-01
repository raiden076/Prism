## ADDED Requirements

### Requirement: Globe.gl 3D Sphere Visualization
The system SHALL display a Globe.gl 3D sphere representing district health for apex leadership visualization.

#### Scenario: Dark translucent orb renders
- **WHEN** admin accesses Control Dashboard
- **THEN** Globe.gl renders a dark translucent sphere
- **AND** sphere has no terrain or geographic borders
- **AND** baseline color reflects average of unresolved incidents

#### Scenario: Red spikes for unresolved clusters
- **WHEN** unresolved DIGIPIN clusters exist
- **THEN** solid red spikes rise from sphere surface at cluster locations
- **AND** spike height correlates to severity_weight (age + density)
- **AND** sphere remains static (no pointless spinning)

#### Scenario: Spike collapse on resolution
- **WHEN** contractor resolves an issue
- **THEN** corresponding red spike collapses downward rapidly
- **AND** local sphere area cools toward green spectrum
- **AND** no childish particle effects

### Requirement: 2D Tactical Heatmap
The system SHALL provide a secondary 2D tactical view for street-level contractor dispatching.

#### Scenario: Switch to 2D view
- **WHEN** admin toggles to 2D view
- **THEN** Mappls flat dark-mode heatmap is displayed
- **AND** incidents are shown as color-coded markers
- **AND** contractor locations are visible in real-time

### Requirement: Power Hierarchy Tree Display
The system SHALL display the organizational hierarchy from apex leaders to foot soldiers.

#### Scenario: Hierarchy tree visualization
- **WHEN** admin views hierarchy section
- **THEN** tree structure shows apex leaders (top 2-3) at root
- **AND** connected chain expands downward
- **AND** foot soldiers are at leaf nodes
- **AND** each node shows name, role, region, report count

### Requirement: Hierarchical Access Control
The system SHALL enforce role-based visibility based on user's position in hierarchy.

#### Scenario: Master admin sees everything
- **WHEN** master admin logs in
- **THEN** all regions, all users, all reports are visible
- **AND** full hierarchy tree is accessible
- **AND** all contractor deployments are manageable

#### Scenario: Regional admin sees only their region
- **WHEN** regional admin logs in
- **THEN** only their assigned region's data is visible
- **AND** hierarchy tree is filtered to their subtree
- **AND** contractor deployment limited to their region

### Requirement: Contractor Deployment
The system SHALL allow admins to assign contractors to specific incidents.

#### Scenario: Deploy contractor to incident
- **WHEN** admin selects an unresolved incident
- **THEN** admin can assign a contractor from available list
- **AND** contractor receives notification
- **AND** incident status changes to "assigned"

### Requirement: Evidence Posting
The system SHALL allow admins to post evidence for resolved incidents.

#### Scenario: Upload resolution evidence
- **WHEN** contractor marks incident as fixed
- **THEN** admin can upload verification evidence
- **AND** evidence is stored in R2
- **AND** incident moves to "verified" status

### Requirement: Phase 1 Whitelist Management
The system SHALL provide webhook endpoint for Google Forms whitelist population.

#### Scenario: Webhook receives whitelist entry
- **WHEN** Google Forms submits (Name, ID/Reference, Phone)
- **THEN** entry is added to whitelisted_users table
- **AND** user can authenticate via OTPLess
- **AND** user is assigned "crony" role by default

### Requirement: Phase 2 AI Review Queue
The system SHALL display 65-89% confidence submissions for manual review when AI is active.

#### Scenario: Purgatory queue display
- **WHEN** AI confidence is between 65-89%
- **THEN** submission appears in review queue
- **AND** admin can approve or reject
- **AND** approval triggers normal flow
- **AND** rejection drops submission
