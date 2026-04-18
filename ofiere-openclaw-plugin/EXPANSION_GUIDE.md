# Ofiere OpenClaw Plugin — Meta-Tool Expansion Guide

> **Purpose**: This document is the single source of truth for expanding the Ofiere plugin.
> Tag this file in any new Antigravity session to immediately resume expansion work with full context.
>
> **Current Version**: v3.0.0 — 9 meta-tools live
> **Last Updated**: 2026-04-18 — After full expansion + agent resolver fix

---

## Architecture Summary

The Ofiere OpenClaw plugin uses a **meta-tool consolidation pattern** where each "domain" of the Ofiere dashboard gets ONE registered tool with an `action` parameter for routing.

```
┌──────────────────────────────────────────────────────────┐
│  OpenClaw Gateway (VPS Docker: openclaw-bvwc-openclaw-1) │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Ofiere Plugin (id: "ofiere")                       │ │
│  │                                                     │ │
│  │  index.ts ──► registerTools() returns tool count    │ │
│  │    ├── OFIERE_TASK_OPS      (tasks CRUD + plans)    │ │
│  │    ├── OFIERE_AGENT_OPS     (list agents)           │ │
│  │    ├── OFIERE_PROJECT_OPS   (spaces/folders/deps)   │ │
│  │    ├── OFIERE_SCHEDULE_OPS  (calendar events)       │ │
│  │    ├── OFIERE_KNOWLEDGE_OPS (knowledge base)        │ │
│  │    ├── OFIERE_WORKFLOW_OPS  (workflows + trigger)   │ │
│  │    ├── OFIERE_NOTIFY_OPS    (notifications)         │ │
│  │    ├── OFIERE_MEMORY_OPS    (conversations/memory)  │ │
│  │    └── OFIERE_PROMPT_OPS    (prompt chunks)         │ │
│  │                                                     │ │
│  │  prompt.ts ──► TOOL_DOCS registry (auto-injected)   │ │
│  └─────────────────────────────────────────────────────┘ │
│                          │                               │
│                   Supabase Client                        │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Supabase (shared DB) │
              │  wcpqanwpngqnsstcvvis │
              └───────────────────────┘
                          ▲
              ┌───────────────────────┐
              │  Ofiere Dashboard     │
              │  (Vercel / Next.js)   │
              └───────────────────────┘
```

### Why Meta-Tools?

- OpenClaw sends ALL tool schemas to the LLM on every turn → more tools = more tokens
- 70+ individual tools would consume ~4,000+ tokens/turn just for schemas
- 9 meta-tools = ~2,500 tokens. **Scales linearly, not explosively.**
- `tools.allow` in `openclaw.json` uses plugin ID `"ofiere"` → auto-covers any new tools

### Key Files

| File | Role | Edit When? |
|------|------|-----------:|
| `src/tools.ts` | Tool registration + action handlers | Adding/modifying a domain |
| `src/prompt.ts` | System prompt + TOOL_DOCS registry | Adding/modifying a domain |
| `index.ts` | Plugin entry point, calls `registerTools()` | **Never** (tool count is dynamic) |
| `src/config.ts` | Parses Supabase config from env/plugin config | Only if adding new config fields |
| `src/agent-resolver.ts` | Resolves agent names → IDs with cache | Only if agent resolution logic changes |
| `src/supabase.ts` | Creates Supabase client | **Never** |
| `src/types.ts` | TypeScript interfaces | Only if adding new config fields |
| `openclaw.plugin.json` | Plugin manifest (config schema) | Only if adding new config fields |
| `install.sh` | One-click npm installer | Update success banner |
| `uninstall.sh` | One-click uninstaller | **Never** (removes by plugin ID) |
| `package.json` | Version + dependencies | Bump version on publish |

---

## 🚨 CRITICAL: Known Gotchas & Lessons Learned

These are hard-won lessons from production incidents. **READ THIS FIRST before making any changes.**

### 1. Agent Identity: OpenClaw Returns the PLUGIN Name, Not the Agent Name

