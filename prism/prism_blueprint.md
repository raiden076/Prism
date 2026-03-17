# PRISM Architectural Blueprint & Initialization Instructions

This document provides the exact initialization instructions, configuration files, and structural definitions for building the PRISM civic infrastructure. No application logic is provided in raw code, strictly adhering to the "plain English structural instructions" mandate. Config blocks are provided where strictly unavoidable for exact environment alignment.

---

## Part 1: Tauri and Svelte Workspace Initialization

Use the following strict structural sequence to initialize the PRISM Frontend.

**1. Scaffolding the Core Workspace**
* Executing the Tauri scaffolding command is the first requirement. You will initialize the app using the Tauri v2 CLI installer.
* During initialization, strictly select **Svelte** as the UI framework and **TypeScript** as the language base.
* Ensure the package manager chosen is `bun` for maximally efficient dependency resolution, paired with `wrangler`.

**2. Integrating the Design System & Styling Engine**
* Once the base Svelte directory exists, initialize Tailwind CSS v3.4+ using the standard PostCSS configuration.
* The frontend must strictly avoid installing any heavy UI component libraries (no Flowbite, no Skeleton).

**3. The Neo-Brutalism Environment Configuration (tailwind.config.ts)**
* You must replace the generated `tailwind.config.ts` with the exact configuration below to enforce the Neo-Brutalism design system.
* The configuration enforces stark colors (Black/White), utilitarian greys, and our specific action colors. Box shadows are redefined to be solid blocks without blurring.

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'prism-black': '#0a0a0a',
        'prism-white': '#fdfdfd',
        'prism-surface': '#171717',
        'prism-success': '#00FF00', // Aggressive Green
        'prism-crisis': '#FF0000',  // Stark Red
      },
      fontFamily: {
        // Enforcing heavy sans-serif typography for high legibility
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Unblurred drop-shadows mimicking heavy physical hardware switches
        'solid-sm': '2px 2px 0px 0px rgba(0, 0, 0, 1)',
        'solid-md': '4px 4px 0px 0px rgba(0, 0, 0, 1)',
        'solid-lg': '8px 8px 0px 0px rgba(0, 0, 0, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**4. Physical Component Interaction Logic (Svelte Blueprint)**
* When defining a "Button" in Svelte logic, structure the HTML element to accept the exact solid box-shadow utility classes defined above.
* Implement a reactive state binding on the button's click event. When toggled into an active state, dynamically strip the shadow classes from the element and inject a `translate-y-1` or `translate-y-2` Tailwind class to visually mimic physical depression.
* Upon that same click event, trigger the `navigator.vibrate(50)` Web API hardware call before executing the primary form submission.

---

## Part 2: Cloudflare Workers & Hono.js Edge Backend (Phase 1 & Phase 2)

The backend must be initialized specifically for the Cloudflare Workers edge environment.

**1. Scaffolding the Edge API**
* Initialize the Cloudflare Worker using the official `create-cloudflare` CLI, selecting Hono as the core routing framework.
* Ensure D1 (Relational Data) and R2 (Blob Storage) dependencies are added to the environment.

**2. The Environment Setup (wrangler.jsonc)**
* The `wrangler.jsonc` file is mandatory to bind our serverless D1 database, R2 buckets, and the Phase 2 AI activation flag correctly without hardcoding them in the logic layer.

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "prism-engine",
  "main": "src/index.ts",
  "compatibility_date": "2024-03-20",
  "compatibility_flags": ["nodejs_compat"],

  "vars": {
    "AI_ACTIVATED": "false" // Default to Phase 1 (AI Bypass)
  },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "prism_board",
      "database_id": "<INJECT_PROD_DB_ID>" // Define in production
    }
  ],

  "r2_buckets": [
    {
      "binding": "VAULT",
      "bucket_name": "prism_vault"
    }
  ]
}
```

**3. Hono.js Routing Definition & Logic Instructions**

Create the API router strictly conforming to the following logic blocks:

*   **Setup:** Initialize the global Hono application binding the Cloudflare `Env` types mapping `DB`, `VAULT`, and `AI_ACTIVATED`.

*   **Phase 1 Execution Chain (The Cold Start):**
    *   Initialize route `POST /api/v1/whitelist`.
    *   Instruct the route to parse incoming JSON matching the Google Form webhook output format. Validate that fields for Name, ReferenceID, and Phone are present. Formulate a raw SQL `INSERT INTO Whitelisted_Sources` statement mapping these parameters, executing it against the bound `D1` instance, returning a 201 Created.
    *   Initialize route `POST /api/v1/reports/harvest`.
    *   Instruct the route to extract the user's phone number from the Authorization header (OTPless token equivalent). Execute a `SELECT` against `Whitelisted_Sources` to confirm authorization.
    *   Buffer the incoming multipart form data containing the media file. Generate a unique cryptographic UUID and stream this buffer into the `VAULT` R2 binding.
    *   Parse the metadata for Latitude and Longitude. Convert coordinates to DIGIPIN format (placeholder structural call to an external mapping utility function).
    *   Execute `INSERT INTO Reports (..., status)` appending the hardcoded value `'approved'`, mapping the R2 object URL. Terminate the request with an HTTP 200.

*   **Phase 2 Execution Chain (The Pluggable AI Routing):**
    *   Initialize route `POST /api/v2/reports`.
    *   Implement an IF conditional block verifying if `env.AI_ACTIVATED === "true"`. If false, abort or redirect to legacy v1 execution.
    *   If true, dispatch the media blob via an HTTP `fetch` to the theoretical YOLO inference server endpoint.
    *   Awaiting the response, parse the float `confidence` variable.
    *   Create a nested IF/ELSE structural tree evaluating the thresholds:
        *   *(> 0.90)* Write out to R2 vault, execute `INSERT` into `D1` with status `'approved'`.
        *   *(> 0.65)* Write out to R2 vault, execute `INSERT` into `D1` with status `'pending_review'`.
        *   *(< 0.65)* Drop the payload from memory, respond with HTTP 406 Not Acceptable and an error code signaling the frontend to spawn the Appeal interface.
    
*   **The Appeal Bypass:**
    *   Initialize route `POST /api/v2/reports/appeal`.
    *   Instruct the route to ingest a payload formatted identically to `v2/reports`, but entirely skip the YOLO inference HTTP call block.
    *   Directly commit the media blob to `VAULT`, and forcefully write the record to `D1` with status `'pending_review'`.

*   **The Accountability Loop (Spatial Drift Validation):**
    *   Initialize route `POST /api/v2/interventions/fix`.
    *   Parse the Report ID, Contractor ID, and the Contractor's GPS footprint from the request.
    *   Command a `SELECT latitude, longitude FROM Reports WHERE id = ?` via D1 using the Report ID.
    *   Execute the calculation combining both GPS pairs through the Haversine mathematical algorithm to compute the `drift_distance` float integer.
    *   Implement an IF conditional: If `drift_distance` is less than or equal to 30.0 meters, authorize an `UPDATE Reports SET status = 'fixed_pending_verification'` operation in D1, and record the `Interventions` table entry.
    *   If greater than 30.0 meters, record the `Interventions` table entry but tag it for human review, and abort updating the `Reports` board status. Terminate the request with instructions to flag the Contractor ID.

*   **The Final Verification Loop (Crony Ground Truth):**
    *   Initialize route `POST /api/v2/interventions/verify`.
    *   Instruct the route to serve `fixed_pending_verification` reports to 'crony' users in the vicinity.
    *   Display the original image and the contractor's fix image to the crony for visual comparison.
    *   Ingest the Report ID, Crony ID, a boolean flag `is_resolved`, and the new verification photo blob.
    *   Commit the verification photo blob to the `VAULT` R2 binding.
    *   If `is_resolved` is true, execute `UPDATE Reports SET status = 'resolved'` in D1. This final state visually collapses the War Room Red Spike and issues the final payout contracts.
    *   If `is_resolved` is false, execute `UPDATE Reports SET status = 'pending_review'` to flag it for the IT cell dashboard, indicating the contractor failed the fix.
