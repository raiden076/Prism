# Target: PRISM Project Architecture & Initialization

This document outlines the architecture, design, and step-by-step structural implementation instructions for the PRISM highly secure, decentralized civic infrastructure. Following your stringent requirements, no raw application code blocks are provided; all logic is defined structurally and in plain English.

## 1. Tauri (v2) and Svelte (v5) Workspace Initialization

**Workspace Setup Strategy (Frontend):**
1. Ensure `bun`, `rust`, and Tauri v2 prerequisites are installed on the local system.
2. Initialize the project in the target directory using the official create-tauri-app scaffolding tool, utilizing `bun` for package management.
3. Select Svelte as the frontend framework and configure it to use TypeScript. This will set up Svelte 5 for maximum execution speed.
4. Integrate setting up Tailwind CSS (v3.4+) within the Svelte frontend configuration to provide our tactical design system.
5. Create a `src-tauri` structure strictly for native OS integrations, keeping the footprint minimal as per Tauri v2 standards.

**Neo-Brutalism & Tactical Skeuomorphism Design System Tokens (Tailwind Config):**
*   **Colors:**
    *   `background`: Stark White or Deep Black (default to Deep Black for tactical display, e.g., `#0a0a0a`).
    *   `surface`: Utilitarian Dark Gray (e.g., `#171717`).
    *   `action-success`: Aggressive Green (e.g., `#00FF00`).
    *   `action-crisis`: Stark Red (e.g., `#FF0000`).
*   **Typography:**
    *   Use heavy, bold, highly legible sans-serif fonts natively available or imported (e.g., 'Inter', 'Roboto') that remain incredibly legible under bright natural light.
*   **Component Physics (No pre-built libraries):**
    *   Generate a custom Tailwind plugin or CSS class configuration for Buttons:
    *   Buttons must feature an unblurred, solid drop-shadow mapping to our surface/action colors (mimicking a thick, physical industrial switch block).
    *   Interaction states (`:active`) must eliminate the shadow and apply a strictly calculated Y-axis translation (`translate-y-[distance]`) downward.
*   **Hardware Interactivity:**
    *   Bind the device's native haptic vibration API (`navigator.vibrate`) to all critical state changes affecting the physical UI switches.

## 2. Hono.js API Routes (Cloudflare Workers) Architecture

The backend will be purely edge-native, running Hono.js on Cloudflare Workers. 

**Global Pre-flight & Middleware:**
*   CORS enforcement.
*   OTPless Authentication Middleware (validating WhatsApp/SMS tokens gracefully).
*   Environment Variable Injection (binding `D1`, `R2`, and the `AI_ACTIVATED` flag).

### Phase 1: The Cold Start & Data Harvest (Days 1-7)

During this phase, only the whitelist is respected, and AI is bypassed.

*   **`POST /api/v1/whitelist` (Webhook Endpoint)**
    *   **Purpose:** Ingests trusted worker additions via Google Forms.
    *   **Logic:** Receives payload containing Name, ID/Reference, and Phone Number. Validates payload structure and inserts an entry directly into the `Whitelisted_Sources` D1 database table.
*   **`POST /api/v1/reports/harvest` (Trusted Ingestion)**
    *   **Purpose:** Securely ingests raw field data from whitelisted contractors.
    *   **Logic:**
        1. Authenticate the incoming phone number against the `Whitelisted_Sources` table. Reject unauthorized calls instantly.
        2. Accepts the multi-part form data (Image/Video Blob + Metadata).
        3. Persistently writes the media blob to the Cloudflare R2 bucket.
        4. Extracts Latitude and Longitude from the metadata and converts them to the 10-character alphanumeric DIGIPIN format (using MapmyIndia/Mappls logic).
        5. Inserts the record into the `Reports` D1 table with the status hardcoded to `approved`.

### Phase 2: AI Activation & Public Rollout (Day 8+)

When the `AI_ACTIVATED` feature flag is true, traffic is routed through external YOLO validation.