**Problem**: The OpenClaw `api` object passed at registration time has `name: "Ofiere PM"` — this is the PLUGIN name, NOT the calling agent's name. Every agent that calls any tool is seen as "Ofiere PM" by the runtime detection.

**Impact**: If you rely on `getCallingAgentName(api)` or `_registrationAgentName`, the resolver will:
1. Try to find an agent named "Ofiere PM"
2. Fail (no such agent)
3. Either auto-register a phantom "Ofiere PM" agent, or FK-violate on insert
4. Fall back to `agent_id: null` → task appears unassigned

**Solution** (implemented in v3.0):
- **Blocklist**: `SYSTEM_NAME_BLOCKLIST` in `tools.ts` blocks "ofiere pm", "openclaw", "system", etc.
- **No runtime detection**: We skip the `getCallingAgentName(api)` and `_registrationAgentName` steps entirely
- **Prompt instructs self-identification**: The system prompt says "ALWAYS pass agent_id with your own name"
- **Resolution priority**: `explicit agent_id from LLM` → `OFIERE_AGENT_ID env var` → `first agent in DB (nuclear fallback)`

**Rule**: NEVER trust the OpenClaw `api` object for agent identity. Agents must self-identify via the `agent_id` parameter.

### 2. Custom Fields: Data Is in `custom_fields` JSONB, Not Top-Level Columns

**Problem**: The `tasks` table stores execution_plan, goals, constraints, system_prompt, and instructions inside a `custom_fields` JSONB column — NOT as separate top-level columns.

**Impact**: When writing handlers that create/update tasks:
- You must **merge into** `custom_fields`, not set top-level columns
- You must **read from** `custom_fields` when listing tasks
- The dashboard API (`/api/tasks`) maps these back to flat fields for the frontend

**Correct pattern for writes:**
```typescript
const customFields = {
  ...(existingTask?.custom_fields || {}),
  execution_plan: params.execution_plan,
  goals: params.goals,
  constraints: params.constraints,
  system_prompt: params.system_prompt,
  instructions: params.instructions,
};

const insertData = {
  id: taskId,
  title: params.title,
  agent_id: resolvedAgentId,
  custom_fields: customFields,
  // ... other columns
};
```

**Correct pattern for reads:**
```typescript
const cf = task.custom_fields || {};
return {
  ...task,
  execution_plan: cf.execution_plan || [],
  goals: cf.goals || [],
  constraints: cf.constraints || [],
  system_prompt: cf.system_prompt || '',
};
```

### 3. FK Violations: Always Wrap Inserts with an agent_id Retry

**Problem**: If the resolved agent_id doesn't exist in the `agents` table, the INSERT will fail with a foreign key violation.

**Solution** (implemented in v3.0):
```typescript
const { error } = await supabase.from("tasks").insert(insertData);

if (error?.message?.includes("violates foreign key") && insertData.agent_id) {
  // Retry without agent_id — let the user assign later
  insertData.agent_id = null;
  const retry = await supabase.from("tasks").insert(insertData);
  if (!retry.error) {
    return ok({ ...result, warning: "Task created but unassigned (agent_id invalid)" });
  }
}
```

**Rule**: EVERY insert that includes `agent_id` must have this FK retry pattern.

### 4. Realtime Sync: Dashboard Updates Come Through Supabase Realtime

**How it works**: The dashboard uses `useRealtimeTasks` hook that subscribes to Supabase Realtime postgres_changes. When the plugin INSERTs/UPDATEs a task, the realtime event fires and the dashboard updates instantly.

**Gotcha**: The realtime INSERT/UPDATE handler (`mapToTaskOps()` in `useRealtimeTasks.ts`) maps `row.custom_fields.execution_plan` → `executionPlan`. If the realtime payload arrives before the write fully commits, or if there are rapid retries (FK violation → retry), the store might get a stale snapshot. A page refresh always resolves this.

**Rule**: Don't panic if data doesn't appear immediately in the UI after plugin writes. The data IS in the DB. A page refresh will fix it.

### 5. Supabase Tables: Always Filter by `user_id`

