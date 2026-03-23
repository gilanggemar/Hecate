# OpenClaw → NERV.OS: Complete Integration Surface Audit

**What this document is**: An exhaustive inventory of every feature the OpenClaw Gateway exposes over its WebSocket RPC that NERV.OS could display or control. Organized by category, with RPC methods, what data you get, and whether it's read-only or read/write.

**Source**: Cross-referenced from the official OpenClaw docs (docs.openclaw.ai), the Gateway protocol specification, the Control UI source (DeepWiki analysis of `ui/src/ui/views/` and `ui/src/ui/controllers/`), and the RPC method registry (`src/gateway/server-methods-list.ts` — 100+ methods).

**What you have already built** is marked with ✅. Everything else is new opportunity.

---

## ✅ ALREADY BUILT

| Feature | RPC Methods | Status |
|---|---|---|
| Tools (global & per-agent toggle) | `tools.catalog`, `config.get`, `config.patch` | Done |
| Skills (global & per-agent toggle) | `skills.status`, `skills.update`, `config.patch` | Done |
| Core Files (workspace file editor) | `agents.files.list`, `agents.files.read`, `agents.files.write` | Done |
| Model Selector (agent card) | `config.get`, `config.patch`, `models.list` | Done |

---

## 1. CHAT — Talk to the Agent from Your Dashboard

**What it is**: A full chat interface embedded in NERV.OS that talks to the OpenClaw agent, exactly like the Control UI's Chat tab or like sending a WhatsApp message — but from your dashboard.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `chat.send` | Send a message to the agent. Non-blocking — returns `{ runId, status: "started" }` immediately, then streams the response via `chat` events. |
| `chat.history` | Fetch conversation history for a session. |
| `chat.abort` | Stop the agent mid-response. |
| `chat.inject` | Append an assistant note to the transcript without triggering an agent run. |

**Events** (streamed via WebSocket, not request/response):

| Event | What it contains |
|---|---|
| `chat` | Streamed response chunks: text blocks, tool calls, tool results, status changes. |

**What you'd display**: A chat window per agent/session with streamed responses, tool call cards (showing what tool the agent called and its result), and a stop button.

**Read/Write**: Read + Write. You send messages and receive streamed responses.

**Complexity**: HIGH. Streaming responses with tool call rendering is complex UI work. But this is arguably the most impactful feature — it turns NERV.OS into a full command center.

---

## 2. SESSIONS — View & Manage All Active Conversations

**What it is**: Every conversation the OpenClaw agent has (across WhatsApp, Telegram, Discord, CLI, etc.) is an isolated "session" with its own history. You can list, inspect, and configure them.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `sessions.list` | List all active sessions with metadata (session key, agent ID, updated timestamp, total tokens, model, channel). |
| `sessions.patch` | Patch per-session overrides: thinking level, fast mode, verbose mode, reasoning level. |

**What you'd display**: A table/list of all active sessions showing: session key, which agent owns it, which channel it came from (WhatsApp, Telegram, etc.), last activity time, total tokens consumed, and the model used. Each session could have controls to toggle thinking/fast/verbose modes.

