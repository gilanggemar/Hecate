# 🔍 NERV.OS → HECATE — Complete Rename Impact Analysis

> **Updated**: 2026-04-12 — Full re-scan of codebase after dashboard-mcp server addition and component refactoring.

## TL;DR Verdict

> [!IMPORTANT]
> **Renaming will NOT break your app's core functionality** — but only if done correctly and progressively. The vast majority of "NERV" references are **cosmetic** (CSS class names, display text, comments). A small number of **functional** references require careful handling, but none are coupled to the name "NERV" in a way that prevents atomic renaming.

The key insight: **nothing in your database schema, routing, or API contracts depends on the string "NERV"**. Your Supabase tables have generic names (`agents`, `conversations`, `workflows`, etc.), your API routes are generic (`/api/agents/`, `/api/chat/`), and your Next.js routing has no NERV-prefixed paths.

**One external dependency**: The Supabase storage bucket `nerv-images` exists in Supabase and is referenced in code — renaming it requires a coordinated bucket rename + data migration OR keeping the old bucket name.

---

## Risk Matrix

| Layer | Risk Level | # of Lines | Breaks if Missed? | Notes |
|-------|-----------|------------|-------------------|-------|
| CSS Design System (`globals.css`) | 🟡 Medium | **~194 lines** | Yes — styling breaks | `--nerv-cyan`, `.nerv-glass-3`, `@keyframes nerv-*` |
| CSS Variable Usages (components) | 🟡 Medium | **~350+ lines** | Yes — styling breaks | `var(--nerv-cyan)`, `var(--nerv-surface-3)` across ~50 files |
| CSS Class Usages (components) | 🟡 Medium | **~100+ lines** | Yes — styling breaks | `nerv-caption`, `nerv-glass-3`, `nerv-dock-btn` across ~30 files |
| localStorage/sessionStorage keys | 🟢 Low | ~20 unique keys | No — old keys orphaned | `nerv_active_agent`, `nerv_vignette_settings`, etc. |
| DOM Element IDs | 🟢 Low | 2 | No — only internal | `nerv-selection-quote`, `nerv-summit-selection-quote` |
| Environment Variables | 🔴 High | 3 refs | **Yes — encryption breaks** | `NERV_ENCRYPTION_KEY` |
| Encryption Fallback Strings | 🔴 High | 2 | **Yes — decryption breaks** | `nerv-os-default-key-change-me`, `nerv-os-provider-salt` |
| Supabase Storage Bucket | 🔴 High | 3 file refs | **Yes — image uploads break** | `nerv-images` bucket in Supabase |
| OpenClaw Gateway Client ID | 🟡 Medium | 5 | Depends on backend | `nerv-dashboard` as client ID, `nerv-workflow/0.1.0` |
| Dashboard MCP Server | 🟡 Medium | ~20 lines | Cosmetic + tool names | `@nervos/dashboard-mcp`, `TOOL_PREFIX = "nerv"`, `NERV_USER_ID` |
| Branding/Display Strings | 🟢 Low | ~15 | No — cosmetic only | "NERV.OS", "NERV", "Welcome to NERV.OS" |
| Code Comments | 🟢 Low | ~15 | No | Documentation strings |
| Component/File Names | 🟢 Low | 1 file | Import updates needed | `NervSkeleton.tsx` |
| GitHub Repo Name | 🟡 Medium | External | Vercel redeploy needed | `gilanggemar/NERV` |
| Vercel Project | 🟡 Medium | External | Domain/URL changes | `nerv-one.vercel.app` |
| Documentation Files | 🟢 Low | ~10 lines | No | MAINTENANCE.md, USER_GUIDE.md, Chat_Features_Deep_Analysis.md |
| Implementation Plan Files | 🟢 Low | ~80 lines | No | `nerv_mcp`, `dashboard_mcp_brief.md`, `PRODUCTION_READINESS_AUDIT.md` |
| Dev Tools Scripts | 🟢 Low | ~10 lines | No — debug only | `tools/check_ws_gateway.js`, `tools/debug_scopes.js`, etc. |
| Architecture Docs | 🟢 Low | 3 | No | `architecture/websocket_events.md` |

---

## Progressive Rename Strategy (Safest First → Most Critical Last)

### Phase 1: 🟢 Documentation & Comments (ZERO RISK)

Pure text changes. Cannot break anything.

