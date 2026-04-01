## ADDED Requirements

### Requirement: Auto-create Geo-fence on Capture
The system SHALL automatically create a geo-fence around newly captured potholes.

#### Scenario: Geo-fence radius created
- **WHEN** foot soldier successfully submits pothole report
- **THEN** 50m radius geo-fence is created around the DIGIPIN
- **AND** geo-fence is stored in database with report reference
- **AND** geo-fence is visible on all maps

### Requirement: Existing Pothole Overlay Before Capture
The system SHALL show existing potholes on the foot soldier's map before new capture.

#### Scenario: Nearby potholes displayed
- **WHEN** foot soldier opens the reporting interface
- **THEN** map shows all existing potholes within 200m
- **AND** geo-fenced areas are highlighted in orange
- **AND** user sees "Already Reported" labels

### Requirement: Duplicate Prevention Warning
The system SHALL warn users attempting to report within an existing geo-fence.

#### Scenario: User enters geo-fence
- **WHEN** foot soldier's GPS is within 50m of existing pothole
- **THEN** warning dialog appears: "This area already has a reported pothole"
- **AND** options: "Report Anyway" or "View Existing"
- **AND** "Report Anyway" requires reason selection

#### Scenario: Duplicate blocked with reason
- **WHEN** user proceeds with duplicate report
- **THEN** report is flagged as "potential_duplicate"
- **AND** reason is stored with report
- **AND** report enters manual review queue

### Requirement: Batch Area Verification
The system SHALL support batch verification for all potholes within a geo-fence.

#### Scenario: Authority arrives at geo-fence
- **WHEN** contractor/verifier enters geo-fence area
- **THEN** system shows all potholes in that cluster
- **AND** single "Verify All" option is available
- **AND** batch verification credits proportional rewards

#### Scenario: Batch verification workflow
- **WHEN** verifier selects "Verify All"
- **THEN** system requires photos for each pothole in cluster
- **AND** all verifications are processed together
- **AND** spatial drift is calculated for each

### Requirement: Geo-fence Query Performance
The system SHALL efficiently query geo-fences using DIGIPIN prefix matching.

#### Scenario: Fast geo-fence lookup
- **WHEN** system checks for nearby geo-fences
- **THEN** DIGIPIN prefix query returns matches in <100ms
- **AND** no full-table scans on coordinates
- **AND** results cached for 5 minutes
