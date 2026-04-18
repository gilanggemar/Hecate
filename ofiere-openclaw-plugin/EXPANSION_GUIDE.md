# Ofiere OpenClaw Plugin — Meta-Tool Expansion Guide

> **Purpose**: This document is the single source of truth for expanding the Ofiere plugin.
> Tag this file in any new Antigravity session to immediately resume expansion work with full context.
>
> **Last Updated**: 2026-04-18 — After v2.0 meta-tool migration (5 tools → 2 meta-tools)

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
│  │    ├── OFIERE_TASK_OPS   (list/create/update/del)   │ │
│  │    ├── OFIERE_AGENT_OPS  (list)                     │ │
│  │    ├── OFIERE_PROJECT_OPS (future)                  │ │
│  │    ├── OFIERE_SCHEDULE_OPS (future)                 │ │
│  │    └── OFIERE_KNOWLEDGE_OPS (future)                │ │
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
- 2 meta-tools = ~800 tokens. 10 meta-tools = ~2,000 tokens. **Scales linearly, not explosively.**
- `tools.allow` in `openclaw.json` uses plugin ID `"ofiere"` → auto-covers any new tools

### Key Files

| File | Role | Edit When? |
|------|------|-----------|
| `src/tools.ts` | Tool registration + action handlers | Adding a new domain |
| `src/prompt.ts` | System prompt + TOOL_DOCS registry | Adding a new domain |
| `index.ts` | Plugin entry point, calls `registerTools()` | **Never** (tool count is dynamic) |
| `src/config.ts` | Parses Supabase config from env/plugin config | Only if adding new config fields |
| `src/agent-resolver.ts` | Resolves agent names → UUIDs with cache | **Never** (shared by all tools) |
| `src/supabase.ts` | Creates Supabase client | **Never** |
| `src/types.ts` | TypeScript interfaces | Only if adding new config fields |
| `openclaw.plugin.json` | Plugin manifest (config schema) | Only if adding new config fields |
| `install.sh` | One-click npm installer | Update success banner |
| `uninstall.sh` | One-click uninstaller | **Never** (removes by plugin ID) |
| `package.json` | Version + dependencies | Bump version on publish |

---

## Step-by-Step: Adding a New Meta-Tool

### Example: Adding `OFIERE_PROJECT_OPS`

Suppose the dashboard has a Projects feature with spaces, folders, and hierarchy. Here's exactly how to add it.

---

### Step 1: `src/tools.ts` — Add the handler function

Find the comment `// ─── Public: Register All Meta-Tools ─────` near the bottom. ABOVE that section, add your new domain:

```typescript
// ─── META-TOOL: OFIERE_PROJECT_OPS ──────────────────────────────────────────

function registerProjectOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_PROJECT_OPS",
    label: "Ofiere Project Operations",
    description:
      `Manage projects, spaces, and folders in the Ofiere PM dashboard.\n\n` +
      `Actions:\n` +
      `- "list_spaces": List all spaces\n` +
      `- "list_folders": List folders in a space. Requires: space_id\n` +
      `- "create_space": Create a new space. Required: name\n` +
      `- "create_folder": Create a folder. Required: name, space_id\n` +
      `- "update": Update space/folder. Required: id, type ("space" or "folder")`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list_spaces", "list_folders", "create_space", "create_folder", "update"],
        },
        // Add params needed by each action...
        id: { type: "string", description: "Space or folder ID" },
        space_id: { type: "string", description: "Parent space ID" },
        name: { type: "string", description: "Name for new space/folder" },
        type: { type: "string", enum: ["space", "folder"] },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list_spaces":
          return handleListSpaces(supabase, userId);
        case "list_folders":
          return handleListFolders(supabase, userId, params);
        // ... etc
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// Then add your handler functions:
async function handleListSpaces(supabase: SupabaseClient, userId: string): Promise<ToolResult> {
  try {
    const { data, error } = await supabase
      .from("pm_spaces")
      .select("id, name, color, sort_order, created_at")
      .eq("user_id", userId)
      .order("sort_order");
    if (error) return err(error.message);
    return ok({ spaces: data || [], count: (data || []).length });
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
  registerProjectOps(api, supabase, userId);  // ← ADD THIS

  // ── Count ──
  const toolCount = 3; // ← UPDATE THIS (was 2)
  // ... rest unchanged
  return toolCount;
}
```

### Step 3: `src/prompt.ts` — Add to TOOL_DOCS

Find the `TOOL_DOCS` constant near the top. Add one entry:

```typescript
const TOOL_DOCS: Record<string, string> = {
  OFIERE_TASK_OPS: `...existing...`,
  OFIERE_AGENT_OPS: `...existing...`,

  // ← ADD THIS:
  OFIERE_PROJECT_OPS: `- **OFIERE_PROJECT_OPS** — Manage projects (action: "list_spaces", "list_folders", "create_space", "create_folder", "update")
    - list_spaces: List all PM spaces
    - list_folders: List folders in a space (requires space_id)
    - create_space: Create a new space (requires name)
    - create_folder: Create a folder (requires name + space_id)
    - update: Update space/folder name, color, etc.`,
};
```

**That's it for code.** The prompt auto-includes all entries, and `index.ts` reads the count dynamically.

### Step 4: `install.sh` — Update success banner (cosmetic)

Update the tools list in the success box at the bottom:

```bash
echo "║   Meta-tools available to ALL agents:            ║"
echo "║     • OFIERE_TASK_OPS  (list/create/update/del)  ║"
echo "║     • OFIERE_AGENT_OPS (list agents)             ║"
echo "║     • OFIERE_PROJECT_OPS (spaces/folders)        ║"  # ← ADD
```

### Step 5: `package.json` — Bump version

```json
"version": "2.1.0"
```