#### Files:
| File | Lines | What to change |
|------|-------|---------------|
| [RENAME_IMPACT_ANALYSIS.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/RENAME_IMPACT_ANALYSIS.md) | all | This file itself |
| [PRODUCTION_READINESS_AUDIT.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/PRODUCTION_READINESS_AUDIT.md) | ~15 | "NERV.OS" mentions |
| [docs/MAINTENANCE.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/docs/MAINTENANCE.md) | 3 | "NERV.OS" mentions |
| [docs/USER_GUIDE.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/docs/USER_GUIDE.md) | 3 | "NERV.OS" / "NERV" mentions |
| [docs/Chat_Features_Deep_Analysis.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/docs/Chat_Features_Deep_Analysis.md) | 3 | "NERV.OS" mentions |
| [architecture/websocket_events.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/architecture/websocket_events.md) | 3 | `"nerv-dashboard"`, session keys |
| [nerv_mcp](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/nerv_mcp) | ~80 | Entire file — rename to `hecate_mcp` |
| [dashboard_mcp_brief.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard_mcp_brief.md) | 0 | ✅ Already clean — no NERV refs |
| Code comments in `lib/workflow/*.ts` | 5 | Banner comments: `// NERV.OS Workflow V2` |
| Comment in `stores/useChatStore.ts` | 1 | `// Single source of truth for ALL chat state in NERV.OS` |

---

### Phase 2: 🟢 UI Branding Strings (LOW RISK — Cosmetic Only)

Display text visible to users. Zero functional impact.

#### Files:
| File | Line(s) | Current | New |
|------|---------|---------|-----|
| [layout.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/layout.tsx) | 21 | `title: "NERV.OS"` | `title: "Hecate"` |
| [TopLeftBrand.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/navigation/TopLeftBrand.tsx) | 10 | `NERV` | `HECATE` |
| [LandingClient.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/landing/LandingClient.tsx) | 16,23,37,44,106,364 | Multiple `NERV.OS` marketing copy | `Hecate` equivalents |
| [login/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/(auth)/login/page.tsx) | 83,109,148 | `NERV.OS`, `operator@nerv.os`, `Launching NERV.OS...` | Hecate equivalents |
| [signup/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/(auth)/signup/page.tsx) | 84,126 | `NERV.OS`, `operator@nerv.os` | Hecate equivalents |
| [onboarding/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/onboarding/route.ts) | 34 | `'Welcome to NERV.OS'` | `'Welcome to Hecate'` |
| [handshake/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/agents/handshake/route.ts) | 132 | `"NERV.OS Tools Handshake"` | `"Hecate Tools Handshake"` |
| [FileList.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/FileList.tsx) | 103 | `NERV.OS` watermark | `HECATE` |
| [CompanionEditor.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/CompanionEditor.tsx) | 240,421 | `"Stored in NERV.OS"` | `"Stored in Hecate"` |
| [CoreFilesPanel.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/CoreFilesPanel.tsx) | 181 | `"your NERV.OS dashboard"` | `"your Hecate dashboard"` |
| [useConstellationStore.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/store/useConstellationStore.ts) | 134 | `subtitle: 'NERV. Center'` | `subtitle: 'Hecate Center'` |

---

### Phase 3: 🟢 Dev Tools & Test Scripts (LOW RISK — Debug Only)

These are developer-facing debug scripts. They don't affect production.

#### Files:
| File | Lines | What to change |
|------|-------|---------------|
| [tools/check_dashboard_access.js](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/tools/check_dashboard_access.js) | 4,20,30 | `nerv-dashboard-handshake-test`, `id: 'nerv-dashboard'` |
| [tools/check_ws_gateway.js](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/tools/check_ws_gateway.js) | 9,10,49,59 | `nerv-handshake-1`, `nerv-new-token-12345`, `nerv-list-agents` |
| [tools/debug_scopes.js](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/tools/debug_scopes.js) | 4,5 | `nerv-debug-scopes`, `nerv-new-token-12345` |
| [tools/upload_vercel_env.js](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/tools/upload_vercel_env.js) | 4 | Path string `NERV.OS` |

---

### Phase 4: 🟢 localStorage / sessionStorage Keys (LOW RISK)

Renaming these means users lose saved preferences on first visit. No data loss — all persistence is in Supabase.

#### Keys and their locations:

