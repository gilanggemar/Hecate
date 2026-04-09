# 🔍 NERV.OS → [NEW NAME] — Rename Impact Analysis

## TL;DR Verdict

> [!IMPORTANT]
> **Renaming will NOT break your app's core functionality** — but only if done correctly. The vast majority of "NERV" references are **cosmetic** (display text, CSS class names, comments). There are a small number of **functional** references that must be renamed atomically, but none of them are coupled to the name "NERV" in a way that would cause runtime failures if changed.

The key insight: **nothing in your database, routing, or API contracts depends on the string "NERV"**. Your Supabase tables have generic names (`agents`, `conversations`, `workflows`, etc.), your API routes are generic (`/api/agents/`, `/api/chat/`), and your Next.js routing has no NERV-prefixed paths.

---

## Risk Matrix

| Layer | Risk Level | # of Refs | Breaks if Missed? | Notes |
|-------|-----------|-----------|-------------------|-------|
| CSS Design System (variables) | 🟡 Medium | ~50+ vars | Yes — styling breaks | `--nerv-cyan`, `--nerv-surface-3`, etc. |
| CSS Utility Classes | 🟡 Medium | ~100+ uses | Yes — styling breaks | `.nerv-caption`, `.nerv-glass-3`, `.nerv-dock-btn` |
| CSS Animations/Keyframes | 🟡 Medium | ~15 | Yes — animations break | `@keyframes nerv-shimmer`, `nerv-chat-slide-in` |
| localStorage/sessionStorage keys | 🟢 Low | ~12 keys | No — old keys just orphaned | `nerv_active_agent`, `nervos-theme`, etc. |
| DOM Element IDs | 🟢 Low | 2 | No — only used internally | `nerv-selection-quote`, `nerv-summit-selection-quote` |
| Environment Variables | 🔴 High | 1 critical | **Yes — encryption breaks** | `NERV_ENCRYPTION_KEY` |
| Encryption Fallback Strings | 🔴 High | 2 | **Yes — decryption breaks** | `nerv-os-default-key-change-me`, `nerv-os-provider-salt` |
| OpenClaw Gateway Client ID | 🟡 Medium | 3 | Depends on backend | `nerv-dashboard` as client identifier |
| Branding/Display Strings | 🟢 Low | ~25 | No — cosmetic only | "NERV.OS", "NERV", "Welcome to NERV.OS" |
| Code Comments | 🟢 Low | ~20 | No | Just documentation |
| GitHub Repo Name | 🟡 Medium | External | Vercel redeploy needed | `gilanggemar/NERV` |
| Vercel Project | 🟡 Medium | External | Domain/URL changes | `nerv-one.vercel.app` |
| Documentation (`.md` files) | 🟢 Low | ~30+ | No | MAINTENANCE.md, USER_GUIDE.md, etc. |

---

## Layer-by-Layer Breakdown

### 1. 🔴 CRITICAL: Environment Variables & Encryption

These are the **only true danger zones**. If you rename the env var and forget to update consumers, encryption/decryption will silently fail.

#### Files affected:
- [encryption.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/encryption.ts)
  - `process.env.NERV_ENCRYPTION_KEY` (line 7)
  - Fallback salt: `'nerv-os-default-key-change-me'` (line 8)
- [crypto.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/providers/crypto.ts)
  - `process.env.NERV_ENCRYPTION_KEY` (line 14)
  - Fallback key: `'nerv-dev-key-do-not-use-in-prod'` (line 14)
  - Static salt: `'nerv-os-provider-salt'` (line 11)
- [.env.local](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/.env.local) — `NERV_ENCRYPTION_KEY` (line 32)

> [!CAUTION]
> **If you change the salt strings**, any data currently encrypted in Supabase (`connection_secrets`, `connection_profiles`) will become **permanently undecryptable**. You must either:
> 1. Keep the old salt values (just rename the env var)
> 2. Write a migration script to re-encrypt all existing data with the new salt

---

### 2. 🟡 CSS Design System — Variables & Classes

This is the **highest volume** of changes but **lowest risk** because it's a pure find-and-replace within a single ecosystem (`globals.css` → components).

#### CSS Custom Properties (~50 variables)
All defined in [globals.css](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/globals.css):
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