**Rule**: EVERY query must include `.eq("user_id", userId)` to ensure data isolation. The plugin uses a service role key (RLS bypassed), so without this filter you'd leak data between users.

### 6. PowerShell: `&&` Syntax Doesn't Work

**Problem**: Windows PowerShell doesn't support `&&` for chaining commands. Use `;` instead.

**Wrong**: `cd dir && git add . && git commit -m "msg"`
**Right**: `cd dir; git add .; git commit -m "msg"`

Or better: run commands separately.

### 7. Docker SCP: Use /tmp as Staging

**Problem**: You can't SCP directly into a Docker container. Files must be staged on the host first.

**Pattern**:
```bash
# 1. SCP from local to VPS host /tmp
scp file.ts root@76.13.193.227:/tmp/ofiere-file.ts

# 2. docker cp from host into container
ssh root@76.13.193.227 "docker cp /tmp/ofiere-file.ts openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/file.ts"

# 3. Clean up
ssh root@76.13.193.227 "rm -f /tmp/ofiere-file.ts"
```

### 8. Session Clearing: Only Needed When Renaming Tools

When you ADD new tools, no session clearing is needed. When you RENAME or REMOVE existing tools, clear stale sessions to avoid ghost references:

```bash
ssh root@76.13.193.227 'docker exec openclaw-bvwc-openclaw-1 find /data/.openclaw/agents -name sessions.json -exec sh -c "echo {} > {}" \;'
```

### 9. Atomic Deployment: Prompt and Tools Must Deploy Together

**Problem**: If you update `tools.ts` but not `prompt.ts` (or vice versa), the LLM will have tools it doesn't know how to use, or documentation for tools that don't exist.

**Rule**: ALWAYS deploy both `tools.ts` and `prompt.ts` in the same restart cycle. Never deploy one without the other.

### 10. Auto-Registering Ghost Agents

**Problem**: The `resolveAgentId()` function in `agent-resolver.ts` auto-registers new agents when it can't find a match. This means ANY string passed as `agent_id` will create a new agent record if it doesn't already exist.

**Impact**: The system name "Ofiere PM" was being auto-registered as a real agent. The blocklist prevents this for known system names, but ANY invalid name will still create a phantom agent.

**Consideration for future**: You may want to add a `validateOnly` mode to `resolveAgentId()` that checks existence without auto-registering.

---

## Current Meta-Tool Inventory (v3.0)

| Meta-Tool | Actions | Supabase Tables | Handler Function |
|-----------|---------|-----------------|-----------------|
| `OFIERE_TASK_OPS` | list, create, update, delete | `tasks` | `registerTaskOps()` |
| `OFIERE_AGENT_OPS` | list | `agents` | `registerAgentOps()` |
| `OFIERE_PROJECT_OPS` | list_spaces, create_space, update_space, delete_space, list_folders, create_folder, update_folder, delete_folder, list_dependencies, add_dependency, remove_dependency | `pm_spaces`, `pm_folders`, `task_dependencies` | `registerProjectOps()` |
| `OFIERE_SCHEDULE_OPS` | list, create, update, delete | `scheduler_events` | `registerScheduleOps()` |
| `OFIERE_KNOWLEDGE_OPS` | search, list, create, update, delete | `knowledge_entries` | `registerKnowledgeOps()` |
| `OFIERE_WORKFLOW_OPS` | list, get, create, list_runs, trigger | `workflows`, `workflow_runs` | `registerWorkflowOps()` |
| `OFIERE_NOTIFY_OPS` | list, mark_read, mark_all_read, delete | `notifications` | `registerNotifyOps()` |
| `OFIERE_MEMORY_OPS` | list_conversations, get_messages, search_messages, add_knowledge, search_knowledge | `conversations`, `messages`, `agent_knowledge` | `registerMemoryOps()` |
| `OFIERE_PROMPT_OPS` | list, get, create, update, delete | `prompt_chunks`, `prompt_audit_log` | `registerPromptOps()` |

---

## Step-by-Step: Adding a New Meta-Tool