| Key | Files | Usage Count |
|-----|-------|-------------|
| `nerv_active_agent` | `chat/page.tsx`, `AgentShowcase.tsx` | 3 |
| `nerv_active_conversation` | `chat/page.tsx` | 3 |
| `nerv_active_project` | `useProjectStore.ts`, `ProjectPanel.tsx` | 5 |
| `nerv_companion_models` | `useOpenClawModelStore.ts` | 4 |
| `nerv_installed_skills` | `useOpenClawCapabilitiesStore.ts` | 5 |
| `nerv_escalation_topic` | `chat/page.tsx`, `summit/page.tsx` | 3 |
| `nerv_vignette_settings` | `useVignetteStore.ts` | 1 |
| `nerv_agent_icon_${agentId}` | `AgentIconSelector.tsx` | 2 |
| `nerv_openclaw_device_keypair` | `openclawGateway.ts` | 1 |
| `nerv_openclaw_device_id` | `openclawGateway.ts` | 1 |
| `nervos-theme` | `useThemeStore.ts` | 2 |
| `nerv-preset-store` | `usePresetStore.ts` | 1 |
| `nerv-sessions-list` | `useSocket.ts` | 1 |
| `nerv-scheduled-task` | `useSchedulerStore.ts` | 1 |

> [!WARNING]
> `nerv_openclaw_device_keypair` and `nerv_openclaw_device_id` store cryptographic device keys. Renaming these keys will force a re-registration of the device with OpenClaw. This is safe but users will need to re-authenticate their device.

---

### Phase 5: 🟢 DOM Element IDs (LOW RISK)

Only 2, both for selection quote popups:
- `nerv-selection-quote` → [chat/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/chat/page.tsx) (line 407, 1620+)
- `nerv-summit-selection-quote` → [summit/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/summit/page.tsx) (line 497, 1502)

---

### Phase 6: 🟡 CSS Design System — globals.css (MEDIUM RISK — HIGH VOLUME)

This is the **highest volume** change (~194 lines in one file) but is a pure, mechanical find-and-replace. Must be done atomically with Phase 7.

#### CSS Custom Properties (~50 variables)
Defined in [globals.css](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/globals.css):
```
--nerv-cyan, --nerv-cyan-dim, --nerv-cyan-glow, --nerv-cyan-muted
--nerv-violet, --nerv-violet-dim, --nerv-violet-glow
--nerv-warn, --nerv-warn-dim
--nerv-danger, --nerv-danger-dim
--nerv-success, --nerv-success-dim
--nerv-surface-0, --nerv-surface-2, --nerv-surface-3, --nerv-surface-4
--nerv-border-subtle, --nerv-border-default, --nerv-border-strong
--nerv-text-primary, --nerv-text-secondary, --nerv-text-tertiary, --nerv-text-ghost
```

Plus Tailwind v4 bridge mappings:
```
--color-nerv-cyan, --color-nerv-violet, --color-nerv-warn, etc.
```

#### CSS Utility Classes (~30 class definitions)
```css
.nerv-caption, .nerv-body, .nerv-body-sm, .nerv-section, .nerv-h2
.nerv-mono, .nerv-mono-sm, .nerv-metric-md, .nerv-section-prominent
.nerv-glass-1, .nerv-glass-2, .nerv-glass-3
.nerv-shell-frame, .nerv-shell-frame__svg, .nerv-shell-frame__fill, .nerv-shell-frame__path, .nerv-shell-frame__content
.nerv-top-left, .nerv-top-right, .nerv-top-rail, .nerv-rail-items, .nerv-rail-item, .nerv-rail-item--active
.nerv-dock-pill, .nerv-dock-btn, .nerv-dock-btn--active, .nerv-dock-btn--blooming
.nerv-dock-stack, .nerv-dock-anchor
.nerv-bloom-rail, .nerv-bloom-label, .nerv-bloom-items, .nerv-bloom-tile, .nerv-bloom-tile--active, .nerv-bloom-tile__icon, .nerv-bloom-tile__label
.nerv-chat-bubble-enter, .nerv-shimmer-text
.nerv-avatar-btn, .nerv-user-dropdown, .nerv-dropdown-item
.nerv-badge-text
```

#### CSS Keyframe Animations (~12)
```css
@keyframes nerv-orbit-cw, nerv-orbit-ccw, nerv-core-pulse
@keyframes nerv-text-fade, nerv-chat-slide-in, nerv-shimmer
@keyframes nerv-hud-breathe, nerv-dropdown-in
@keyframes nervProcessingGlow, nervShimmerText
@keyframes nervDot1, nervDot2, nervDot3
```

---

