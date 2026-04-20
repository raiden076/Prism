# Linear Sync Plan for PRISM

## Goal

Transfer all project knowledge to Linear. Create automated sync between GSD workflow and Linear so PM never needs GitHub.

## Current State (2026-04-15)

| What | Status |
|------|--------|
| Linear Project | "PRISM" created (green, urgent) |
| URL | https://linear.app/r00/project/prism-d3d7cd3e64e2 |
| Team | R00 |
| Milestones | 7 created (Phase 1-7) |
| Labels | backend, frontend, auth, geo, infra, design, blocker, narrative (+ default Bug, Feature, Improvement) |
| Issues Done | R00-5 to R00-10 (Phase 1+2 backfill, all marked Done) |
| Issues Active | R00-11 (03-01), R00-12 (03-02) — In Progress |
| Issues Todo | R00-13 (03-03) — blocked by R00-11 + R00-12 |
| Issues Pending | Phase 4-7 NOT created yet |

## Step 1: Get Linear API Key

1. Go to https://linear.app/settings/api
2. Create a new API key (label: "Claude Sync")
3. Store as env var:

```bash
# Add to ~/.bashrc or ~/.zshrc
export LINEAR_API_KEY="lin_api_xxx_your_key_here"
```

4. Also add to Claude settings env block in `~/.claude/settings.json` under `env`:
```json
"LINEAR_API_KEY": "lin_api_xxx_your_key_here"
```

## Step 2: Create Phase 4-7 Placeholder Issues

Requires Linear MCP connected. Create these issues:

### Phase 4 — Accountability + Bounty
| Issue | Title | Labels | Description |
|-------|-------|--------|-------------|
| 04-01 | Contractor fix submission + spatial drift | backend, geo | Contractor submits fix with coordinates; system accepts if drift ≤ 30m, flags if > 30m. Haversine distance calc. **Req:** ACCT-01, ACCT-02, ACCT-03 |
| 04-02 | Crony ground-truth verification | backend, auth | Crony submits verification (photo + resolved boolean). resolved=true → report resolved, false → pending_review. **Req:** VERF-01, VERF-02, VERF-03, VERF-04 |
| 04-03 | Bounty lifecycle | backend | Bounties auto-generate for fixed_pending_verification reports. Claim (15-min lock), complete via verification, expire. Nearby discovery by lat/lon/radius. **Req:** BNTY-01 through BNTY-06 |

### Phase 5 — Test Coverage
| Issue | Title | Labels | Description |
|-------|-------|--------|-------------|
| 05-01 | E2E test suite for all routes | backend, infra | E2E tests covering every API route with D1/R2 test environment. No skipped, no flaky. **Req:** TEST-03 |
| 05-02 | Unit test coverage for services + middleware | backend | All services, middleware, utilities covered. Quality gate before frontend. **Req:** TEST-04 |

### Phase 6 — Frontend Core
| Issue | Title | Labels | Description |
|-------|-------|--------|-------------|
| 06-01 | Field reporter capture UI | frontend, geo, design | Camera capture + GPS metadata stamping + DIGIPIN preview. Haptic on submit. **Req:** UI-01, UI-02 |
| 06-02 | War Room dashboard | frontend, design | Report list with status badges, DIGIPIN, creation date, severity. Filters by status. Contractor deployment on pending. **Req:** UI-03, UI-04, UI-05 |
| 06-03 | Hierarchy tree + UI polish | frontend, design | User hierarchy tree with expandable nodes. Neo-Brutalism design system. **Req:** UI-06, UI-07 |

### Phase 7 — Frontend Bounty
| Issue | Title | Labels | Description |
|-------|-------|--------|-------------|
| 07-01 | Bounty discovery + claim UI | frontend, geo, design | Nearby bounties sorted by distance. Claim with 15-min countdown timer. Haptic feedback. **Req:** UI-08, UI-09 |
| 07-02 | Verification submission UI | frontend, geo, design | Photo + GPS + resolved checkbox. Submit to backend. Haptic on success. **Req:** UI-10 |

All Phase 4-7 issues: status Todo, priority High, milestone matching phase.

## Step 3: Create Linear Documents

Linear Documents = wiki pages attached to the PRISM project. PM reads these, never touches GitHub.

### Document 1: "Strategic Narrative"

Content: contents of `narrative.md` verbatim.

### Document 2: "Tech Stack & Architecture"

Content extracted from `CLAUDE.md`:
- Runtime: TypeScript, Rust (Tauri), SQL
- Frontend: Svelte 5 + SvelteKit + Tauri v2 + Tailwind
- Backend: Hono.js + Cloudflare Workers + D1 + R2
- Design: Neo-Brutalism (prism-black, prism-white, prism-success, prism-crisis)
- Auth: SuperTokens (phone OTP)
- Key routes table (from CLAUDE.md API section)

### Document 3: "Development Conventions"

Content from CLAUDE.md conventions section:
- TypeScript standards (strict, interfaces, naming)
- Svelte 5 patterns (runes, event handlers)
- Error handling patterns
- API design conventions
- File organization