### Step 1: `src/tools.ts` — Add the handler function

Find the comment `// ─── Public: Register All Meta-Tools ─────` near the bottom. ABOVE that section, add your new domain:

```typescript
// ─── META-TOOL: OFIERE_NEWDOMAIN_OPS ────────────────────────────────────────

function registerNewdomainOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_NEWDOMAIN_OPS",
    label: "Ofiere Newdomain Operations",
    description:
      `Manage [newdomain] in the Ofiere PM dashboard.\n\n` +
      `Actions:\n` +
      `- "list": List all items\n` +
      `- "create": Create a new item. Required: name`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list", "create", "update", "delete"],
        },
        // Add params needed by each action...
        id: { type: "string", description: "Item ID for update/delete" },
        name: { type: "string", description: "Item name for create" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list":
          return handleListNewdomain(supabase, userId, params);
        case "create":
          return handleCreateNewdomain(supabase, userId, params);
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// Handler functions — ALWAYS return ToolResult via ok() or err()
async function handleListNewdomain(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const { data, error } = await supabase
      .from("your_table")
      .select("id, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return err(error.message);
    return ok({ items: data || [], count: (data || []).length });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
```

### Step 2: `src/tools.ts` — Register it in `registerTools()`

Find the `registerTools()` function at the bottom. Add your new call and bump the count:

```typescript
export function registerTools(
  api: any,
  supabase: SupabaseClient,
  config: OfiereConfig,
): number {
  const userId = config.userId;
  const fallbackAgentId = config.agentId;
  const resolveAgent = createAgentResolver(api, supabase, userId, fallbackAgentId);

  // ── Register each domain meta-tool ──
  registerTaskOps(api, supabase, userId, resolveAgent);
  registerAgentOps(api, supabase, userId, fallbackAgentId);
  registerProjectOps(api, supabase, userId);
  // ... existing tools ...
  registerNewdomainOps(api, supabase, userId);  // ← ADD THIS

  // ── Count ──
  const toolCount = 10; // ← UPDATE THIS (was 9)
  // ... rest unchanged
  return toolCount;
}
```

### Step 3: `src/prompt.ts` — Add to TOOL_DOCS

Find the `TOOL_DOCS` constant near the top. Add one entry:

```typescript
const TOOL_DOCS: Record<string, string> = {
  // ... existing entries ...

  // ← ADD THIS:
  OFIERE_NEWDOMAIN_OPS: `- **OFIERE_NEWDOMAIN_OPS** — Description (action: "list", "create", "update", "delete")
    - list: List all items
    - create: Create item (requires name)
    - update: Update item (requires id)
    - delete: Delete item (requires id)`,
};
```

**That's it for code.** The prompt auto-includes all entries, and `index.ts` reads the count dynamically.

### Step 4: `install.sh` — Update success banner (cosmetic)

Update the tools list in the success box at the bottom.

### Step 5: `package.json` — Bump version

Use semantic versioning:
- New domain (meta-tool): bump MINOR (e.g., 3.0.0 → 3.1.0)
- Bug fix / prompt tweak: bump PATCH (e.g., 3.0.0 → 3.0.1)
- Breaking changes: bump MAJOR (e.g., 3.0.0 → 4.0.0)

### Step 6: Deploy

```bash
# 1. Commit and push
git add ofiere-openclaw-plugin/
git commit -m "feat(plugin): add OFIERE_NEWDOMAIN_OPS meta-tool"
git push origin main

# 2. Publish to npm
cd ofiere-openclaw-plugin
npm publish

# 3. Backup on VPS (always do this before deploying)
ssh root@76.13.193.227 "docker exec openclaw-bvwc-openclaw-1 cp -r /data/.openclaw/extensions/ofiere /data/.openclaw/extensions/ofiere.bak"

# 4. Deploy to VPS (SCP → docker cp)
scp src/tools.ts root@76.13.193.227:/tmp/ofiere-tools.ts
scp src/prompt.ts root@76.13.193.227:/tmp/ofiere-prompt.ts

ssh root@76.13.193.227 "
  docker cp /tmp/ofiere-tools.ts openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/src/tools.ts;
  docker cp /tmp/ofiere-prompt.ts openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/src/prompt.ts;
"

# 5. Restart gateway
ssh root@76.13.193.227 "docker restart openclaw-bvwc-openclaw-1"

# 6. Wait 8 seconds, then verify logs
ssh root@76.13.193.227 "sleep 8; docker logs openclaw-bvwc-openclaw-1 --since 20s 2>&1 | grep 'ofiere.*meta-tools'"
# Expected: "[ofiere] 10 meta-tools registered"

# 7. Clean up temp files
ssh root@76.13.193.227 "rm -f /tmp/ofiere-tools.ts /tmp/ofiere-prompt.ts"
```

