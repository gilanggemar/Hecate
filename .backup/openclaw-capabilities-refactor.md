# NERV.OS — OpenClaw Capabilities Page: Full Refactor Instruction

**Target**: Replace the existing `2.6 Capabilities System (MCPs, Skills, and Composio)` with a new OpenClaw-native Capabilities page that reads from and writes to a real, connected OpenClaw Gateway instance over WebSocket.

**Date**: March 21, 2026

---

## 0. Context You Must Understand Before Coding

### 0.1. What is OpenClaw?

OpenClaw is a local-first AI agent framework. It runs a **Gateway** process (default `ws://127.0.0.1:18789`) that acts as the single control plane. The Gateway exposes a WebSocket-based RPC protocol. All clients — the official CLI, the official Control UI, mobile apps, and **our custom NERV.OS dashboard** — can connect to this same Gateway WS and issue RPC calls.

### 0.2. Tools vs Skills — Critical Distinction

OpenClaw has **two separate capability layers**. They are NOT the same thing:

1. **Tools** = typed callable functions the agent can invoke at runtime (e.g., `exec`, `browser`, `web_search`, `read`, `write`, `message`, `canvas`, `cron`, etc.). These are low-level building blocks. Tools are controlled via `tools.allow` / `tools.deny` arrays in the config, with `tools.profile` presets (`full`, `coding`, `messaging`, `minimal`). Per-agent override: `agents.list[].tools.profile`, `agents.list[].tools.allow`, `agents.list[].tools.deny`.

2. **Skills** = `SKILL.md` prompt bundles that teach the agent *how* and *when* to use tools. Skills are higher-level, user-facing capabilities (e.g., `nano-banana-pro` for image generation, `github` for GitHub operations, `peekaboo` for screen capture). Skills are controlled via `skills.entries.<skillKey>.enabled` (boolean) in the config. The `skills.allowBundled` array optionally restricts which bundled skills are eligible.

### 0.3. Global vs Per-Agent — How OpenClaw Scopes Config

**Global scope:**
- `tools.allow` / `tools.deny` / `tools.profile` — applies to all agents unless overridden.
- `skills.entries.<skillKey>.enabled` — enables/disables a skill globally.
- `skills.allowBundled` — restricts which bundled skills are eligible (global).

**Per-agent scope:**
- `agents.list[<index>].tools.profile` — overrides the global tool profile for this specific agent.
- `agents.list[<index>].tools.allow` — overrides the global tool allowlist for this specific agent.
- `agents.list[<index>].tools.deny` — overrides the global tool denylist for this specific agent.
- For skills: `skills.entries.<skillKey>` supports an `agents` field (array of agent IDs). When `agents` is set on a skill entry, that skill is only loaded for those agent IDs. Omitting `agents` means the skill is available to all agents.

### 0.4. Gateway WS RPC Methods We Will Use

All communication with the OpenClaw Gateway happens via WebSocket JSON frames. The protocol uses `{ type: "req", id: "<uuid>", method: "<rpc_method>", params: {...} }` request frames and responds with `{ type: "res", id: "<uuid>", payload: {...} }`.

| RPC Method | Purpose | Scope |
|---|---|---|
| `skills.status` | Returns all skills with their eligibility, enabled state, and missing requirements. Accepts optional `agentId`. | Read |
| `skills.update` | Patches a skill entry: `{ skillKey, enabled, apiKey, env }`. This writes to `skills.entries.<skillKey>` in `openclaw.json`. **No `agentId` param** — this is a global toggle. | Write (Global) |
| `tools.catalog` | Returns the runtime tool catalog for an agent (grouped tools with provenance metadata). Requires `operator.read` scope. | Read |
| `config.get` | Returns the full current config (as JSON) plus a `hash` for optimistic concurrency. | Read |
| `config.patch` | Merges a partial JSON update into the existing config using JSON merge-patch semantics. Requires `baseHash` from `config.get`. Objects merge recursively, `null` deletes a key, arrays replace. | Write |
| `config.set` | Sets a single config key by dot-path. | Write |

