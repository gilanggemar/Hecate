# Dashboard MCP — Project Brief

## What We're Building

A custom MCP (Model Context Protocol) server scoped specifically to the OpenClaw dashboard. Once installed into an OpenClaw agent, the agent gains a set of native tools that let it read and control every feature inside the dashboard — without touching raw database queries or UI components directly.

## The Core Idea

The Dashboard MCP acts as a semantic, domain-specific interface between the OpenClaw agent and the dashboard's underlying state layer (e.g., Supabase). The dashboard UI listens to that state in real time and re-renders automatically when the agent makes changes through the MCP.

This mirrors exactly how Supabase MCP works: the agent doesn't control the UI — it controls the data, and the UI reacts.

## Key Features the MCP Must Cover

- **Execution Plan Management** — create, read, edit, reorder, and delete individual lines of an execution plan, line by line, independently
- **Task List Control** — add, complete, remove, and reprioritize tasks
- **Agent Interaction Logging** — allow agents to write log entries visible in the dashboard
- **Dashboard State Awareness** — agents can query current plan status, task states, and other live dashboard data

## Architecture Overview

```
OpenClaw Agent
     │
     ▼  MCP tool calls (e.g., edit_plan_line, mark_task_complete)
Dashboard MCP Server
     │
     ▼  reads / writes
Shared State Layer (Supabase or equivalent)
     │
     ▼  real-time subscription
Dashboard UI (auto re-renders)
```

## Design Principles

- Tools are **high-level and intention-driven**, not raw SQL or DOM manipulation
- Each tool maps to a specific dashboard concept (plan, task, log, agent)
- The MCP server is a **thin semantic wrapper** over the existing state layer
- Agents interact with dashboard features the same way a human user would — just programmatically

## Next Step

Extend this brief into a full implementation plan covering: MCP server setup, tool schema definitions, Supabase table design, real-time sync strategy, and OpenClaw agent integration.