**Read/Write**: Read + Write (session-level overrides only — you can't delete sessions or read full transcripts via RPC without `chat.history`).

**Complexity**: MEDIUM. Straightforward list + patch operations.

---

## 3. CHANNELS — Messaging Platform Status & Control

**What it is**: OpenClaw connects to WhatsApp, Telegram, Discord, Slack, Signal, iMessage, and 15+ other platforms. Each channel has a connection status, QR login flow (WhatsApp), and per-channel config.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `channels.status` | Returns the status of all connected channels: connected/disconnected, account info, health metrics, last event timestamps. |
| `web.login.qr` | Get the WhatsApp QR code for pairing (if WhatsApp channel is configured). |
| `web.login.status` | Check WhatsApp login/pairing status. |
| `config.patch` | Update per-channel config (e.g., `channels.telegram.enabled`, DM policies, group rules). |

**What you'd display**: A channel status dashboard showing each connected platform with a green/red indicator, account name, last message time, and health status. For WhatsApp, a QR code scanner for initial pairing.

**Read/Write**: Read + Write (channel config changes via `config.patch`).

**Complexity**: MEDIUM. The status display is straightforward. WhatsApp QR pairing adds complexity.

---

## 4. CRON JOBS — Scheduled Agent Tasks

**What it is**: OpenClaw has a built-in cron scheduler that can run agent tasks on a schedule (e.g., "Send me a daily briefing at 9am", "Check email every 30 minutes"). Jobs can inject into the main session or run as isolated agent turns.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `cron.status` | List all cron jobs with their state (enabled, next run time, last run result, consecutive errors). |
| `cron.add` | Create a new cron job (prompt, schedule expression, agent ID, delivery config). |
| `cron.edit` | Edit an existing cron job. |
| `cron.rm` | Delete a cron job. |
| `cron.enable` | Enable a disabled cron job. |
| `cron.disable` | Disable a cron job without deleting it. |
| `cron.run` | Force-run a cron job immediately (bypass schedule). |
| `cron.runs` | Get the run history/log for a specific job. |

**What you'd display**: A cron job manager: list of jobs with name, schedule (human-readable cron expression), next run time, last run status (success/error), and toggle switches to enable/disable. Plus a "Run Now" button and a form to create/edit jobs.

**Read/Write**: Full CRUD. This is a powerful feature — your NERV.OS Scheduler system could be powered by real OpenClaw cron jobs instead of local-only scheduled tasks.

**Complexity**: MEDIUM-HIGH. The CRUD is straightforward but the job creation form has many fields (prompt, schedule, delivery mode, agent targeting, model overrides, etc.).

---

## 5. GATEWAY HEALTH & STATUS — System Monitoring

**What it is**: Real-time health information about the OpenClaw Gateway process itself: uptime, connected channels, model status, auth status, and diagnostics.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `status` | Basic Gateway status snapshot. |
| `health` | Full health snapshot: channel health, model availability, auth profile status, session counts, memory usage. |
| `models.list` | List all configured/available models with their status. |

**What you'd display**: A health dashboard card (or section on the existing NERV.OS observability page) showing: Gateway uptime, number of active sessions, connected channels count, primary model status (healthy/error/rate-limited), auth profile expiry warnings.

**Read/Write**: Read-only.

**Complexity**: LOW. Simple status display.

---

## 6. PRESENCE — Connected Devices & Clients

**What it is**: A real-time view of all devices and clients currently connected to the Gateway: CLI sessions, the Control UI, mobile nodes (iOS/Android), the macOS menu bar app, and your NERV.OS dashboard itself.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `system-presence` | Returns all connected clients with their device ID, role (operator/node), scopes, platform, and connection time. |

**What you'd display**: A "Connected Devices" panel showing each connected client: device name/ID, platform (macOS, iOS, Android, CLI, browser), role (operator or node), capabilities (camera, canvas, screen, voice for nodes), and when it connected.

**Read/Write**: Read-only.

**Complexity**: LOW. Simple list display.

---

## 7. NODES — Mobile & Remote Device Capabilities

**What it is**: iOS, Android, and macOS devices can pair with the Gateway as "nodes" that expose hardware capabilities (camera, screen capture, canvas rendering, location, voice). The agent can invoke these capabilities remotely.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `node.list` | List all paired nodes with their capabilities and online status. |

**What you'd display**: A device management panel showing each paired node: device name, platform, online/offline status, and a list of capabilities it exposes (camera, screen, canvas, location, voice). This pairs nicely with the Presence feature.

**Read/Write**: Read-only (control happens via the agent, not directly from the dashboard).

**Complexity**: LOW.

---

## 8. EXEC APPROVALS — Human-in-the-Loop Command Authorization

**What it is**: When the agent wants to run a shell command, OpenClaw can require human approval before executing it. Approval requests are broadcast to all connected operator clients. Your dashboard could be an approval surface.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `exec.approvals.get` | Get the current exec approval policy (gateway + node allowlists, ask policy). |
| `exec.approvals.set` | Update the exec approval policy. |
| `exec.approval.resolve` | Approve or deny a specific exec request. |

**Events**:

| Event | What it contains |
|---|---|
| `exec.approval.requested` | Broadcast when the agent wants to run a command that needs approval. Contains the command, working directory, session metadata. |

**What you'd display**: A notification/modal that pops up when the agent wants to run a command: "Agent wants to execute: `rm -rf /tmp/cache`. [Approve] [Deny]". Plus a settings panel for the approval policy (auto-approve certain commands, allowlist patterns).

**Read/Write**: Read + Write. This is an interactive control surface.

**Complexity**: MEDIUM. The approval popup needs to be real-time (WebSocket event-driven), but the logic is simple.

---

## 9. LOGS — Live Gateway Log Tail

**What it is**: A live-streaming view of the Gateway's log output, similar to running `tail -f` on a log file. Useful for debugging.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `logs.tail` | Start streaming live logs from the Gateway. Supports filter and export. |

**What you'd display**: A terminal-style log viewer with live-updating lines, filter by log level (info/warn/error), and an export button. This maps directly to your existing NERV.OS `LogTerminal.tsx` component — you could feed it real OpenClaw logs instead of simulated data.

**Read/Write**: Read-only (streaming).

**Complexity**: LOW-MEDIUM. You already have a log terminal component; this just connects it to a real data source.

---

## 10. CONFIG EDITOR — Raw Configuration Management

**What it is**: Direct access to view and edit the full `openclaw.json` configuration file. The Control UI has both a form-based editor (generated from the config schema) and a raw JSON editor.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `config.get` | Get the full config + hash. |
| `config.set` | Set a single config key by dot-path. |
| `config.patch` | Merge-patch a partial update. |
| `config.apply` | Replace the entire config + restart (use with extreme care). |
| `config.schema` | Get the JSON Schema for the config (used to generate form UIs). |

**What you'd display**: A settings/config page with either a form-based editor (using the schema to auto-generate fields) or a raw JSON editor (like VS Code's settings.json editor). The form approach is better UX but much more work.