**Important**: `skills.update` is global-only (no `agentId`). For per-agent skill scoping, we must use `config.patch` to update the `skills.entries.<skillKey>.agents` array. For per-agent tool toggles, we must use `config.patch` to update `agents.list[<index>].tools.allow` / `agents.list[<index>].tools.deny`.

### 0.5. Hot Reload Behavior

Config changes to `tools`, `skills`, and `agents` hot-apply **without a Gateway restart**. Skill changes are picked up on the next agent turn when the watcher is enabled. Tool policy changes take effect on new sessions immediately and can refresh mid-session.

---

## 1. What to Remove

### 1.1. Database Schemas to Drop

Remove the following Drizzle schema tables (and their corresponding migration files):
- `capabilityMcps`
- `capabilitySkills`
- `agentCapabilityAssignments`

These tables stored a local shadow-copy of capabilities. We no longer maintain our own capability state — we read directly from the OpenClaw Gateway.

### 1.2. Zustand Stores to Remove

- `useCapabilitiesStore` — delete entirely.
- `useMCPStore` — delete entirely.

### 1.3. API Routes to Remove

- `/api/capabilities/mcps/*` — all routes under this path.
- `/api/capabilities/skills/*` — all routes under this path.
- `/api/composio/*` — the Composio handshake routes. Composio is no longer part of the capabilities system.

### 1.4. Pages / Components to Remove

- `/dashboard/capabilities/page.tsx` — will be replaced with the new implementation.
- Any components under `components/capabilities/` that reference the old MCP/Composio/local-skills model.

### 1.5. Settings Pages to Remove

- `/settings/mcp-servers/page.tsx` — MCP server management is replaced by the OpenClaw skills/tools system.

---

## 2. New Architecture Overview

### 2.1. Data Flow (No Local Database)

```
NERV.OS Dashboard (Browser)
    │
    ├─ WebSocket ──▶ OpenClaw Gateway (ws://host:18789)
    │                   │
    │                   ├─ skills.status        → read skills
    │                   ├─ tools.catalog         → read tools
    │                   ├─ config.get            → read full config
    │                   ├─ skills.update         → toggle skill globally
    │                   └─ config.patch          → per-agent tool/skill changes
    │
    └─ Zustand Store (in-memory only, no DB persistence)
         └─ useOpenClawCapabilitiesStore
```

There is **no Supabase table** for capabilities anymore. The OpenClaw Gateway is the single source of truth. The Zustand store is a client-side cache that re-fetches from the Gateway on mount and after mutations.

### 2.2. Connection Reuse

NERV.OS already has `useOpenClawStore` and `useConnectionStore` for managing WebSocket connections to OpenClaw. The new capabilities system **must reuse the existing WebSocket connection** managed by `useOpenClawStore` / `useConnectionStore`. Do NOT create a second WebSocket connection.

If the existing OpenClaw WebSocket helpers do not expose a generic `call(method, params)` RPC function, create one as a shared utility:

```typescript
// lib/openclaw/rpc.ts
export async function openClawRPC<T = unknown>(
  ws: WebSocket,
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`RPC timeout: ${method}`)), 15000);
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id && msg.type === "res") {
        clearTimeout(timeout);
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.payload as T);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ type: "req", id, method, params }));
  });
}
```

---

## 3. New Zustand Store: `useOpenClawCapabilitiesStore`

Create a single new store at `stores/useOpenClawCapabilitiesStore.ts`.

### 3.1. Store State Shape

