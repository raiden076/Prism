## ADDED Requirements

### Requirement: Massive Record Pothole CTA
The system SHALL display a massive, undeniable "Record Pothole" call-to-action as the primary interface for foot soldiers.

#### Scenario: CTA dominates screen
- **WHEN** foot soldier views their default screen
- **THEN** a large button labeled "REPORT POTHOLE" fills majority of viewport
- **AND** button uses aggressive green (#00FF00) on prism-black
- **AND** solid shadow with translate-y depression on tap

#### Scenario: CTA triggers camera immediately
- **WHEN** foot soldier taps the CTA
- **THEN** device camera opens via Tauri native plugin
- **AND** haptic feedback triggers (50ms vibration)
- **AND** no intermediate screens or confirmations

### Requirement: Tauri Native Camera Integration
The system SHALL use `@tauri-apps/plugin-camera` for all camera operations, replacing browser `navigator.mediaDevices`.

#### Scenario: Camera capture for pothole
- **WHEN** foot soldier triggers camera
- **THEN** native camera plugin activates
- **AND** photo is captured and returned as base64 or file path
- **AND** no browser API fallback is attempted

#### Scenario: Camera permission denied
- **WHEN** camera permission is not granted
- **THEN** system shows permission request dialog
- **AND** if permanently denied, shows instructions to enable in settings

### Requirement: Tauri Native GPS with DIGIPIN
The system SHALL use `@tauri-apps/plugin-geolocation` for GPS and convert all coordinates to DIGIPIN format.

#### Scenario: GPS coordinates captured with report
- **WHEN** pothole report is submitted
- **THEN** current GPS coordinates are captured via Tauri plugin
- **AND** coordinates are converted to 10-character DIGIPIN
- **AND** DIGIPIN is stored in report payload

#### Scenario: GPS accuracy warning
- **WHEN** GPS accuracy exceeds 30 meters
- **THEN** system displays accuracy warning to user
- **AND** user can choose to proceed or wait for better accuracy

### Requirement: Canvas Metadata Burn-In
The system SHALL burn timestamp and GPS coordinates onto the captured image before upload.

#### Scenario: Metadata burned onto image
- **WHEN** photo is captured
- **THEN** HTML5 Canvas overlays timestamp and GPS coordinates on bottom edge
- **AND** modified image is saved for upload
- **AND** original EXIF metadata is preserved separately

### Requirement: Existing Pothole Map Overlay
The system SHALL display existing potholes on a map before capture to prevent duplicates.

#### Scenario: Nearby potholes shown before capture
- **WHEN** foot soldier opens camera view
- **THEN** mini-map shows existing potholes within 100m radius
- **AND** geo-fenced areas are highlighted
- **AND** user sees what's already reported

### Requirement: Reward Display
The system SHALL display the ₹50 reward amount prominently to motivate reporting.

#### Scenario: Reward shown after successful submission
- **WHEN** pothole report is successfully submitted
- **THEN** success message includes "₹50 reward pending verification"
- **AND** total pending rewards are visible in user profile
