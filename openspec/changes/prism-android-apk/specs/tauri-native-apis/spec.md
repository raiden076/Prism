## ADDED Requirements

### Requirement: Camera via Tauri Plugin
The system SHALL use `@tauri-apps/plugin-camera` for all camera operations.

#### Scenario: Initialize camera plugin
- **WHEN** app starts
- **THEN** camera plugin is registered with Tauri
- **AND** permissions are requested on first use
- **AND** no browser `navigator.mediaDevices` calls

#### Scenario: Capture photo
- **WHEN** user triggers photo capture
- **THEN** `takePhoto()` from camera plugin is called
- **AND** photo is returned as file path or base64
- **AND** haptic feedback confirms capture

### Requirement: Geolocation via Tauri Plugin
The system SHALL use `@tauri-apps/plugin-geolocation` for all GPS operations.

#### Scenario: Get current position
- **WHEN** GPS coordinates are needed
- **THEN** `getCurrentPosition()` from geolocation plugin is called
- **AND** latitude, longitude, and accuracy are returned
- **AND** no browser `navigator.geolocation` calls

#### Scenario: Watch position for continuous updates
- **WHEN** map view is active
- **THEN** `watchPosition()` provides continuous updates
- **AND** position updates every 5 seconds
- **AND** watch is cleared when view closes

### Requirement: Vibration via Tauri Plugin
The system SHALL use `@tauri-apps/plugin-vibration` for all haptic feedback.

#### Scenario: Haptic on button press
- **WHEN** user taps primary action button
- **THEN** `vibrate(50)` is called from vibration plugin
- **AND** 50ms vibration pattern executes
- **AND** no browser `navigator.vibrate` calls

#### Scenario: Haptic on success
- **WHEN** report submission succeeds
- **THEN** `vibrate([50, 50, 50])` pattern executes
- **AND** success vibration is distinct from tap

### Requirement: Browser API Replacement Audit
The system SHALL have zero browser API calls for hardware access.

#### Scenario: No navigator.mediaDevices
- **WHEN** code is audited
- **THEN** no `navigator.mediaDevices` references exist
- **AND** all camera code uses Tauri plugin

#### Scenario: No navigator.geolocation
- **WHEN** code is audited
- **THEN** no `navigator.geolocation` references exist
- **AND** all GPS code uses Tauri plugin

#### Scenario: No navigator.vibrate
- **WHEN** code is audited
- **THEN** no `navigator.vibrate` references exist
- **AND** all haptic code uses Tauri plugin