```typescript
interface OpenClawCapabilitiesState {
  // UI State
  activeTab: "per-agent" | "global";
  selectedAgentId: string | null;

  // Data from Gateway
  agents: Array<{ id: string; name?: string; default?: boolean }>;
  globalTools: Array<{
    name: string;
    group?: string;
    description?: string;
    allowed: boolean;      // derived from tools.allow/deny
  }>;
  globalSkills: Array<{
    key: string;
    name: string;
    description?: string;
    enabled: boolean;
    eligible: boolean;     // from skills.status — are requirements met?
    missingRequirements?: string[];
  }>;
  perAgentTools: Record<string, Array<{
    name: string;
    group?: string;
    description?: string;
    allowed: boolean;
  }>>;
  perAgentSkills: Record<string, Array<{
    key: string;
    name: string;
    description?: string;
    enabled: boolean;
    eligible: boolean;
    missingRequirements?: string[];
  }>>;

  // Config hash for optimistic concurrency (from config.get)
  configHash: string | null;

  // Loading & Error
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveTab: (tab: "per-agent" | "global") => void;
  setSelectedAgentId: (id: string | null) => void;
  fetchAll: () => Promise<void>;
  toggleGlobalTool: (toolName: string, allowed: boolean) => Promise<void>;
  toggleGlobalSkill: (skillKey: string, enabled: boolean) => Promise<void>;
  togglePerAgentTool: (agentId: string, toolName: string, allowed: boolean) => Promise<void>;
  togglePerAgentSkill: (agentId: string, skillKey: string, enabled: boolean) => Promise<void>;
}
```

### 3.2. `fetchAll` Implementation Logic

This is the main data-fetching action. It must:

1. Call `config.get` → parse the full config to extract:
   - `agents.list` → populate `agents` array (id, name, default flag).
   - `tools.allow`, `tools.deny`, `tools.profile` → derive `globalTools` allowed state.
   - `skills.entries` → derive `globalSkills` enabled state.
   - Per each agent in `agents.list`: read `agents.list[i].tools.allow`, `agents.list[i].tools.deny`, `agents.list[i].tools.profile` → derive `perAgentTools[agentId]`.
   - Per each agent: read `skills.entries` and check each skill's `agents` array to determine per-agent skill availability.
   - Store `configHash` from `config.get` response's `hash` field.

2. Call `tools.catalog` → get the full list of available tool names, groups, and descriptions. Cross-reference with the allow/deny lists from step 1 to set the `allowed` boolean.

3. Call `skills.status` → get the full list of skills with eligibility info. Cross-reference with `skills.entries` from step 1 to set the `enabled` and `eligible` booleans plus `missingRequirements`.

### 3.3. Toggle Action Implementation Logic

**`toggleGlobalTool(toolName, allowed)`:**
1. Call `config.get` → get fresh `hash` and current `tools.allow` / `tools.deny` arrays.
2. Compute the new `tools.allow` and `tools.deny` arrays:
   - If `allowed = true`: add `toolName` to `tools.allow` (if not present), remove from `tools.deny`.
   - If `allowed = false`: add `toolName` to `tools.deny` (if not present), remove from `tools.allow`.
3. Call `config.patch` with `{ raw: JSON.stringify({ tools: { allow: [...], deny: [...] } }), baseHash: hash }`.
4. Call `fetchAll()` to refresh.

**`toggleGlobalSkill(skillKey, enabled)`:**
1. Call `skills.update` with `{ skillKey, enabled }`. This is the simplest path — OpenClaw has a dedicated RPC for this.
2. Call `fetchAll()` to refresh.

**`togglePerAgentTool(agentId, toolName, allowed)`:**
1. Call `config.get` → get fresh config + hash.
2. Find the agent's index in `agents.list` by `id === agentId`.
3. Read the agent's current `tools.allow` and `tools.deny` arrays.
4. Compute the new arrays (same logic as global toggle).
5. Call `config.patch` with the partial update targeting `agents.list[<index>].tools.allow` and `agents.list[<index>].tools.deny`.
   - Because `config.patch` uses JSON merge-patch (arrays replace, not merge), send the full updated array.
   - The patch shape: `{ raw: JSON.stringify({ agents: { list: [<sparse array or full list with updated entry>] } }), baseHash: hash }`.
   - **IMPORTANT**: JSON merge-patch replaces arrays entirely. You MUST send the complete `agents.list` array with only the target agent's `tools` field modified. Do not send a sparse array — that will delete other agents.
6. Call `fetchAll()` to refresh.