---

## Checklist Template (copy for each expansion)

```
- [ ] Verify target Supabase tables exist and have the expected columns
- [ ] Handler function added to `src/tools.ts` (registerXxxOps + handlers)
- [ ] Registered in `registerTools()` + toolCount bumped
- [ ] TOOL_DOCS entry added in `src/prompt.ts`
- [ ] If handler writes to tasks: includes FK retry pattern
- [ ] If handler uses agent_id: passes through resolveAgent() with blocklist safety
- [ ] All queries include `.eq("user_id", userId)` filter
- [ ] install.sh banner updated (cosmetic)
- [ ] package.json version bumped
- [ ] Git commit + push
- [ ] npm publish
- [ ] VPS backup (cp -r ofiere ofiere.bak)
- [ ] SCP + docker cp to VPS (BOTH tools.ts AND prompt.ts together)
- [ ] docker restart
- [ ] Verify logs: "[ofiere] N meta-tools registered"
- [ ] Live chat test with agent
- [ ] Verify UI renders data correctly (refresh page if needed)
```

---

## Supabase Tables Reference

These are the tables available in the Ofiere Supabase database that meta-tools can query.
**Project ID**: `wcpqanwpngqnsstcvvis`

### Core Tables (verified active)

| Table | Key Columns | Used By |
|-------|------------|---------|
| `tasks` | id, title, description, status, priority, agent_id, user_id, space_id, folder_id, parent_task_id, progress, start_date, due_date, tags, sort_order, **custom_fields** (JSONB), created_at, updated_at | OFIERE_TASK_OPS |
| `agents` | id, name, codename, role, status, user_id | OFIERE_AGENT_OPS |
| `pm_spaces` | id, name, icon, icon_color, user_id, sort_order, created_at | OFIERE_PROJECT_OPS |
| `pm_folders` | id, name, type, space_id, parent_folder_id, user_id, sort_order | OFIERE_PROJECT_OPS |
| `task_dependencies` | id, predecessor_id, successor_id, type, lag_days, user_id | OFIERE_PROJECT_OPS |
| `scheduler_events` | id, title, agent_id, task_id, scheduled_date, scheduled_time, duration_minutes, recurrence_type, recurrence_interval, color, user_id | OFIERE_SCHEDULE_OPS |
| `knowledge_entries` | id, file_name, content, source, author, credibility_tier, tags, user_id | OFIERE_KNOWLEDGE_OPS |
| `workflows` | id, name, description, status, steps, schedule, user_id | OFIERE_WORKFLOW_OPS |
| `workflow_runs` | id, workflow_id, status, started_at, completed_at, user_id | OFIERE_WORKFLOW_OPS |
| `notifications` | id, type, title, message, read, user_id, created_at | OFIERE_NOTIFY_OPS |
| `conversations` | id, agent_id, user_id, created_at, updated_at | OFIERE_MEMORY_OPS |
| `messages` | id, conversation_id, role, content, created_at | OFIERE_MEMORY_OPS |
| `agent_knowledge` | id, agent_id, content, source, user_id, created_at | OFIERE_MEMORY_OPS |
| `prompt_chunks` | id, agent_id, label, content, enabled, sort_order, user_id | OFIERE_PROMPT_OPS |
| `prompt_audit_log` | id, agent_id, action, chunk_id, label, user_id, created_at | OFIERE_PROMPT_OPS |