#### CSS Utility Classes (~15 classes, ~100+ usages)
```css
.nerv-caption, .nerv-body, .nerv-body-sm, .nerv-section, .nerv-h2
.nerv-mono, .nerv-mono-sm, .nerv-metric-md, .nerv-section-prominent
.nerv-glass-1, .nerv-glass-2, .nerv-glass-3
.nerv-shell-frame, .nerv-shell-frame__svg, .nerv-shell-frame__fill, .nerv-shell-frame__path, .nerv-shell-frame__content
.nerv-top-left, .nerv-top-right, .nerv-top-rail
.nerv-dock-pill, .nerv-dock-btn, .nerv-dock-btn--active, .nerv-dock-btn--blooming
.nerv-dock-stack, .nerv-dock-anchor
.nerv-chat-bubble-enter, .nerv-shimmer-text
```

#### CSS Keyframe Animations (~12)
```css
@keyframes nerv-orbit-cw, nerv-orbit-ccw, nerv-core-pulse
@keyframes nerv-text-fade, nerv-chat-slide-in, nerv-shimmer
@keyframes nerv-hud-breathe, nerv-dropdown-in
@keyframes nervProcessingGlow, nervShimmerText
@keyframes nervDot1, nervDot2, nervDot3
```

#### Files consuming these CSS tokens:
> ~50+ component files across `components/`, `app/chat/`, `app/summit/`, `store/`

---

### 3. 🟢 localStorage / sessionStorage Keys

These are **safe to rename** — the worst case is that users lose their previously saved preferences on the first visit after the rename. No data loss (all persisted data is in Supabase).

| Key | File | Purpose |
|-----|------|---------|
| `nerv_active_agent` | chat/page.tsx, AgentShowcase.tsx | Remembers selected agent |
| `nerv_active_conversation` | chat/page.tsx | Remembers active chat |
| `nerv_active_project` | useProjectStore.ts, ProjectPanel.tsx | Remembers active project |
| `nerv_companion_models` | useOpenClawModelStore.ts | Caches companion model list |
| `nerv_installed_skills` | useOpenClawCapabilitiesStore.ts | Caches installed skills |
| `nerv_escalation_topic` | chat/page.tsx, summit/page.tsx | Session-scoped escalation |
| `nervos-theme` | useThemeStore.ts | Theme preference |

---

### 4. 🟢 DOM Element IDs