**`togglePerAgentSkill(agentId, skillKey, enabled)`:**
1. Call `config.get` → get fresh config + hash.
2. Read `skills.entries.<skillKey>.agents` array from config.
3. If `enabled = true` for this agent: add `agentId` to the `agents` array (or remove the `agents` field entirely if all agents should have it).
4. If `enabled = false` for this agent: set `agents` to an array of all OTHER agent IDs that should still have access (effectively removing this agent).
5. If the skill should be fully disabled (not just per-agent), use `skills.update` with `enabled: false` instead.
6. Call `config.patch` with `{ raw: JSON.stringify({ skills: { entries: { [skillKey]: { agents: [...] } } } }), baseHash: hash }`.
7. Call `fetchAll()` to refresh.

---

## 4. New API Routes (Next.js Route Handlers)

Create a thin proxy layer. The browser cannot directly open a raw WebSocket to the OpenClaw Gateway due to auth and CORS constraints, so the Next.js backend acts as the RPC bridge.

### 4.1. Route: `POST /api/openclaw/rpc`

This is a **single generic RPC proxy endpoint**. It accepts:

```typescript
// Request body
{
  method: string;       // e.g. "skills.status", "config.get", "config.patch"
  params: Record<string, unknown>;
}
```

Implementation:
1. Read the OpenClaw Gateway WebSocket URL and auth token from the NERV.OS connection profile (from `useConnectionStore` / `connectionProfiles` table, or from environment variables `OPENCLAW_GATEWAY_URL` and `OPENCLAW_GATEWAY_TOKEN`).
2. Open a WebSocket connection to the Gateway (or reuse a server-side singleton).
3. Send the RPC request frame: `{ type: "req", id: uuid, method, params: { ...params, auth: { token } } }`.
4. Wait for the response frame matching the `id`.
5. Return the `payload` as JSON to the browser.

**Auth**: The initial `connect` handshake must include `role: "operator"`, `scopes: ["operator.read", "operator.write"]`, and `auth.token` matching the Gateway token. After the handshake, subsequent RPC calls on the same connection do not need to re-authenticate.

**Alternative approach (simpler)**: If the existing `useOpenClawStore` already maintains a server-side or client-side WebSocket connection with auth, you can skip this API route and have the Zustand store call the Gateway directly from the browser. Check the existing `useOpenClawStore` implementation to see if a browser-side WebSocket is already established. If yes, reuse it and call RPCs directly from the store — no API route needed.

### 4.2. Decide: API Route vs Direct WS

Look at the existing codebase:
- If `useOpenClawStore` already opens a WebSocket from the browser to the Gateway and handles auth → **use direct WS from the store, skip the API route**.
- If the OpenClaw connection is only server-side (Next.js backend) → **create the `/api/openclaw/rpc` proxy route**.

Only implement ONE of these approaches. Do not implement both.

---

## 5. New Page: `/dashboard/capabilities/page.tsx`

### 5.1. Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPABILITIES                                           [Refresh]  │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐                                 │
│  │  Per Agent    │ │   Global     │   ← Tab switcher               │
│  └──────────────┘ └──────────────┘                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  [Agent Dropdown ▾]  ← Only visible in "Per Agent" tab      │   │
│  │  "Select which agent to configure"                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │       TOOLS              │  │         SKILLS                  │  │
│  │                         │  │                                 │  │
│  │  ┌───────────────────┐  │  │  ┌───────────────────────────┐  │  │
│  │  │ exec        [═══] │  │  │  │ nano-banana-pro    [═══]  │  │  │
│  │  │ browser      [══] │  │  │  │ github             [══]   │  │  │
│  │  │ web_search  [═══] │  │  │  │ peekaboo           [═══]  │  │  │
│  │  │ read        [═══] │  │  │  │ summarize          [══]   │  │  │
│  │  │ write       [═══] │  │  │  │ tmux               [═══]  │  │  │
│  │  │ message      [══] │  │  │  │ voice-call         [══]   │  │  │
│  │  │ canvas      [═══] │  │  │  │ ...                       │  │  │
│  │  │ ...               │  │  │  └───────────────────────────┘  │  │
│  │  └───────────────────┘  │  │                                 │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ⚠ Note: Changes are applied to the real OpenClaw Gateway.   │  │
│  │ Tool/skill changes take effect on the next agent turn.       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2. Component Tree