### Phase 7: 🟡 CSS Token & Class Usages in Components (MEDIUM RISK — MUST BE ATOMIC WITH PHASE 6)

> [!IMPORTANT]
> **Phase 6 and Phase 7 MUST be done together** in a single commit. If you rename the CSS definitions but not the usages (or vice versa), all styling breaks.

#### Files consuming CSS tokens (by category):

**CSS Variable References** (`var(--nerv-*)`) — ~350+ usages across ~40 files:

| File | Approx. Lines |
|------|--------------|
| `chat/page.tsx` | ~30 |
| `summit/page.tsx` | ~25 |
| `TaskCardModal.tsx` | ~20 |
| `OutputAdaptationBar.tsx` | ~15 |
| `TimelineScrubber.tsx` | ~12 |
| `NextBestActionChip.tsx` | ~8 |
| `ProjectPanel.tsx` | ~8 |
| `StrategyModeSwitcher.tsx` | ~3 |
| `QuotedReplyBanner.tsx` | ~2 |
| `SessionConfigDropdowns.tsx` | ~3 |
| `ThinkingFastToggles.tsx` | ~3 |
| `AgentCarousel.tsx` | ~1 comment |
| `SchedulerHeader.tsx` | ~5 |
| `SchedulerTimeline.tsx` | ~4 |
| `TaskCard.tsx` | ~8 |
| `TaskCardTray.tsx` | ~8 |
| `SystemHealthBar.tsx` | ~4 |
| ...and more across remaining component files |

**CSS Class References** (`.nerv-*`) — ~100+ usages:

| File | Classes Used |
|------|-------------|
| `navigation/ShellFrame.tsx` | `nerv-shell-frame`, `__svg`, `__fill`, `__path`, `__content` |
| `navigation/BottomDock.tsx` | `nerv-dock-pill`, `nerv-dock-btn`, `nerv-dock-btn--active`, `nerv-dock-btn--blooming`, `nerv-dock-stack`, `nerv-dock-anchor`, `nerv-bloom-*` |
| `navigation/TopRail.tsx` | `nerv-top-rail`, `nerv-rail-items`, `nerv-rail-item`, `nerv-rail-item--active` |
| `navigation/TopLeftBrand.tsx` | `nerv-top-left` |
| `navigation/TopRightUserMenu.tsx` | `nerv-avatar-btn`, `nerv-user-dropdown`, `nerv-dropdown-item` |
| `chat/page.tsx` | `nerv-chat-bubble-enter` |
| `summit/page.tsx` | `nerv-chat-bubble-enter` |
| `scheduler/SchedulerHeader.tsx` | `nerv-glass-1`, `nerv-glass-2`, `nerv-h2`, `nerv-body-sm` |
| `scheduler/TaskCardTray.tsx` | `nerv-glass-1`, `nerv-body`, `nerv-caption`, `nerv-badge-text`, `nerv-section-prominent` |
| `scheduler/TaskCard.tsx` | `nerv-glass-3`, `nerv-body-sm`, `nerv-caption`, `nerv-mono-sm`, `nerv-body` |
| `SystemHealthBar.tsx` | `nerv-caption` |
| `SchedulerTimeline.tsx` | `nerv-section`, `nerv-caption`, `nerv-body-sm` |
| `workflow-builder/ExecutionLog.tsx` | `nerv-mono` |
| Agent showcase modals (`HeroGalleryModal`, `HeroCropModal`, `BackgroundCropModal`, `VignetteTuningModal`) | `nerv-glass-3` |
| `SessionConfigDropdowns.tsx` | `nerv-glass-3` |

---

### Phase 8: 🟡 Dashboard MCP Server (MEDIUM RISK — Functional)

The newly added `dashboard-mcp/` package contains significant NERV references that affect tool naming and server identity.

#### Files:
| File | Line(s) | What to change |
|------|---------|---------------|
| [dashboard-mcp/package.json](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard-mcp/package.json) | 2,4,8 | `"@nervos/dashboard-mcp"` → `"@hecate/dashboard-mcp"`, description, `"nerv-mcp"` bin entry → `"hecate-mcp"` |
| [dashboard-mcp/src/config.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard-mcp/src/config.ts) | 3,6,15,16,21,24 | `TOOL_PREFIX = "nerv"` → `"hecate"`, `NERV_USER_ID` → `HECATE_USER_ID`, `SERVER_NAME = "nerv-dashboard"` → `"hecate-dashboard"`, description text |
| [dashboard-mcp/src/index.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard-mcp/src/index.ts) | 2 | Banner comment |
| [dashboard-mcp/README.md](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard-mcp/README.md) | 1,3,63,65,69,111,115 | All "NERV.OS" references, config examples, env vars |
| [dashboard-mcp/package-lock.json](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard-mcp/package-lock.json) | 2,8,17 | Auto-updates when you rebuild — **do not manually edit** |