**Read/Write**: Full read/write.

**Complexity**: LOW for raw JSON editor, VERY HIGH for form-based (auto-generating a form from JSON Schema is a large project).

---

## 11. AGENT IDENTITY — Name, Emoji, Avatar

**What it is**: Each OpenClaw agent has an identity (name, emoji, avatar URL) that is resolved at runtime. This is what gives agents their personality in the Control UI's agent selector.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `agents.list` | List all agents with their ID, default flag, and runtime metadata. |
| `agents.identity` | Get a specific agent's runtime identity: resolved name, avatar URL, emoji. |

**What you'd display**: The agent identity data could be synced into your NERV.OS agent cards — showing the OpenClaw agent's emoji and resolved name alongside the NERV.OS agent's avatar and codename. Useful for confirming the mapping between NERV.OS agents and OpenClaw agents.

**Read/Write**: Read-only (identity is derived from workspace files, not directly editable via this RPC).

**Complexity**: LOW.

---

## 12. MEMORY — Search Agent Memory

**What it is**: OpenClaw agents have a memory system (either builtin SQLite or QMD — Quick Markdown with vector/hybrid search). The CLI exposes `memory status`, `memory index`, and `memory search`.

**RPC Methods** (inferred from CLI surface — these map to underlying RPC or exec calls):

| Method | Purpose |
|---|---|
| `doctor.memory.status` | Get memory system health: index size, backend type, status. |

**What you'd display**: A memory health indicator on the agent card or observability page: memory backend type, index size, last indexed timestamp. Full memory search UI would require using `chat.send` to ask the agent to search its memory (the `memory_search` tool is an agent tool, not a direct operator RPC).

**Read/Write**: Read-only for status. Memory search requires going through the agent (chat.send).

**Complexity**: LOW for status display. HIGH for a full memory search UI (would need to wrap `chat.send`).

---

## 13. UPDATE — Gateway Self-Update

**What it is**: The Gateway can update itself (npm/git update + restart) via RPC. The Control UI has an "Update" button.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `update.run` | Run a package/git update + restart. Returns a restart report. |

**What you'd display**: An "Update OpenClaw" button on a settings page. On click, it triggers the update and shows progress/result. Useful for keeping the Gateway up to date from the dashboard.

**Read/Write**: Write (triggers an update + restart).

**Complexity**: LOW (single button + result display). But be careful — this restarts the Gateway.

---

## 14. DEVICE PAIRING — Approve New Devices

**What it is**: When a new device (phone, laptop, browser) connects to the Gateway for the first time, it needs pairing approval. The Control UI and macOS app can approve pairing requests.

**RPC Methods**:

| Method | Purpose |
|---|---|
| `device.token.rotate` | Rotate a device's auth token. |
| `device.token.revoke` | Revoke a device's token (force disconnect). |

**Events**:

| Event | What it contains |
|---|---|
| `node.pair.request` | Broadcast when a new device requests pairing. |

**What you'd display**: A device management panel where you can see paired devices, approve/deny new pairing requests, and revoke access for old devices.

**Read/Write**: Read + Write.

**Complexity**: MEDIUM.

---

## Priority Recommendation (What to Build Next)

Based on impact vs. effort:

| Priority | Feature | Why |
|---|---|---|
| 🔴 HIGH | **Sessions** (#2) | Low effort, immediately useful — see all conversations across all channels in one place |
| 🔴 HIGH | **Channels Status** (#3) | Low-medium effort, critical for monitoring — see which platforms are connected |
| 🔴 HIGH | **Gateway Health** (#5) | Low effort — feeds into your existing observability system |
| 🟠 MEDIUM | **Cron Jobs** (#4) | Medium effort, replaces your local scheduler with real OpenClaw cron |
| 🟠 MEDIUM | **Exec Approvals** (#8) | Medium effort, high value for safety — approve commands from the dashboard |
| 🟠 MEDIUM | **Logs** (#9) | Low-medium effort, plugs into your existing LogTerminal component |
| 🟠 MEDIUM | **Presence** (#6) | Low effort — nice-to-have device awareness panel |
| 🟡 LOW | **Chat** (#1) | Highest effort but highest impact — a full embedded chat interface |
| 🟡 LOW | **Nodes** (#7) | Low effort but niche — only useful if you have mobile devices paired |
| 🟡 LOW | **Config Editor** (#10) | Low effort for raw JSON, but risky — raw config edits can break the Gateway |
| 🟡 LOW | **Agent Identity** (#11) | Trivial effort — cosmetic enhancement to agent cards |
| ⚪ OPTIONAL | **Memory Status** (#12) | Trivial read-only status indicator |
| ⚪ OPTIONAL | **Update** (#13) | Single button, but restarting from the dashboard is risky |
| ⚪ OPTIONAL | **Device Pairing** (#14) | Useful for multi-device setups only |