```
CapabilitiesPage (page.tsx — server component shell)
└─ CapabilitiesClient (client component, "use client")
   ├─ CapabilitiesHeader
   │   ├─ Page title: "Capabilities"
   │   └─ Refresh button (calls fetchAll)
   ├─ TabSwitcher
   │   ├─ Tab: "Per Agent" (sets activeTab to "per-agent")
   │   └─ Tab: "Global" (sets activeTab to "global")
   ├─ AgentSelector (only rendered when activeTab === "per-agent")
   │   └─ Dropdown/Select populated from store.agents
   │       └─ On change: setSelectedAgentId(id)
   ├─ CapabilitiesColumns (flex row, two columns)
   │   ├─ ToolsColumn
   │   │   ├─ Column header: "Tools"
   │   │   ├─ Optional search/filter input
   │   │   └─ ToolItemList
   │   │       └─ ToolItem (repeated for each tool)
   │   │           ├─ Tool name
   │   │           ├─ Tool group badge (e.g., "runtime", "fs", "web")
   │   │           ├─ Tool description (truncated, expandable)
   │   │           └─ Toggle switch (on/off)
   │   └─ SkillsColumn
   │       ├─ Column header: "Skills"
   │       ├─ Optional search/filter input
   │       └─ SkillItemList
   │           └─ SkillItem (repeated for each skill)
   │               ├─ Skill name
   │               ├─ Skill description (truncated, expandable)
   │               ├─ Eligibility indicator (green dot = eligible, yellow = missing reqs)
   │               ├─ If ineligible: tooltip or expandable showing missingRequirements
   │               └─ Toggle switch (on/off, disabled if not eligible)
   └─ FooterNotice
       └─ Warning text about changes affecting the real OpenClaw Gateway
```

### 5.3. Data Source Logic per Tab

**Global Tab:**
- Tools list: `store.globalTools`
- Skills list: `store.globalSkills`
- Toggle handler for tools: `store.toggleGlobalTool(name, newValue)`
- Toggle handler for skills: `store.toggleGlobalSkill(key, newValue)`

**Per Agent Tab:**
- Must have an agent selected in the dropdown. If none selected, show a prompt: "Select an agent to configure."
- Tools list: `store.perAgentTools[selectedAgentId]`. If the agent has no per-agent overrides, fall back to showing the global tools state with a visual indicator that says "Inheriting from global" (gray/muted toggle).
- Skills list: `store.perAgentSkills[selectedAgentId]`. Same fallback logic.
- Toggle handler for tools: `store.togglePerAgentTool(selectedAgentId, name, newValue)`
- Toggle handler for skills: `store.togglePerAgentSkill(selectedAgentId, key, newValue)`

### 5.4. UI/UX Design Directives

**Styling framework**: Use the existing NERV.OS design system — shadcn/ui components, Framer Motion for transitions. Match the black orange theme and aesthetic of the rest of the dashboard.

**Tab switcher**: Use the existing tab component pattern from the codebase (likely shadcn `Tabs`). The two tabs should be clearly labeled "Per Agent" and "Global".

**Agent dropdown**: Use a shadcn `Select` or `Command` (combobox) component. Show each agent's `id` and `name` if available. Highlight the default agent.

**Toggle switches**: Use shadcn `Switch` component. Each toggle should:
- Show a loading spinner while the RPC call is in flight (optimistic UI is acceptable but must revert on failure).
- Be disabled (grayed out) if the OpenClaw connection is not established.
- For skills: be disabled if `eligible === false`, with a tooltip explaining missing requirements.

**Two-column layout**: Use a CSS grid or flex layout with equal-width columns. On mobile (< 768px), stack them vertically (tools on top, skills below).

**Search/filter**: Each column should have a small search input at the top that filters items by name. This is client-side filtering only, no RPC call.

**Group badges for tools**: OpenClaw tools belong to groups (`group:runtime`, `group:fs`, `group:web`, `group:ui`, `group:sessions`, `group:memory`, `group:automation`, `group:messaging`, `group:nodes`). Display the group as a small colored badge next to each tool name. Use a consistent color per group.