### Step 6: Deploy

```bash
# 1. Commit and push
git add ofiere-openclaw-plugin/
git commit -m "feat(plugin): add OFIERE_PROJECT_OPS meta-tool"
git push origin main

# 2. Publish to npm
cd ofiere-openclaw-plugin
npm publish

# 3. Deploy to VPS (copy files into Docker)
scp -r src/ root@76.13.193.227:/tmp/ofiere-update/src/
scp index.ts package.json root@76.13.193.227:/tmp/ofiere-update/
ssh root@76.13.193.227 "
  docker cp /tmp/ofiere-update/src/. openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/src/
  docker cp /tmp/ofiere-update/package.json openclaw-bvwc-openclaw-1:/data/.openclaw/extensions/ofiere/package.json
"

# 4. Restart gateway
ssh root@76.13.193.227 "docker restart openclaw-bvwc-openclaw-1"

# 5. Verify
ssh root@76.13.193.227 "docker logs openclaw-bvwc-openclaw-1 --since 1m 2>&1 | grep ofiere"
# Expected: "[ofiere] 3 meta-tools registered"

# 6. Clean up
ssh root@76.13.193.227 "rm -rf /tmp/ofiere-update"
```

---

## Checklist Template (copy for each expansion)

```
- [ ] Handler function added to `src/tools.ts` (registerXxxOps + handlers)
- [ ] Registered in `registerTools()` + toolCount bumped
- [ ] TOOL_DOCS entry added in `src/prompt.ts`
- [ ] install.sh banner updated (cosmetic)
- [ ] package.json version bumped
- [ ] Git commit + push
- [ ] npm publish
- [ ] SCP + docker cp to VPS
- [ ] docker restart
- [ ] Verify logs: "[ofiere] N meta-tools registered"
- [ ] Live chat test with agent
```

---

## Supabase Tables Reference

These are the tables available in the Ofiere Supabase database that meta-tools can query.
Use this to know which tables exist when building new handlers.

### Core Tables (verified active)

| Table | Key Columns | Used By |
|-------|------------|---------|
| `tasks` | id, title, description, status, priority, agent_id, user_id, space_id, folder_id, parent_task_id, progress, start_date, due_date, tags, sort_order, created_at, updated_at | OFIERE_TASK_OPS |
| `agents` | id, name, codename, role, status, user_id | OFIERE_AGENT_OPS |
| `pm_spaces` | id, name, color, user_id, sort_order, created_at | Future: PROJECT_OPS |
| `pm_folders` | id, name, space_id, user_id, sort_order, created_at | Future: PROJECT_OPS |
| `scheduler_events` | id, task_id, start, end, user_id | Future: SCHEDULE_OPS |
| `knowledge_entries` | id, title, content, tags, user_id | Future: KNOWLEDGE_OPS |

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
| **Agents with plugin** | ivy, daisy, celia, thalia, sasha (registered per-agent) |
| **Agents without** | main, zero, echo (0 OFIERE refs) |

### Docker commands cheat sheet

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
```

---

## Constraints & Gotchas

### Things That WILL Break If You Ignore Them

1. **`src/prompt.ts` and `src/tools.ts` must always be in sync.** If you register a tool but don't add its TOOL_DOCS entry, the LLM won't know how to use it.

2. **Tool count in `registerTools()` must match actual registrations.** The count is used in the system prompt: "You have N meta-tools". A mismatch confuses the LLM.

3. **All handler functions must return `ToolResult`** using `ok(data)` or `err(message)`. OpenClaw expects `{ content: [{ type: "text", text: "..." }] }`.

4. **The `action` parameter MUST use `enum`** in the schema. This constrains the LLM to valid values. Without it, the LLM will invent action names like "add", "remove", "get".

5. **Always include `required: ["action"]`** in the schema. Without it, the LLM sometimes omits the action field entirely.

### Things That Are Safe

- **No `openclaw.json` changes needed** — `tools.allow: "ofiere"` covers all tools from the plugin automatically.
- **No session clearing needed** for adding new tools — only needed when *renaming* existing ones.
- **No dashboard changes needed** — the dashboard detects the plugin via `'OFIERE'` string match in the tool catalog, which works for any tool name starting with `OFIERE_`.
- **`index.ts` does NOT need editing** — tool count is returned dynamically by `registerTools()`.

### OpenClaw SDK Constraints

- `before_prompt_build` hook can only return: `systemPrompt`, `prependContext`, `prependSystemContext`, `appendSystemContext`. No tool filtering.
- Tool schemas use plain JSON Schema objects (NOT TypeBox). Don't import `@sinclair/typebox`.
- `api.registerTool()` is the only way to register tools. Called during `register()`.
- Tools are re-registered on every gateway restart. No persistent tool state.

---

## Future Expansion Roadmap

| Meta-Tool | Domain | Priority | Supabase Table(s) |
|-----------|--------|----------|-------------------|
| `OFIERE_PROJECT_OPS` | Spaces, folders, hierarchy | HIGH | `pm_spaces`, `pm_folders` |
| `OFIERE_SCHEDULE_OPS` | Calendar, timeline, events | HIGH | `scheduler_events`, `tasks` |
| `OFIERE_KNOWLEDGE_OPS` | Knowledge base entries | MEDIUM | `knowledge_entries` |
| `OFIERE_GAMIFICATION_OPS` | XP, achievements, missions | LOW | `gamification_*` tables |
| `OFIERE_ANALYTICS_OPS` | Task stats, agent productivity | LOW | Aggregate queries on `tasks` |

### Naming Convention

- Tool names: `OFIERE_{DOMAIN}_OPS` (all caps, underscore separated)
- Handler functions: `register{Domain}Ops()` (camelCase)
- Action handlers: `handle{Action}()` (camelCase)
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