### Document 4: "GSD Workflow Guide"

Explain for PM:
- What GSD is (GetShitDone plugin for Claude Code)
- How phases map to Linear milestones
- How plans map to Linear issues
- What SUMMARY.md files mean (plan completed)
- What STATE.md means (current position)
- How the auto-sync works

## Step 4: Build GSD → Linear Sync Hook

### File: `~/.claude/hooks/gsd-linear-sync.sh`

```bash
#!/bin/bash
# Fires after GSD writes a *-SUMMARY.md file
# 1. Parse phase/plan from filename
# 2. Find matching Linear issue
# 3. Update issue status + add comment

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty')

# Only act on SUMMARY.md files in .planning
if [[ "$FILE_PATH" == *"-SUMMARY.md"* ]] && [[ "$FILE_PATH" == *".planning"* ]]; then
  # Extract phase-plan number (e.g., "03-02" from "03-02-SUMMARY.md")
  PLAN_ID=$(basename "$FILE_PATH" | grep -oP '\d{2}-\d{2}')

  # Call Linear API to update issue
  # Linear API uses GraphQL
  LINEAR_KEY="${LINEAR_API_KEY}"

  if [ -n "$LINEAR_KEY" ]; then
    # Find issue by title pattern
    ISSUE_ID=$(curl -s -X POST https://api.linear.app/graphql \
      -H "Authorization: Bearer $LINEAR_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"query\": \"{ issues(filter: {title: {contains: \\\"${PLAN_ID}:\\\"}}) { nodes { id title } } }\"}" \
      | jq -r '.data.issues.nodes[0].id')

    if [ -n "$ISSUE_ID" ] && [ "$ISSUE_ID" != "null" ]; then
      # Update status to Done
      curl -s -X POST https://api.linear.app/graphql \
        -H "Authorization: Bearer $LINEAR_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"mutation { issueUpdate(id: \\\"${ISSUE_ID}\\\", input: {state: done}) { success } }\"}"
    fi
  fi
fi
```

### Register in settings.json

Add to `hooks.PostToolUse` array in `~/.claude/settings.json`:

```json
{
  "matcher": "Write|Edit",
  "hooks": [
    {
      "type": "command",
      "command": "bash /home/arkaprav0/.claude/hooks/gsd-linear-sync.sh",
      "timeout": 10
    }
  ]
}
```

## Step 5: Build Session-Level State Sync

### File: `~/.claude/hooks/gsd-linear-session-sync.sh`

Runs on SessionStart. Reads `.planning/STATE.md`, updates Linear project.

```bash
#!/bin/bash
# Runs on session start
# Reads STATE.md, updates Linear project description with current position

STATE_FILE="/home/arkaprav0/Prism/.planning/STATE.md"
LINEAR_KEY="${LINEAR_API_KEY}"
PROJECT_ID="71a036cc-a3f1-4671-bd69-e071f50d865c"  # PRISM project

if [ -f "$STATE_FILE" ] && [ -n "$LINEAR_KEY" ]; then
  # Extract current phase and progress
  CURRENT_PHASE=$(grep "^Phase:" "$STATE_FILE" | head -1)
  PROGRESS=$(grep "^Progress:" "$STATE_FILE" | head -1)
  STATUS=$(grep "^Status:" "$STATE_FILE" | head -1)

  # Update project description with session state
  # (append current position info)
  curl -s -X POST https://api.linear.app/graphql \
    -H "Authorization: Bearer $LINEAR_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"mutation { projectUpdate(id: \\\"${PROJECT_ID}\\\", input: {description: \\\"Updated: $(date +%Y-%m-%d) | ${CURRENT_PHASE} | ${PROGRESS} | ${STATUS}\\\"}) { success } }\"}"
fi
```

### Register in settings.json

Add to `hooks.SessionStart` array:

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "bash /home/arkaprav0/.claude/hooks/gsd-linear-session-sync.sh",
      "timeout": 10
    }
  ]
}
```

## Step 6: Execution Order

1. **Get Linear API key** → env var
2. **Restart Claude session** → reconnect Linear MCP
3. **Create Phase 4-7 issues** → via Linear MCP tools
4. **Create 4 Linear Documents** → narrative, architecture, conventions, GSD guide
5. **Write sync hook scripts** → `gsd-linear-sync.sh`, `gsd-linear-session-sync.sh`
6. **Register hooks in settings.json**
7. **Test**: run `/gsd-quick` or `/gsd-execute-phase`, verify Linear auto-updates

## PM Onboarding Checklist

After all above done, tell PM:

1. Open https://linear.app/r00/project/prism-d3d7cd3e64e2
2. Read Documents tab (narrative, architecture, conventions)
3. Check Issues tab for current work
4. Milestones tab for phase progress
5. Never needs GitHub — everything auto-syncs

---

*Created: 2026-04-15*
*Prerequisite: Linear MCP reconnected + API key generated*