**Connection status**: At the top of the page (or in the header), show a small connection indicator:
- Green dot + "Connected" if the OpenClaw WS is active.
- Red dot + "Disconnected" if not. Show a "Connect" button that uses the existing connection flow.

**Empty states**:
- If no OpenClaw connection: show a card saying "Connect to an OpenClaw Gateway to manage capabilities" with a link to `/settings/bridges` or the connection settings.
- If connected but no agents: show "No agents configured on this Gateway."
- If connected but agent selected has no per-agent overrides: show the global config as read-only with a "Create per-agent override" button.

---

## 6. File Structure (New Files to Create)

```
stores/
  useOpenClawCapabilitiesStore.ts        ← New Zustand store

lib/openclaw/
  rpc.ts                                  ← Generic RPC helper (if not already existing)
  capabilities.ts                         ← Helper functions for parsing config into tools/skills arrays

app/api/openclaw/rpc/
  route.ts                                ← RPC proxy (ONLY if direct WS from browser is not possible)

app/dashboard/capabilities/
  page.tsx                                ← Server component shell
  _components/
    CapabilitiesClient.tsx                ← Main client component
    TabSwitcher.tsx                       ← Per Agent / Global tab toggle
    AgentSelector.tsx                     ← Agent dropdown
    ToolsColumn.tsx                       ← Left column: tools list + toggles
    SkillsColumn.tsx                      ← Right column: skills list + toggles
    ToolItem.tsx                          ← Single tool row with toggle
    SkillItem.tsx                         ← Single skill row with toggle + eligibility
    FooterNotice.tsx                      ← Warning about real Gateway changes
    ConnectionGuard.tsx                   ← Wrapper that checks OpenClaw connection status
```

---

## 7. OpenClaw Tool Groups Reference (For Badge Colors)

Use these group names and assign each a distinct color from your design system:

| Group Key | Display Label | Contains |
|---|---|---|
| `group:runtime` | Runtime | `exec`, `bash`, `process` |
| `group:fs` | Filesystem | `read`, `write`, `edit`, `apply_patch` |
| `group:sessions` | Sessions | `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status` |
| `group:memory` | Memory | `memory_search`, `memory_get` |
| `group:web` | Web | `web_search`, `web_fetch` |
| `group:ui` | UI | `browser`, `canvas` |
| `group:automation` | Automation | `cron`, `gateway` |
| `group:messaging` | Messaging | `message` |
| `group:nodes` | Nodes | `nodes` |

If a tool doesn't belong to a known group, show "Other" in a neutral color.

---

## 8. OpenClaw Tool Profiles Reference (For Per-Agent Defaults)

When displaying per-agent tools, show which profile is active:

| Profile | What it includes |
|---|---|
| `full` | All tools (default) |
| `coding` | File I/O, runtime, sessions, memory, image |
| `messaging` | Messaging, session list/history/send/status |
| `minimal` | `session_status` only |

Display the active profile as a badge at the top of the tools column when in per-agent mode.

---

## 9. State Derivation Logic (Detailed)

### 9.1. Deriving Global Tool Allowed State

```typescript
function deriveGlobalToolState(
  allTools: Array<{ name: string; group?: string; description?: string }>,
  config: { tools?: { allow?: string[]; deny?: string[]; profile?: string } }
): Array<{ name: string; group?: string; description?: string; allowed: boolean }> {
  const { allow, deny, profile } = config.tools ?? {};

  return allTools.map(tool => {
    // Deny always wins over allow
    if (deny?.includes(tool.name) || deny?.includes(`group:${tool.group}`)) {
      return { ...tool, allowed: false };
    }
    // If there's an explicit allowlist, tool must be in it
    if (allow && allow.length > 0) {
      const isAllowed = allow.includes(tool.name) || allow.includes(`group:${tool.group}`);
      return { ...tool, allowed: isAllowed };
    }
    // If profile is set and no explicit allow/deny, all tools in that profile are allowed
    // For profile=full (default), all tools are allowed
    return { ...tool, allowed: true };
  });
}
```

### 9.2. Deriving Per-Agent Tool Allowed State