Only 2, both for the selection quote popup:
- `nerv-selection-quote` → [chat/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/chat/page.tsx#L407)
- `nerv-summit-selection-quote` → [summit/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/summit/page.tsx#L497)

---

### 5. 🟡 OpenClaw Gateway Client Identity

The dashboard identifies itself to the backend as `nerv-dashboard`:

- [openclawGateway.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/lib/openclawGateway.ts) (lines 20, 41, 486):
  - `clientId: "nerv-dashboard"`
  - `userAgent: "nerv-dashboard/0.1.0"`
- [check_dashboard_access.js](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/tools/check_dashboard_access.js):
  - `'nerv-dashboard-handshake-test'`
  - `id: 'nerv-dashboard'`

> [!WARNING]
> If your OpenClaw backend logs, filters, or authorizes based on client ID `"nerv-dashboard"`, changing this will require a corresponding backend update. If it doesn't care about the client ID value (just uses it for logging), it's safe to change.

---

### 6. 🟢 Branding / Display Strings

Pure UI text — no functional impact. All the places where users see "NERV":

| Location | What it says |
|----------|-------------|
| [layout.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/layout.tsx#L21) | `title: "NERV.OS"` (page title / SEO) |
| [TopLeftBrand.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/navigation/TopLeftBrand.tsx#L10) | `NERV` (header logo text) |
| [LandingClient.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/landing/LandingClient.tsx#L106) | `NERV<span>.OS</span>` (hero badge) |
| [LandingClient.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/landing/LandingClient.tsx#L16) | Multiple marketing copy mentions |
| [AppSidebar.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/AppSidebar.tsx#L55) | `NERV.OS` (sidebar header) |
| [AppSidebar.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/AppSidebar.tsx#L131) | `NERV-001 · v4.0.0` (version string) |
| [DashboardSidebar.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/components/DashboardSidebar.tsx#L109) | `name: "NERV.OS"` |
| [login/page.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/(auth)/login/page.tsx#L148) | `'Launching NERV.OS...'` |
| [onboarding/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/onboarding/route.ts#L34) | `'Welcome to NERV.OS'` |
| [handshake/route.ts](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/api/agents/handshake/route.ts#L132) | `"NERV.OS Tools Handshake"` |
| [FileList.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/FileList.tsx#L103) | `NERV.OS` watermark |
| [CompanionEditor.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/CompanionEditor.tsx) | `"Stored in NERV.OS"` |
| [CoreFilesPanel.tsx](file:///d:/AI%20Model/2-Antigravity%20Projects/NERV.OS/dashboard/app/dashboard/capabilities/_components/CoreFilesPanel.tsx#L181) | `"your NERV.OS dashboard"` |

---

### 7. 🟡 External Services

#### GitHub Repository
- Currently: `gilanggemar/NERV`
- Renaming the repo on GitHub will change the remote URL
- GitHub auto-redirects old URLs, so existing clones continue to work
- But Vercel's Git integration needs to be pointed at the new repo name

#### Vercel Deployment
- Currently hosted at: `nerv-one.vercel.app`
- The Vercel project name can be updated in Vercel Dashboard → Settings
- If you have a custom domain, the Vercel subdomain doesn't matter

#### Supabase
- ✅ **No NERV references in the database schema** — all table names are generic
- ✅ No stored procedures, functions, or triggers reference "NERV"
- The project itself in Supabase dashboard might be named "NERV" but that's just a label

---

### 8. 🟢 Component & File Names

| File | Rename? |
|------|---------|
| `NervSkeleton.tsx` | Optional — component name, no functional impact |
| `NervSkeleton` (interface/export) | Would need import updates if renamed |
| `components/logo.tsx` | Already generic — no NERV reference |

---

### 9. 🟢 Documentation Files

These are purely informational:
- `docs/MAINTENANCE.md` — ~5 mentions
- `docs/USER_GUIDE.md` — ~3 mentions  
- `docs/Chat_Features_Deep_Analysis.md` — ~4 mentions
- `PRODUCTION_READINESS_AUDIT.md` — ~15 mentions
- `dashboard/README.md` — likely mentions

---

## What Will NOT Break

1. **Supabase database** — Zero NERV references in schema
2. **API routes** — All use generic paths (`/api/chat`, `/api/agents`)
3. **Next.js routing** — No NERV-prefixed routes
4. **Authentication** — Supabase auth is name-agnostic
5. **WebSocket connections** — URL-based, not name-based
6. **Build system** — `package.json` name is just `"dashboard"`

---

## Recommended Execution Strategy

> [!TIP]
> This can be done safely as a **single atomic commit** with a global find-and-replace, executed in this order:

### Phase 1: Decide on internal prefix
Pick a new internal prefix for CSS variables, classes, animations, and storage keys. For example, if the new name is "AEON", you'd use:
- CSS vars: `--aeon-cyan` instead of `--nerv-cyan`
- Classes: `.aeon-caption` instead of `.nerv-caption`
- Storage: `aeon_active_agent` instead of `nerv_active_agent`

### Phase 2: Core changes (in order)
1. **globals.css** — Rename all `--nerv-*` variables and `.nerv-*` classes and `nerv-*` keyframes
2. **All components** — Update all CSS variable references (`var(--nerv-*)`) and class names
3. **localStorage keys** — Update all `nerv_*` storage keys
4. **Environment variable** — Rename `NERV_ENCRYPTION_KEY` → `[NEW]_ENCRYPTION_KEY` in code AND `.env.local` AND Vercel
5. **Keep encryption salts unchanged** — Do NOT change `nerv-os-default-key-change-me` or `nerv-os-provider-salt` to avoid breaking existing encrypted data
6. **Update branding strings** — Replace all display text
7. **Update OpenClaw client ID** — If backend doesn't enforce it

### Phase 3: External services
1. Rename GitHub repo
2. Update Vercel project name
3. Update Supabase project label (optional, dashboard-only)
4. Update documentation

### Phase 4: Verify
1. `npm run build` — catch any broken CSS class or variable references
2. Test encryption/decryption with existing data
3. Verify Vercel deployment connects to GitHub
4. Test OpenClaw WebSocket handshake

---

## Estimated Total Changes

| Category | Approximate Count |
|----------|------------------|
| CSS variable definitions | ~50 |
| CSS class definitions | ~30 |
| CSS keyframe definitions | ~15 |
| CSS variable usages in components | ~300+ |
| CSS class usages in components | ~150+ |
| localStorage/sessionStorage keys | ~12 unique keys, ~26 usage sites |
| DOM element IDs | 2 |
| Environment variable references | 3 files |
| Branding/display strings | ~25 |
| Code comments | ~20 |
| Documentation files | 5 |
| **Total estimated changes** | **~600+ individual edits across ~70+ files** |

> [!NOTE]
> Despite the large number of changes, this is fundamentally a **mechanical find-and-replace operation**. The app architecture has no deep coupling to the name "NERV" — it's purely a naming convention used consistently throughout.