### `custom_fields` JSONB Schema (for tasks)

The `tasks.custom_fields` column stores rich task metadata. Structure:

```json
{
  "execution_plan": [
    { "id": "step-xxx", "text": "Step description", "order": 0 }
  ],
  "goals": [
    { "id": "goal-xxx", "type": "custom", "label": "Goal description" }
  ],
  "constraints": [
    { "id": "cstr-xxx", "type": "custom", "label": "Constraint description" }
  ],
  "system_prompt": "Custom behavior instructions...",
  "instructions": "Implementation guidelines...",
  "pm_only": true  // if set, task-ops page won't show this task
}
```

**Goal/Constraint types**: `budget`, `stack`, `legal`, `deadline`, `custom`

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `connection_profiles` | OpenClaw connection config per user |
| `gamification_xp` | XP tracking |
| `gamification_achievements` | Achievement definitions + unlocks |
| `gamification_missions` | Mission tracking |

> **IMPORTANT**: Always query with `.eq("user_id", userId)` to ensure data isolation.
> Use service role key (already configured) — RLS is bypassed.

---

## Agent Resolver: How It Works

### Resolution Priority

```
1. Explicit agent_id from LLM param (e.g. "celia", "ivy")
   ↳ Blocked if in SYSTEM_NAME_BLOCKLIST
   ↳ UUID or agent-xxx format → use directly
   ↳ Name → resolveAgentId() → looks up agents table by name/codename
   ↳ If not found → auto-registers new agent (be careful!)

2. OFIERE_AGENT_ID env var (legacy single-agent mode)

3. Nuclear fallback: first agent in DB alphabetically
```

### System Name Blocklist

These names are blocked from resolution to prevent phantom agents:
```
"ofiere pm", "ofiere", "openclaw", "system", "plugin",
"gateway", "admin", "ofiere pm plugin", "ofiere-openclaw-plugin"
```

If adding new system-level names in the future, update the `SYSTEM_NAME_BLOCKLIST` constant in `tools.ts`.

### Agent IDs in the Database

Agent IDs are **string slugs** (e.g., `"celia"`, `"ivy"`, `"daisy"`), NOT UUIDs. The `agents.id` column uses these slugs directly.

---

## VPS Environment Reference

| Property | Value |
|----------|-------|
| **SSH** | `ssh root@76.13.193.227` |
| **Docker Container** | `openclaw-bvwc-openclaw-1` |
| **OpenClaw Version** | `2026.4.10` |
| **Plugin Path** | `/data/.openclaw/extensions/ofiere/` |
| **Env File** | `/data/.openclaw/.env` |
| **Config File** | `/data/.openclaw/openclaw.json` |
| **tools.allow** | Uses plugin ID `"ofiere"` (auto-covers all tools) |
| **Agents with plugin** | ivy, daisy, celia, thalia, sasha |
| **Agents without** | main, zero, echo (0 OFIERE refs) |
| **Supabase Project** | `wcpqanwpngqnsstcvvis` |

### Docker Commands Cheat Sheet

```bash
# View plugin logs
ssh root@76.13.193.227 "docker logs openclaw-bvwc-openclaw-1 --since 5m 2>&1 | grep ofiere"

# Read a file inside the container
ssh root@76.13.193.227 "docker exec openclaw-bvwc-openclaw-1 cat /data/.openclaw/extensions/ofiere/package.json"

# Copy files INTO the container
ssh root@76.13.193.227 "docker cp /tmp/file.ts openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/file.ts"

# Restart gateway
ssh root@76.13.193.227 "docker restart openclaw-bvwc-openclaw-1"

# Backup before changes
ssh root@76.13.193.227 "docker exec openclaw-bvwc-openclaw-1 cp -r /data/.openclaw/extensions/ofiere /data/.openclaw/extensions/ofiere.bak"

# Check which version is deployed
ssh root@76.13.193.227 "docker exec openclaw-bvwc-openclaw-1 cat /data/.openclaw/extensions/ofiere/package.json | grep version"
```