Same logic as above, but reads from `agents.list[i].tools.allow` / `agents.list[i].tools.deny` / `agents.list[i].tools.profile` instead. If the agent has no `tools` override, fall back to the global state and mark each tool as "inherited".

### 9.3. Deriving Global Skill State

```typescript
function deriveGlobalSkillState(
  skillStatuses: Array<{ key: string; name: string; description?: string; eligible: boolean; missingRequirements?: string[] }>,
  config: { skills?: { entries?: Record<string, { enabled?: boolean }> } }
): Array<{ key: string; name: string; description?: string; enabled: boolean; eligible: boolean; missingRequirements?: string[] }> {
  const entries = config.skills?.entries ?? {};

  return skillStatuses.map(skill => ({
    ...skill,
    enabled: entries[skill.key]?.enabled !== false, // default true unless explicitly disabled
  }));
}
```

### 9.4. Deriving Per-Agent Skill State

Check `skills.entries.<skillKey>.agents`. If the array exists and does NOT include the current agent's ID, the skill is disabled for that agent. If the array is absent or includes the agent's ID, the skill is enabled.

---

## 10. Error Handling Requirements

1. **Connection lost**: If the WebSocket disconnects during an RPC call, show a toast notification: "Lost connection to OpenClaw Gateway. Reconnecting..." and auto-retry.
2. **Config hash mismatch**: If `config.patch` fails due to a stale `baseHash` (concurrent edit), re-fetch the config with `config.get`, re-compute the patch, and retry once. If it fails again, show an error toast: "Config was modified externally. Please refresh."
3. **RPC timeout**: If an RPC call takes longer than 15 seconds, show a warning toast and allow retry.
4. **Gateway validation error**: If `config.patch` returns a validation error (invalid config shape), show the error message from the Gateway in a toast and revert the optimistic UI update.
5. **Skill ineligible toggle**: If a user tries to toggle on a skill that is not eligible (missing requirements), the toggle should be disabled. Show the missing requirements in a tooltip.

---

## 11. Migration Checklist

- [ ] Remove `capabilityMcps`, `capabilitySkills`, `agentCapabilityAssignments` Drizzle schemas
- [ ] Remove `useCapabilitiesStore` and `useMCPStore` Zustand stores
- [ ] Remove `/api/capabilities/mcps/*`, `/api/capabilities/skills/*`, `/api/composio/*` routes
- [ ] Remove `/settings/mcp-servers/page.tsx`
- [ ] Remove old capability-related components
- [ ] Create `lib/openclaw/rpc.ts` (if needed — check existing WS infrastructure first)
- [ ] Create `lib/openclaw/capabilities.ts`
- [ ] Create `stores/useOpenClawCapabilitiesStore.ts`
- [ ] Create `/api/openclaw/rpc/route.ts` (ONLY if direct WS not possible)
- [ ] Create `/dashboard/capabilities/page.tsx` and all sub-components
- [ ] Update sidebar navigation: change the "Capabilities" link to point to the new page
- [ ] Update any other pages that import from the removed stores/routes
- [ ] Test: connect to a real OpenClaw Gateway, verify tools and skills load, toggle one, verify it persists on the Gateway

---

## 12. Things You Must NOT Do

1. **Do NOT create a local database table** for tools or skills. The OpenClaw Gateway is the source of truth.
2. **Do NOT hardcode tool or skill names**. Always fetch dynamically from the Gateway.
3. **Do NOT create a second WebSocket connection** to the OpenClaw Gateway. Reuse the existing one from `useOpenClawStore` / `useConnectionStore`.
4. **Do NOT send incomplete `agents.list` arrays** in `config.patch`. JSON merge-patch replaces arrays entirely — sending a partial array will delete agents.
5. **Do NOT use `config.apply`** for toggle operations. `config.apply` replaces the ENTIRE config and restarts the Gateway. Use `config.patch` for partial updates.
6. **Do NOT assume skill names equal tool names**. They are separate systems. A skill named "github" is not the same as a tool named "github".
7. **Do NOT reference Composio or MCP servers** anywhere in the new implementation. Those are removed.
8. **Do NOT create any test/mock data**. All data comes from the live Gateway.