> [!WARNING]
> Changing `TOOL_PREFIX` from `"nerv"` to `"hecate"` will rename **all 70+ MCP tools** (e.g., `nerv_tasks_list` → `hecate_tasks_list`). Any OpenClaw agent configs referencing the old tool names will need updating. This is by design — the config was built to be a single-line change.

---

### Phase 9: 🟡 OpenClaw Gateway Client Identity (MEDIUM RISK)

The dashboard identifies itself to the OpenClaw backend.

#### Files:
| File | Line(s) | Current | New |
|------|---------|---------|-----|
| [openclawGateway.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/openclawGateway.ts) | 20,41 | `clientId: "nerv-dashboard"` | `clientId: "hecate-dashboard"` |
| [openclawGateway.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/openclawGateway.ts) | 486 | `userAgent: "nerv-dashboard/0.1.0"` | `userAgent: "hecate-dashboard/0.1.0"` |
| [openclaw-adapter.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/workflow/adapters/openclaw-adapter.ts) | 212 | `userAgent: "nerv-workflow/0.1.0"` | `userAgent: "hecate-workflow/0.1.0"` |
| [agentZeroProxy.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/agentZeroProxy.ts) | 222 | `context_id: 'nerv-health-${Date.now()}'` | `context_id: 'hecate-health-${Date.now()}'` |
| [useSocket.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/useSocket.ts) | 1271 | `'Emergency shutdown triggered from NERV.OS'` | `'Emergency shutdown triggered from Hecate'` |
| [skill-fetch/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/skill-fetch/route.ts) | 91,107,339 | `'User-Agent': 'NERV-OS-Dashboard/1.0'` | `'User-Agent': 'Hecate-Dashboard/1.0'` |

> [!NOTE]
> If your OpenClaw backend logs, filters, or authorizes based on client ID `"nerv-dashboard"`, changing this requires a corresponding backend update. If the backend doesn't enforce the value, it's safe to change.

---

### Phase 10: 🟡 Supabase Storage Bucket (MEDIUM-HIGH RISK)

The code references a Supabase storage bucket named `nerv-images`.

#### Files:
| File | Line(s) | Reference |
|------|---------|-----------|
| [supabaseStorage.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/supabaseStorage.ts) | 3,64,68 | `const BUCKET = 'nerv-images'`, regex pattern matching |
| [api/storage/sync/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/storage/sync/route.ts) | 7 | `const BUCKET = 'nerv-images'` |

> [!CAUTION]
> The bucket `nerv-images` exists in your Supabase project and contains uploaded agent hero images, backgrounds, and other assets. You have two options:
> 1. **Keep the bucket name as-is** — just rename the code constant (NOT recommended, creates a naming inconsistency)
> 2. **Create a new `hecate-images` bucket**, copy all files from `nerv-images`, update code, then delete old bucket — **recommended but requires a migration step**

---

### Phase 11: 🔴 Environment Variables & Encryption (CRITICAL — DO LAST)

These are the **true danger zones**. Must be handled with extreme care.

#### Files:
| File | Line(s) | Reference |
|------|---------|-----------|
| [encryption.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/encryption.ts) | 5,7,8 | `process.env.NERV_ENCRYPTION_KEY`, fallback: `'nerv-os-default-key-change-me'` |
| [crypto.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/providers/crypto.ts) | 11,14 | `process.env.NERV_ENCRYPTION_KEY`, salt: `'nerv-os-provider-salt'`, fallback: `'nerv-dev-key-do-not-use-in-prod'` |

> [!CAUTION]
> **ENCRYPTION SALT STRATEGY — CRITICAL DECISION**:
> - ✅ **SAFE**: Rename `NERV_ENCRYPTION_KEY` → `HECATE_ENCRYPTION_KEY` in code + `.env.local` + Vercel env vars
> - ⚠️ **KEEP THE SALT VALUES UNCHANGED**: `'nerv-os-default-key-change-me'` and `'nerv-os-provider-salt'` — these are used to derive encryption keys for data already stored in Supabase
> - ❌ **DANGEROUS**: If you change the salt strings, any data currently encrypted in Supabase (`connection_secrets`, `connection_profiles`) becomes **permanently undecryptable** unless you write a re-encryption migration

