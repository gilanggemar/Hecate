# NERV.OS — Agent Model Selector: Live OpenClaw Model Display & Switching

**Target**: Fix the "Not configured" model display on the agent card and replace it with a live, clickable model selector that reads from and writes to the connected OpenClaw Gateway.

**Date**: March 22, 2026

---

## 0. The Problem

On the NERV.OS agents page, the left-side agent card has an "AGENT CAPABILITIES" section with a "MODEL" sub-section. Currently it displays:

```
MODEL
⚙ Not configured
```

This is wrong. The connected OpenClaw Gateway already has a model configured (e.g., `openai-codex/gpt-5.3-codex` as shown in the OpenClaw Control UI's Overview tab). The NERV.OS dashboard is ignoring the Gateway's model config and instead looking at a local database field that was never populated.

**The fix**: Read the active model from the OpenClaw Gateway via WebSocket RPC, display it on the card, and allow the user to change it via a dropdown — just like the OpenClaw Control UI's "Primary model (default)" dropdown.

---

## 1. Context: How OpenClaw Stores Model Configuration

### 1.1. Config Keys

All model config lives inside `~/.openclaw/openclaw.json` on the Gateway host. The relevant paths are:

| Config Path | Purpose |
|---|---|
| `agents.defaults.model.primary` | The primary model used by ALL agents unless overridden. This is a string like `"openai-codex/gpt-5.3-codex"`. |
| `agents.defaults.model.fallbacks` | Array of fallback model strings, tried in order if primary fails. Example: `["openai/gpt-5.2", "anthropic/claude-sonnet-4-6"]`. |
| `agents.defaults.models` | The model **catalog / allowlist**. This is an object where keys are model ref strings and values contain optional `alias`, `params`, and provider overrides. If this object exists, only models listed in it can be selected via `/model`. |
| `agents.list[<i>].model.primary` | Per-agent model override. If set, this agent uses this model instead of the default. |
| `agents.list[<i>].model.fallbacks` | Per-agent fallback override. |

### 1.2. Model Ref Format

Model references follow the pattern: `provider/model-name`. Examples:
- `openai-codex/gpt-5.3-codex`
- `anthropic/claude-sonnet-4-6`
- `openai/gpt-5.2`
- `venice/grok-41-fast`
- `google/gemini-3-pro`
- `openrouter/moonshotai/kimi-k2`

The provider prefix before the first `/` identifies which auth + endpoint to use. The rest is the model identifier.

### 1.3. Model Selection Priority (How OpenClaw Resolves the Active Model)

For any given agent, OpenClaw resolves the model in this order:

1. If `agents.list[<i>].model.primary` is set for this agent → use it.
2. Else use `agents.defaults.model.primary`.
3. If the primary fails (auth error, rate limit, etc.), try each model in `fallbacks` in order.
4. Provider auth failover happens inside a provider before moving to the next model.

### 1.4. Gateway RPC Methods We Will Use

| RPC Method | Purpose |
|---|---|
| `config.get` | Returns the full config JSON + a `hash` for concurrency control. We parse `agents.defaults.model`, `agents.defaults.models`, and `agents.list` from this. |
| `config.patch` | Partial merge-patch update. We use this to change the model. |
| `models.list` | Returns the list of configured/available models. The Control UI uses this in its Debug panel. |

### 1.5. Hot Reload

Changes to `agents` and `models` **hot-apply without a Gateway restart**. After we `config.patch` a new model, the change takes effect on the next agent turn. No restart needed.

---

## 2. What to Change

### 2.1. Files to Modify (NOT delete — modify in place)

You are modifying the **existing** agent card component that displays agent details on the agents page. The exact file path depends on the current codebase structure, but it is the component that renders the left-side agent card shown in the second screenshot — the one containing:
- Rank badge ("RANK: INITIATE")
- Agent name ("Main")
- Status indicator ("STANDBY")
- Level bar ("LVL 1 — 0/100 XP")
- "AGENT CAPABILITIES" section
- "MODEL" sub-section (currently showing "Not configured")
- "CAPABILITIES >" link
- TOOLS count + group badges
- SKILLS count + name badges
- "DEPLOY" button at bottom

Search the codebase for the text `"Not configured"` in the agents-related components to find the exact file. It is likely at one of these paths:
- `app/agents/_components/AgentCard.tsx`
- `app/agents/_components/AgentDetailCard.tsx`
- `app/agents/_components/AgentSidebar.tsx`
- `components/agents/AgentProfileCard.tsx`

### 2.2. Store to Modify

The existing `useOpenClawStore` (or `useAgentStore` if it manages agent data) needs a small extension — not a replacement. Add the model-related state and actions to whichever store currently holds the OpenClaw connection and agent data.

If neither store is appropriate, create a **small focused store**: `stores/useOpenClawModelStore.ts`.

---

## 3. New Store Additions (or New Store)

### 3.1. State Shape to Add

```typescript
// Add these fields to the existing store, or create useOpenClawModelStore

interface OpenClawModelState {
  // The resolved active model for each agent (agentId → model string)
  activeModels: Record<string, string>;
  // e.g. { "main": "openai-codex/gpt-5.3-codex", "work": "anthropic/claude-sonnet-4-6" }

  // The default model (agents.defaults.model.primary)
  defaultModel: string | null;

  // The default fallbacks (agents.defaults.model.fallbacks)
  defaultFallbacks: string[];

  // The model catalog/allowlist (from agents.defaults.models)
  // This is the list of models available for selection in the dropdown.
  modelCatalog: Array<{
    ref: string;         // e.g. "openai-codex/gpt-5.3-codex"
    alias?: string;      // e.g. "Codex" — friendly display name
    provider: string;    // e.g. "openai-codex" — derived from ref
    modelName: string;   // e.g. "gpt-5.3-codex" — derived from ref
  }>;

  // Config hash for optimistic concurrency
  configHash: string | null;

  // Loading state
  isModelLoading: boolean;
  modelError: string | null;

  // Actions
  fetchModels: () => Promise<void>;
  setAgentModel: (agentId: string, modelRef: string) => Promise<void>;
  setDefaultModel: (modelRef: string) => Promise<void>;
  setDefaultFallbacks: (fallbacks: string[]) => Promise<void>;
}
```

### 3.2. `fetchModels` Implementation Logic

This action reads the full model configuration from the Gateway. It must:

1. Call `config.get` via the existing OpenClaw WebSocket connection (reuse `useOpenClawStore`'s WS, do NOT create a new one).
2. Parse the response `payload`:
   - Read `payload.config.agents.defaults.model.primary` → set as `defaultModel`.
   - Read `payload.config.agents.defaults.model.fallbacks` → set as `defaultFallbacks`.
   - Read `payload.config.agents.defaults.models` → build `modelCatalog` array:
     ```typescript
     const modelsObj = config.agents?.defaults?.models ?? {};
     const catalog = Object.entries(modelsObj).map(([ref, meta]) => {
       const slashIndex = ref.indexOf("/");
       return {
         ref,
         alias: (meta as any)?.alias ?? undefined,
         provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
         modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
       };
     });
     ```
   - If `agents.defaults.models` is empty/missing, the catalog should still include the `agents.defaults.model.primary` value (and any fallbacks) so there is at least something to show.
   - Read `payload.config.agents.list` → for each agent, resolve its active model:
     ```typescript
     const agentsList = config.agents?.list ?? [];
     const activeModels: Record<string, string> = {};
     for (const agent of agentsList) {
       activeModels[agent.id] = agent.model?.primary ?? defaultModel ?? "unknown";
     }
     // If there's no agents.list (single-agent setup), use "main" as the agent ID:
     if (agentsList.length === 0) {
       activeModels["main"] = defaultModel ?? "unknown";
     }
     ```
   - Store `payload.hash` as `configHash`.

3. **Fallback for model catalog**: If `agents.defaults.models` is empty but the primary model is set, the dropdown should still show at minimum that one model. Additionally, call `models.list` RPC (which returns available models from the Gateway runtime) and merge those into the catalog. The `models.list` response gives a richer list. If `models.list` fails or is not available, gracefully fall back to just the config-derived catalog.

### 3.3. `setAgentModel` Implementation Logic

This is called when the user selects a new model from the dropdown on a specific agent's card.

**Determine if this is the default agent or a multi-agent setup:**

**Case A: The agent has a per-agent model override (`agents.list[i].model.primary` exists or user wants to set one):**

1. Call `config.get` → get fresh config + `hash`.
2. Find the agent's index in `agents.list` by `id === agentId`.
3. Build the patch:
   ```typescript
   // IMPORTANT: config.patch replaces arrays entirely.
   // We must send the COMPLETE agents.list array with only the target agent's model changed.
   const agentsList = [...currentConfig.agents.list];
   const agentIndex = agentsList.findIndex(a => a.id === agentId);
   
   if (agentIndex >= 0) {
     agentsList[agentIndex] = {
       ...agentsList[agentIndex],
       model: { 
         primary: modelRef,
         // Preserve existing fallbacks if any
         ...(agentsList[agentIndex].model?.fallbacks 
           ? { fallbacks: agentsList[agentIndex].model.fallbacks } 
           : {})
       }
     };
   }
   ```
4. Call `config.patch` with:
   ```json
   {
     "raw": "{ \"agents\": { \"list\": <the full updated agents.list array> } }",
     "baseHash": "<hash from step 1>"
   }
   ```
5. Call `fetchModels()` to refresh.

**Case B: Single-agent setup (no `agents.list` or agent is the default), changing the default model:**

1. Call `setDefaultModel(modelRef)` instead.

### 3.4. `setDefaultModel` Implementation Logic

1. Call `config.get` → get fresh config + `hash`.
2. Call `config.patch` with:
   ```json
   {
     "raw": "{ \"agents\": { \"defaults\": { \"model\": { \"primary\": \"<modelRef>\" } } } }",
     "baseHash": "<hash>"
   }
   ```
   This merge-patches only `agents.defaults.model.primary`. It preserves fallbacks and everything else.
3. Call `fetchModels()` to refresh.

### 3.5. `setDefaultFallbacks` Implementation Logic

1. Call `config.get` → get fresh config + `hash`.
2. Call `config.patch` with:
   ```json
   {
     "raw": "{ \"agents\": { \"defaults\": { \"model\": { \"fallbacks\": [\"<model1>\", \"<model2>\"] } } } }",
     "baseHash": "<hash>"
   }
   ```
3. Call `fetchModels()` to refresh.

---

## 4. UI Changes to the Agent Card

### 4.1. Replace the "Not configured" Model Section

Find the component that currently renders this:

```
MODEL
⚙ Not configured
```

Replace it with a **clickable model display** that expands into a dropdown selector.

### 4.2. New Component: `AgentModelSelector`

Create a new component at a path like:
- `app/agents/_components/AgentModelSelector.tsx` (or wherever the agent card sub-components live)

This is a `"use client"` component.

### 4.3. Component Behavior (Two States)

**State 1: Collapsed (default view on the card)**

Display the current active model in a compact format:

```
MODEL
⚙ openai-codex / gpt-5.3-codex     [▾]
```

Or with the alias if available:

```
MODEL
⚙ gpt-5.3-codex (Codex)             [▾]
```

Design details:
- Show a small gear icon (⚙) or a model/brain icon to the left.
- The model name is the primary text. If an alias exists, show it in parentheses or as secondary text.
- The provider prefix (`openai-codex/`) should be shown in a muted/dimmer color as a prefix, and the model name (`gpt-5.3-codex`) in the primary text color. This makes the important part (model name) visually prominent while still showing the full ref.
- A small chevron-down icon (`▾`) on the right indicates it is clickable/expandable.
- The entire row is clickable and opens State 2.
- If the OpenClaw connection is not established, show the model text as disabled/gray with a tooltip: "Connect to OpenClaw to manage models."
- If the model truly cannot be resolved (no connection, no config), show `"No model set"` instead of "Not configured" — this is a softer, more accurate label.

**State 2: Expanded (dropdown open)**

When clicked, render a dropdown/popover with:

```
┌─────────────────────────────────────────────┐
│  Select Primary Model                       │
│  ┌─────────────────────────────────────────┐│
│  │ 🔍 Search models...                     ││
│  └─────────────────────────────────────────┘│
│                                             │
│  ● openai-codex/gpt-5.3-codex    ← active  │
│    Kimi K2.5 (venice/kimi-k2-5)            │
│    venice/grok-41-fast                      │
│                                             │
│  ─── Fallbacks (comma-separated) ────────  │
│  │ provider/model, provider/model          ││
│                                             │
│            [Reload Config]  [Save]          │
└─────────────────────────────────────────────┘
```

Design details:
- Use a shadcn `Popover` or `DropdownMenu` component. The popover should appear below or beside the model row on the agent card, NOT as a full-page modal.
- The dropdown lists all models from `modelCatalog` in the store.
- The currently active model has a radio indicator (●) or checkmark (✓) and is highlighted.
- Each model item shows:
  - The full model ref (e.g., `openai-codex/gpt-5.3-codex`)
  - The alias in parentheses if it has one (e.g., `(Codex)`)
  - The provider portion in muted color
- A search input at the top filters the list by model name, alias, or provider. This is client-side filtering.
- Clicking a model item immediately triggers `setAgentModel(agentId, modelRef)` or `setDefaultModel(modelRef)` depending on context (see Section 3.3 logic).
- While saving, show a loading spinner on the selected item.
- On success, close the dropdown and update the collapsed display.
- On error, show a toast notification and keep the dropdown open.

**Fallbacks input (optional, secondary UI):**
- Below the model list, show a text input labeled "Fallbacks (comma-separated)" pre-filled with the current fallbacks.
- A "Save" button next to it calls `setDefaultFallbacks(...)`.
- This is a nice-to-have but lower priority than the primary model selector. If it adds too much complexity to the card, defer it to the full capabilities page or a settings page.

### 4.4. Component Props

```typescript
interface AgentModelSelectorProps {
  agentId: string;              // The agent's ID (e.g., "main", "work")
  isConnected: boolean;         // Whether the OpenClaw WS is connected
}
```

The component reads all other data from the Zustand store internally.

### 4.5. When to Fetch

Call `fetchModels()` in the following scenarios:
1. When the agent card mounts (inside a `useEffect`), IF the OpenClaw connection is already established.
2. When the OpenClaw connection status changes from disconnected → connected.
3. After any successful model change (already handled inside `setAgentModel` / `setDefaultModel`).
4. When the user clicks a "Reload" or "Refresh" button (if you add one).

### 4.6. Integration Into the Existing Agent Card

The `AgentModelSelector` component replaces ONLY the model sub-section of the agent card. It does NOT replace the entire card or the capabilities section. The surrounding layout — rank, name, status, XP bar, tools count, skills count, deploy button — all stay exactly as they are.

The integration point looks like this in the existing card's JSX:

```tsx
{/* Existing code above — rank, name, status, XP bar */}

<div className="...">
  <span className="text-xs uppercase tracking-wider text-muted-foreground">
    Agent Capabilities
  </span>
  
  {/* MODEL section — REPLACE THIS */}
  <span className="text-xs uppercase tracking-wider text-muted-foreground">Model</span>
  {/* OLD: <div>⚙ Not configured</div> */}
  {/* NEW: */}
  <AgentModelSelector 
    agentId={agent.codename ?? agent.id ?? "main"} 
    isConnected={isOpenClawConnected} 
  />
  
  {/* Existing code below — Capabilities link, Tools, Skills, Deploy */}
</div>
```

**IMPORTANT**: The `agentId` prop must be the OpenClaw agent ID (e.g., `"main"`, `"work"`), NOT the NERV.OS Supabase UUID. The mapping between NERV.OS agents and OpenClaw agents is done via the `codename` field on the NERV.OS agent, OR via a mapping stored in the connection profile. Look at the existing codebase to see how other OpenClaw-integrated features (like the chat or tools count) resolve this mapping. If no mapping exists yet, default to `"main"` as the OpenClaw agent ID for the default agent.

---

## 5. Styling & Design Directives

### 5.1. Match Existing Card Aesthetic

The agent card uses the NERV.OS dark theme with:
- Dark background with subtle border (likely a card component with `bg-card` or similar)
- Orange/amber accent color for active elements (seen on rank border, deploy button, star icon)
- `font-mono` or monospaced font for labels like "RANK: INITIATE", "STANDBY", "LVL 1"
- Uppercase small-caps for section headers ("AGENT CAPABILITIES", "MODEL", "TOOLS", "SKILLS")
- Muted foreground color for section headers
- Regular foreground color for values

### 5.2. Model Display Styling

- The model ref should use the same monospaced font as other card labels.
- Provider prefix in `text-muted-foreground` color.
- Model name in `text-foreground` color.
- The clickable area should have a subtle hover effect (e.g., background color change to `bg-muted/50` or a thin orange border flash).
- The chevron icon should be small (`w-3 h-3` or similar) and muted.

### 5.3. Dropdown Styling

- Use shadcn `Popover` + `Command` (combobox pattern) for the searchable model list. This gives you free keyboard navigation, search, and accessible markup.
- The popover should have the same dark background as the card.
- Active/selected model highlighted with the orange accent color.
- Use Framer Motion for a subtle scale-in animation on the popover open (if the codebase already uses motion for popovers; otherwise skip).

---

## 6. File Structure (New Files)

```
app/agents/_components/
  AgentModelSelector.tsx          ← New component (or wherever agent card sub-components live)

stores/
  useOpenClawModelStore.ts        ← New Zustand store (OR extend existing useOpenClawStore)
```

If the codebase convention is to co-locate components with their page, put `AgentModelSelector.tsx` next to the existing agent card component. If there is a shared `components/agents/` directory, put it there.

---

## 7. Error Handling

1. **No OpenClaw connection**: Show `"No model set"` with the gear icon grayed out. The chevron should not render (not clickable). Tooltip on hover: "Connect to OpenClaw Gateway to view and change models."

2. **Connection established but config.get fails**: Show `"Error loading model"` in red/destructive text. Add a small retry icon button.

3. **config.patch fails (stale hash)**: Re-fetch config, re-attempt the patch once. If it fails again, show a toast: "Model config was changed externally. Please try again."

4. **config.patch fails (validation error)**: Show the Gateway's error message in a toast. Revert the optimistic UI.

5. **Model not in catalog**: If the active model from `config.get` is NOT in `agents.defaults.models`, still display it (don't hide it). Show it with a small warning icon and tooltip: "This model is not in the allowlist and may be rejected."

6. **Rate limiting**: `config.patch` is rate-limited to 3 writes per 60 seconds. If the user rapidly switches models, debounce or queue the changes. Show a toast if rate-limited: "Too many changes. Please wait a moment."

---

## 8. OpenClaw Agent ID Mapping

The NERV.OS dashboard stores agents in Supabase with fields like `id` (UUID), `name`, `codename`, `role`, etc. OpenClaw agents are identified by a simple string `id` like `"main"` or `"work"`.

**Mapping strategy** (look at existing code to confirm which approach is already used):

1. **Best case**: The NERV.OS `connectionProfiles` table or `useConnectionStore` already has a mapping of NERV.OS agent UUID → OpenClaw agent ID. Use it.

2. **Likely case**: The NERV.OS agent's `codename` field maps to the OpenClaw agent ID. For example, a NERV.OS agent with codename `"main"` corresponds to OpenClaw agent ID `"main"`.

3. **Fallback**: If there is no explicit mapping, assume the default OpenClaw agent is `"main"`. Single-agent OpenClaw setups only have one agent ID.

4. **Multi-agent**: If the OpenClaw Gateway has multiple agents (returned in `config.get` → `agents.list`), and the NERV.OS dashboard also has multiple agents, the mapping must be established somehow. If it is not already established in the codebase, add an `openClawAgentId` field to the NERV.OS agent store/schema that can be set by the user. But do NOT add this field unless it is confirmed that no mapping already exists — check first.

---

## 9. Things You Must NOT Do

1. **Do NOT read the model from the NERV.OS Supabase database.** The model is stored on the OpenClaw Gateway. The Gateway is the source of truth.

2. **Do NOT write the model to the NERV.OS Supabase database** when the user changes it. Write it to the OpenClaw Gateway via `config.patch`. The local database should not shadow this data.

3. **Do NOT hardcode model names.** The dropdown must be dynamically populated from the Gateway config.

4. **Do NOT create a new WebSocket connection.** Reuse the existing one from `useOpenClawStore` or `useConnectionStore`.

5. **Do NOT use `config.apply` to change the model.** `config.apply` replaces the ENTIRE config and restarts the Gateway. Use `config.patch` for partial updates.

6. **Do NOT send a partial `agents.list` array** in `config.patch`. JSON merge-patch replaces arrays entirely. If you need to update a per-agent model, send the COMPLETE `agents.list` array with only the target agent's `model` field changed.

7. **Do NOT replace the entire agent card.** Only modify the MODEL sub-section. Everything else on the card stays as-is.

8. **Do NOT show "Not configured"** ever again. If there is genuinely no model set (empty config), show `"No model set"`. If there is no OpenClaw connection, show `"No model set"` (grayed out). The phrase "Not configured" is confusing because the model IS configured on the Gateway — the dashboard just was not reading it.

9. **Do NOT remove or modify the existing tools count or skills count** display on the agent card. Those are separate features.

---

## 10. Verification Checklist

After implementation, verify:

- [ ] When OpenClaw is connected and has a model configured, the agent card shows the actual model name (e.g., `openai-codex/gpt-5.3-codex`) instead of "Not configured"
- [ ] Clicking the model display opens a dropdown with all available models from `agents.defaults.models`
- [ ] Selecting a different model in the dropdown sends `config.patch` to the Gateway
- [ ] After changing the model, the card updates to show the new model
- [ ] The dropdown has a search/filter input
- [ ] When OpenClaw is disconnected, the model display is grayed out and not clickable
- [ ] Changing the model on the NERV.OS dashboard is reflected on the OpenClaw Gateway (verify by opening the OpenClaw Control UI at `http://127.0.0.1:18789` and checking the Overview tab)
- [ ] Changing the model on the OpenClaw Control UI and then refreshing the NERV.OS dashboard shows the updated model
- [ ] No "Not configured" text appears anywhere on the agent card