*   **`POST /api/v2/reports` (Public Ingestion)**
    *   **Purpose:** Processes all incoming submissions via OTPless authenticated public users and routes to the YOLO microservice.
    *   **Logic:**
        1. Proxies the incoming media blob to the external YOLO GPU server for inference.
        2. Evaluates the returned confidence score threshold:
            *   **90% to 100% (Auto-Approve):** Save media to R2. Insert into `Reports` D1 table as `status='approved'`. Dispatch background trigger for War Room Globe.gl update and dispatch micro-payout.
            *   **65% to 89% (Purgatory):** Save media to R2. Insert into `Reports` D1 table as `status='pending_review'`. Alerts the IT cell dashboard queue.
            *   **Below 65% (Auto-Drop):** Reject payload entirely. Return an error instruction to the client Svelte app to render the "Appeal" physical button.
*   **`POST /api/v2/reports/appeal`**
    *   **Purpose:** Allows the user to bypass an Auto-Drop.
    *   **Logic:** Re-submits the dropped payload, bypassing the YOLO AI inference entirely, and hard-injecting it into the `Reports` table with `status='pending_review'`.
*   **`POST /api/v2/interventions/fix` (The Accountability Loop)**
    *   **Purpose:** Handles contractor proof of pothole fix, including spatial drift calculation.
    *   **Logic:**
        1. Receives Report ID, Contractor ID, Repair Tier, and Proof Image.
        2. Queries the original `Reports` table for the initial Latitude/Longitude.
        3. Executes the Haversine formula calculation comparing the original GPS coordinates to the Contractor's GPS footprint.
        4. **If Drift <= 30 meters:** Commits proof image to R2, updates `Reports` table status to `fixed_pending_verification`, and maps the Intervention event.
        5. **If Drift > 30 meters:** Commits proof image to R2, blocks automated resolution, and flags the Intervention for strict human fraud review.
*   **`POST /api/v2/interventions/verify` (The Final Verification Loop)**
    *   **Purpose:** Crony (reporter) ground-truth verification comparing the before and after pictures from the site.
    *   **Logic:** 
        1. Displays both original report and contractor fix images to a nearby crony user.
        2. Accepts a new verification photo from the crony and a boolean `is_resolved` status.
        3. Commits the new verification image to R2 and writes to a new `Verifications` D1 table.
        4. **If Resolved:** Updates `Reports` table status to `resolved`, collapsing the War Room Red Spike and clearing pending payouts.
        5. **If Not Resolved:** Updates `Reports` table status to `pending_review` for human IT cell intervention.

## 3. Database Architecture Schema Definition

Cloudflare D1 will enforce the following strict relational boundaries:

*   **Users Table:** Primary Key `ID`, `role` (enum), `phone_number` (unique identifier for OTPless), `region_scope`, `created_at`.
*   **Whitelisted_Sources Table:** Primary Key `ID`, Foreign Key `linked_user_id` (Users), `verified_name`, `reference_id`, `approval_status`.
*   **Reports Table:** Primary Key `ID`, Foreign Key `reporter_id` (Users), `latitude` (Float), `longitude` (Float), `digipin` (String), `r2_image_url`, `status` (enum: pending, pending_review, assigned, fixed_pending_verification, resolved), `ai_confidence_score` (Float), `severity_weight` (Integer), `created_at`.
*   **Interventions Table:** Primary Key `ID`, Foreign Key `report_id` (Reports), Foreign Key `contractor_id` (Users), `repair_tier` (Integer), `r2_proof_image_url`, `fix_latitude`, `fix_longitude`, `spatial_drift_calc` (Float in meters), `execution_timestamp`.
*   **Verifications Table:** Primary Key `ID`, Foreign Key `report_id` (Reports), Foreign Key `verifier_id` (Users), `r2_verification_image_url`, `is_resolved` (Boolean), `verification_timestamp`.

## User Review Required

The architectural blueprint above details the workspace constraints and edge logic strictly according to PRISM's parameters.
Please review the proposed plan to confirm these align completely with your intentions. Let me know if you are ready to begin the execution phase, where we will start initializing the Tauri application and writing the Wrangler configurations.