---

## Constraints & Gotchas

### Things That WILL Break If You Ignore Them

1. **`src/prompt.ts` and `src/tools.ts` must always be in sync.** If you register a tool but don't add its TOOL_DOCS entry, the LLM won't know how to use it.

2. **Tool count in `registerTools()` must match actual registrations.** The count is used in the system prompt: "You have N meta-tools". A mismatch confuses the LLM.

3. **All handler functions must return `ToolResult`** using `ok(data)` or `err(message)`. OpenClaw expects `{ content: [{ type: "text", text: "..." }] }`.

4. **The `action` parameter MUST use `enum`** in the schema. This constrains the LLM to valid values. Without it, the LLM will invent action names like "add", "remove", "get".

5. **Always include `required: ["action"]`** in the schema. Without it, the LLM sometimes omits the action field entirely.

6. **Custom fields go in `custom_fields` JSONB** — not as new columns. The tasks table won't have `execution_plan` as a column; it's inside `custom_fields`.

7. **FK retry pattern is mandatory** for any INSERT involving `agent_id`. Without it, a single bad agent name will crash the entire operation.

8. **`resolveAgentId()` auto-registers** — passing ANY string will create a new agent if it doesn't exist. Use the blocklist to prevent system names from becoming phantom agents.

### Things That Are Safe

- **No `openclaw.json` changes needed** — `tools.allow: "ofiere"` covers all tools from the plugin automatically.
- **No session clearing needed** for adding new tools — only needed when *renaming* existing ones.
- **No dashboard changes needed** — the dashboard detects the plugin via `'OFIERE'` string match in the tool catalog, which works for any tool name starting with `OFIERE_`.
- **`index.ts` does NOT need editing** — tool count is returned dynamically by `registerTools()`.
- **npm publish is safe to run multiple times** — each publish just creates a new version.

### OpenClaw SDK Constraints

- `before_prompt_build` hook can only return: `systemPrompt`, `prependContext`, `prependSystemContext`, `appendSystemContext`. No tool filtering.
- Tool schemas use plain JSON Schema objects (NOT TypeBox). Don't import `@sinclair/typebox`.
- `api.registerTool()` is the only way to register tools. Called during `register()`.
- Tools are re-registered on every gateway restart. No persistent tool state.
- The `api` object identity is the PLUGIN, not individual agents. Each agent shares the same plugin instance.

---

## Future Expansion Candidates

| Meta-Tool | Domain | Priority | Supabase Table(s) |
|-----------|--------|----------|-------------------|
| `OFIERE_GAMIFICATION_OPS` | XP, achievements, missions | LOW | `gamification_*` tables |
| `OFIERE_ANALYTICS_OPS` | Task stats, agent productivity | LOW | Aggregate queries on `tasks` |
| `OFIERE_SETTINGS_OPS` | User preferences, dashboard config | VERY LOW | TBD |

### Naming Convention

- Tool names: `OFIERE_{DOMAIN}_OPS` (all caps, underscore separated)
- Handler functions: `register{Domain}Ops()` (camelCase)
- Action handlers: `handle{Action}{Domain}()` or `handle{Domain}{Action}()` (camelCase)
- Actions: lowercase, underscore for multi-word (e.g., `"list_spaces"`, `"create_folder"`)

---

## Quick Reference: The 3 Files You Edit

When adding a new meta-tool, you **only touch 3 files**:

```
src/tools.ts    ← Add registerXxxOps() + handlers + call it in registerTools()
src/prompt.ts   ← Add entry to TOOL_DOCS
install.sh      ← Update success banner (cosmetic only)
```

Everything else is automatic.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2026-04-17 | Initial release: 5 individual tools |
| v2.0.0 | 2026-04-18 | Meta-tool migration: 5 tools → 2 meta-tools (TASK_OPS, AGENT_OPS) |
| v3.0.0 | 2026-04-18 | Full expansion: 9 meta-tools, enhanced TASK_OPS with execution plans, agent resolver fix |
