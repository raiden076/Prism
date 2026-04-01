## ADDED Requirements

### Requirement: Tree Structure Hierarchy Model
The system SHALL store organizational hierarchy as a tree using adjacency list pattern (parent_id foreign key).

#### Scenario: User record includes referrer
- **WHEN** new user is created via whitelist
- **THEN** `reporter_id` field references the inviting user
- **AND** NULL reporter_id indicates apex leader
- **AND** chain is traceable from any user to apex

#### Scenario: Recursive hierarchy query
- **WHEN** system needs user's full upline
- **THEN** recursive CTE queries from user to root
- **AND** result includes all ancestors
- **AND** query completes in <50ms for 10-level depth

### Requirement: Apex Leader Identification
The system SHALL identify apex leaders (top 2-3) as users with NULL reporter_id.

#### Scenario: Apex leader has no reporter
- **WHEN** user is created as apex leader
- **THEN** `reporter_id` is NULL
- **AND** `role` is set to "admin"
- **AND** `region_scope` is "all"

### Requirement: Phase 1 Foot Soldier Capture
The system SHALL capture complete organizational structure during Phase 1 foot-soldier-only access.

#### Scenario: Whitelist entry requires referrer phone
- **WHEN** Google Forms webhook receives whitelist entry
- **THEN** referrer phone number is required field
- **AND** system looks up referrer by phone
- **AND** new user's `reporter_id` is set to referrer's ID

#### Scenario: Unknown referrer handling
- **WHEN** referrer phone is not in database
- **THEN** system creates placeholder referrer record
- **AND** placeholder is flagged for verification
- **AND** hierarchy chain is still established

### Requirement: Hierarchy Depth Tracking
The system SHALL track depth of each user in hierarchy for access control.

#### Scenario: Depth calculated on user creation
- **WHEN** new user is created with reporter_id
- **THEN** `hierarchy_depth` = reporter's depth + 1
- **AND** apex leaders have depth 0
- **AND** depth enables quick subtree queries

### Requirement: Subtree Access Control
The system SHALL restrict data visibility to user's subtree in hierarchy.

#### Scenario: Admin sees their subtree
- **WHEN** non-apex admin queries users
- **THEN** only users in their subtree are returned
- **AND** subtree defined by descendants in hierarchy
- **AND** depth filter enables efficient query

#### Scenario: Foot soldier sees only self
- **WHEN** foot soldier queries data
- **THEN** only their own reports are visible
- **AND** no other users' data is accessible
- **AND** no hierarchy information is exposed

### Requirement: Hierarchy Visualization in Admin
The system SHALL display hierarchy tree in Control Dashboard for admins.

#### Scenario: Tree renders from apex
- **WHEN** admin views hierarchy section
- **THEN** tree visualization starts from apex leaders
- **AND** branches show reporter→reported relationships
- **AND** node size indicates report count