---

### Phase 12: 🟢 Component/File Renames (LOW RISK — Optional)

| Current File | New Name | Impact |
|-------------|----------|--------|
| `components/NervSkeleton.tsx` | `components/HecateSkeleton.tsx` | Interface `NervSkeletonProps` → `HecateSkeletonProps`, export `NervSkeleton` → `HecateSkeleton`. Need to update all import sites. |

---

### Phase 13: 🟡 External Services (AFTER ALL CODE CHANGES)

#### GitHub Repository
- Currently: `gilanggemar/NERV`
- Rename on GitHub → redirects old URLs automatically
- Update Vercel Git integration to point to new repo name

#### Vercel Deployment
- Currently: `nerv-one.vercel.app`
- Update project name in Vercel Dashboard → Settings
- Update `NERV_ENCRYPTION_KEY` → `HECATE_ENCRYPTION_KEY` in Vercel env vars

#### Supabase
- ✅ **No NERV references in database schema**
- Project label in Supabase dashboard can be renamed (cosmetic only)
- Storage bucket `nerv-images` — see Phase 10

---

## What Will NOT Break

1. **Supabase database** — Zero NERV references in schema
2. **API routes** — All use generic paths (`/api/chat`, `/api/agents`)
3. **Next.js routing** — No NERV-prefixed routes
4. **Authentication** — Supabase auth is name-agnostic
5. **WebSocket connections** — URL-based, not name-based
6. **Build system** — `package.json` name is just `"dashboard"`
7. **Middleware** — No NERV references

---

## Changes Since Previous Analysis

The following items are **NEW** since the last analysis (2026-04-11):

| Category | New Items |
|----------|-----------|
| **dashboard-mcp package** (entirely new) | `package.json`, `config.ts`, `index.ts`, `README.md` — `@nervos/dashboard-mcp`, `TOOL_PREFIX = "nerv"`, `NERV_USER_ID`, `SERVER_NAME = "nerv-dashboard"` |
| **New localStorage keys** | `nerv_vignette_settings` (useVignetteStore), `nerv_agent_icon_${agentId}` (AgentIconSelector), `nerv_openclaw_device_keypair` / `nerv_openclaw_device_id` (openclawGateway) |
| **Supabase storage bucket** | `nerv-images` referenced in `supabaseStorage.ts` and `api/storage/sync/route.ts` |
| **New API references** | `skill-fetch/route.ts` User-Agent: `NERV-OS-Dashboard/1.0` |
| **New workflow references** | `openclaw-adapter.ts` userAgent: `nerv-workflow/0.1.0` |
| **New useSocket reference** | `nerv-sessions-list` constant, emergency shutdown message |
| **Removed from previous analysis** | `AppSidebar.tsx`, `DashboardSidebar.tsx`, `ChatHistorySidebar.tsx`, `MessageRenderer.tsx`, `HandoffPacketModal.tsx`, `MissionBar.tsx`, `ContextControlDrawer.tsx`, `api/settings/secrets/route.ts`, `api/openclaw/events/route.ts`, `.env.local` — these no longer contain NERV references |

---

## Estimated Total Changes

| Category | Count |
|----------|-------|
| CSS variable/class/keyframe definitions (globals.css) | ~194 lines |
| CSS variable usages in components | ~350+ lines |
| CSS class usages in components | ~100+ lines |
| localStorage/sessionStorage keys | ~14 unique keys, ~33 usage sites |
| DOM element IDs | 2 IDs, 4 usage sites |
| Environment variable references | 2 files, 4 refs |
| Supabase storage bucket | 2 files, 3 refs |
| Dashboard MCP server | 4 files, ~20 lines |
| OpenClaw client identity | 4 files, ~8 refs |
| Branding/display strings | ~12 files, ~20 refs |
| Code comments | ~10 lines |
| Documentation files | ~6 files, ~20 lines |
| Dev tools scripts | 3 files, ~10 refs |
| Component/file renames | 1 file |
| **Total estimated changes** | **~750+ individual edits across ~80+ files** |

> [!NOTE]
> Despite the large volume, this is fundamentally a **mechanical find-and-replace operation** executed progressively. The app architecture has no deep coupling to the name "NERV" — it's purely a naming convention consistently used throughout. The progressive strategy ensures each phase can be tested independently before moving to the next.
