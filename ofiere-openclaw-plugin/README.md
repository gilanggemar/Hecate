# Ofiere PM Plugin for OpenClaw

Manage your Ofiere PM dashboard directly from OpenClaw agents. Create tasks, update progress, assign agents — all synced to the dashboard in real time.

## Install

```bash
openclaw plugins install @ofiere-ai/openclaw-plugin
```

Or install from the local repo (for development):

```bash
openclaw plugins install ./ofiere-openclaw-plugin
```

Restart OpenClaw after installing.

## Setup

```bash
openclaw ofiere setup --supabase-url "https://xxx.supabase.co" --service-key "eyJ..." --user-id "your-uuid" --agent-id "sasha"
```

Or run interactively:

```bash
openclaw ofiere setup
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## How it works

Once configured, the plugin connects to your Supabase database at gateway startup and registers PM tools directly into the agent. There's no separate MCP server process — it runs inside the OpenClaw gateway for maximum reliability.

Changes made by the agent are immediately visible on the Ofiere dashboard (Vercel) via Supabase real-time subscriptions.

## AI Meta-Tools

The plugin uses a scalable meta-tool architecture. Each tool handles one domain with an `action` parameter to select the operation.

| Tool | Actions | Description |
|---|---|---|
| `OFIERE_TASK_OPS` | `list`, `create`, `update`, `delete` | Manage PM tasks — list, create, update status/priority, delete |
| `OFIERE_AGENT_OPS` | `list` | Query available agents for task assignment |

### Example

```
// Create a task
OFIERE_TASK_OPS({ action: "create", title: "Deploy v2", agent_id: "ivy" })

// List tasks
OFIERE_TASK_OPS({ action: "list", status: "PENDING", limit: 10 })

// Update a task
OFIERE_TASK_OPS({ action: "update", task_id: "task-123", status: "DONE" })
```

## CLI Commands

```bash
openclaw ofiere setup     # Configure Supabase connection and agent identity
openclaw ofiere status    # View current configuration
openclaw ofiere doctor    # Test connection and list agents
```

## Configuration

Set via `openclaw ofiere setup` or environment variables:

| Option | Env Var | Description |
|---|---|---|
| `supabaseUrl` | `OFIERE_SUPABASE_URL` | Supabase project URL |
| `serviceRoleKey` | `OFIERE_SERVICE_ROLE_KEY` | Supabase service role key |
| `userId` | `OFIERE_USER_ID` | Your user UUID |
| `agentId` | `OFIERE_AGENT_ID` | This agent's ID (e.g. `sasha`) |
| `enabled` | — | Enable/disable the plugin (default: `true`) |

## Architecture

```
OpenClaw Agent (VPS)
     │ plugin runs IN-PROCESS
Ofiere Plugin ──► Supabase (shared database)
                      ▲
Ofiere Dashboard ─────┘  (Vercel, real-time)
```

Both the agent plugin and the Vercel dashboard talk to the same Supabase instance. When the agent creates/updates a task, the dashboard sees it instantly through Supabase real-time subscriptions.

## Links

- [Ofiere Dashboard](https://github.com/gilanggemar/Ofiere)
- [OpenClaw](https://openclaw.ai)
- [Supabase](https://supabase.com)
