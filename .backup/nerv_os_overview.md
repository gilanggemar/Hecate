# NERV.OS: Extremely Detailed System Architecture & Feature Overview

**Date of Analysis**: March 21, 2026
**Project Root**: ` NER.V.OS/dashboard`

This document provides a comprehensive, deep-dive analysis of the current state of the **NERV.OS** application. It covers the technical stack, routing configurations, database design, global state management, frontend UI/UX architecture, and a breakdown of every single feature derived from the codebase structure.

---

## 1. Technology Stack & Foundation

**NERV.OS** is built on a highly modern, scalable, and performance-oriented tech stack:
- **Framework**: **Next.js 16** utilizing the **App Router** (`app/` directory paradigm) for server components, advanced layout nesting, and API routes.
- **Language**: **TypeScript** (Strict mode) ensuring end-to-end type safety.
- **Styling**: **Tailwind CSS v4** coupled with **Framer Motion** and **tw-animate-css** for dynamic, fluid micro-animations. **Radix UI** primitives and **shadcn/ui** patterns form the accessible component foundation.
- **State Management**: **Zustand**. The app uses a highly modularized store pattern (over 25 distinct stores in `stores/`) rather than a single monolith.
- **Database**: **PostgreSQL** hosted via **Supabase**.
- **ORM**: **Drizzle ORM** (`drizzle-orm` & `drizzle-kit`) for schema definitions and migrations.
- **Authentication**: **Supabase Auth** (`@supabase/ssr`) deeply integrated into Next.js middleware and layouts via `AuthInitializer.tsx`.
- **Visualization**: Integrates `@xyflow/react` (React Flow) and `react-force-graph-2d` for complex node-based agent visualizations (Constellation). `recharts` is used for metrics and dashboard graphs.
- **Real-time / Connectivity**: `socket.io-client` and native `ws` for internal system websockets (OpenClaw, Agent Zero connections), plus SSE (Server-Sent Events) for MCP Server communication.

---

## 2. Core Features & Sub-Systems

By cross-referencing Drizzle schemas, Zustand stores, and Next.js routes, NERV.OS is divided into several massive interconnected sub-systems.

### 2.1. The Agent System
*The core of NERV.OS is managing autonomous AI agents.*
- **Schema Reference**: `agents`, `hero_images`, `agentProviderConfig`, `agentXP`
- **Details**: Agents are defined with names, codenames, roles, avatars, customized system prompts ("specialty"), and LLM temperature. Multiple "hero images" can be uploaded for UI carousels.
- **Configuration**: Agents aren't locked to one model; they utilize `agentProviderConfig` to set Primary and Backup AI Providers (e.g., fallback from Anthropic Claude to OpenAI GPT-4o if rate-limited).
- **Routes**: `/agents` (listing and management).

### 2.2. Gamification & Progression (Agent & User XP)
*Agents level up as they complete work.*
- **Schema Reference**: `xpEvents`, `dailyMissions`, `achievements`, `unlockedAchievements`, `operationsStreak`
- **Stores**: `useGamificationStore`
- **Details**: Agents earn XP (`agentXP`), gain levels, and achieve ranks (e.g., "INITIATE"). Daily missions are generated with varying difficulties and XP rewards. Achievements have rarities. Operations streaks track daily login/activity to incentivize engagement.

### 2.3. The Summit System (Multi-Agent Swarm Deliberation)
*A dedicated space for agents to discuss topics systematically.*
- **Schema Reference**: `summitSessions`, `summitMessages`
- **Stores**: `useSummitTaskStore`
- **Details**: A "Summit" allows multiple agents to enter a session, deliberate over a specific `topic`, and track `deliberationRound`. Agents utilize `modeIndicators` to signal disagreement, consensus, or insights.
- **Route**: `/summit`
- **Components**: `SummitTaskModal.tsx`, `ConsensusScore.tsx`.

### 2.4. OpenClaw & Agent Zero (Execution Engines)
*The physical execution bridging NERV.OS to the host machine or external runtimes.*
- **Stores**: `useOpenClawStore`, `useAgentZeroStore`, `useConnectionStore`
- **Schema**: `connectionProfiles`, `connectionSecrets`
- **Details**: 
  - **OpenClaw**: A local/remote engine that executes terminal commands, accesses the filesystem, and connects via WebSocket (`ws_logs_tool.json`). Supports tool availability gating through dashboard handshakes.
  - **Agent Zero**: A heavier framework integration. Supports `rest` or WebSocket transports and API keys for authentication. 
  - Connection profiles manage active URLs, endpoints, Auth modes (Token vs. API Key), and track health statuses.
- **API Routes**: `/api/agent-zero/health`, `/api/agent-zero/logs`, `/api/composio/handshake-payload`.

### 2.5. Constellation & Workflows (Visual Flow Builders)
*Two distinct ways to chain tasks and agents.*
- **Constellation (`/dashboard/constellation`)**: A node-based UI (`AgentConstellation.tsx`, `@xyflow/react`) allowing users to visibly string together Agents, Knowledge fragments, and Prompts into a "Constellation". (`constellations` schema).
- **Workflows (`/dashboard/workflows`)**: A step-by-step linear/acyclic execution engine. Features a builder (`/dashboard/workflows/[id]/builder`) with node tooling, checkpoint nodes (for human-in-the-loop loops), and workflow templates. (`workflows`, `workflowRuns` schema).
- **Stores**: `useConstellationStore`, `useWorkflowBuilderStore`, `useWorkflowStore`.

### 2.6. Capabilities System (MCPs, Skills, and Composio)
*Equipping agents with tools.*
- **Schema**: `capabilityMcps`, `capabilitySkills`, `agentCapabilityAssignments`
- **Stores**: `useCapabilitiesStore`, `useMCPStore`
- **Details**: 
  - **MCP Servers**: Full implementation of the Model Context Protocol. NERV.OS connects to external MCPs (via SSE or stdio), fetches available tools, and tracks health.
  - **Skills**: Custom scripts/tools configured natively within NERV.OS. 
  - Agents are dynamically assigned capabilities (`agent_capability_assignments`), overriding global configs where necessary.
- **Routes**: `/settings/mcp-servers`, `/dashboard/capabilities`.

### 2.7. Memory, Knowledge & Chat
*Long-term and short-term memory retrieval.*
- **Schema**: `conversations`, `conversationMessages`, `knowledgeFragments`, `knowledgeDocuments`, `promptChunks`
- **Stores**: `useMemoryStore`, `useChatStore`, `usePromptChunkStore`
- **Details**:
  - **Knowledge Base**: Files and text fragments are uploaded, tagged, rated by importance, and embedded/indexed (`indexed: boolean`).
  - **Chat**: 1-on-1 human-to-agent interface (`/chat`). Chat histories are independently isolated for distinct nodes.
  - **Prompt Chunks**: Reusable prompt snippets color-coded by category, injected into system prompts dynamically.

### 2.8. Telemetry, Audit & Observability
*For power-users monitoring cost and safety.*
- **Schema**: `telemetryLogs`, `auditLogs`
- **Stores**: `useAuditStore`, `useTelemetryStore`
- **Details**: Tracks `inputTokens`, `outputTokens`, `costUsd`, and `latencyMs` per request. Actions in the UI trigger `auditLogs` with payload diffs for rollback capabilities.
- **Routes**: `/dashboard/audit`, `/dashboard/observability`.
- **Components**: `SystemHealthBar.tsx`, `LogTerminal.tsx`.

### 2.9. Games (formerly War Room)
*A newly refactored decision-making and interaction space.*
- **Schema**: `gamesSessions`, `gamesEvents`
- **Route**: `/dashboard/games`
- **Details**: Recently renamed from "War Room." It acts as a staging ground where topics are presented, agents participate, events are tracked, and actionable items are linked to regular `tasks`.

### 2.10. Scheduler & Notifications
*Automating when things happen.*
- **Schema**: `notifications`, `alertRules`, `scheduledTasks`, `schedulerEvents`, `webhookConfigs`
- **Stores**: `useNotificationStore`, `useSchedulerStore`
- **Details**:
  - **Cron Tasks**: Agents can be assigned tasks running on Cron expressions.
  - **Calendar**: A timeline interface (`SchedulerTimeline.tsx`) mapping `schedulerEvents`.
  - **Webhooks**: Third-party services can hit authenticated `webhook_configs` to trigger agent tasks.
  - **Alerts**: Rules based on conditions and thresholds (e.g., token limits exceeded) with cooldowns and severity levels.
- **Routes**: `/dashboard/scheduler`, `/dashboard/notifications`.

---

## 3. Global State (Zustand Stores)

The application utilizes an extremely decoupled global state pattern. Key stores include:
- `useAgentStore`, `useAuthStore`, `useThemeStore`, `useLayoutStore` (Standard Application State)
- `useConstellationStore`, `useWorkflowBuilderStore` (Canvas & Graph State)
- `useOpenClawStore`, `useAgentZeroStore`, `useConnectionStore` (Engine Connection State)
- `useMCPStore`, `useCapabilitiesStore`, `useBridgesStore` (Integration State)
- `useGamificationStore` (XP & Progress)
- `useAuditStore`, `useTelemetryStore`, `useNotificationStore`, `useSchedulerStore` (System Logs & Time-based operations)
- `useSummitTaskStore` (Multi-agent chat state)

---

## 4. Routing Configuration (Next.js App Router)

The `app/` directory separates authenticated app functionality from public/auth routes:

**Authentication**
- `/(auth)/login/page.tsx`
- `/(auth)/signup/page.tsx`

**Main Dashboard/Application (`/dashboard` & root-level app pages)**
- `/dashboard/page.tsx` (Home overview)
- `/agents/page.tsx` (Agent Management)
- `/chat/page.tsx` (Individual chat windows)
- `/console/page.tsx` (Terminal/CLI view for direct monitoring)
- `/summit/page.tsx` (Multi-agent deliberation)
- `/dashboard/capabilities/page.tsx` (Tool assignment UI)
- `/dashboard/knowledge/page.tsx` & `/dashboard/memory/page.tsx` (RAG document management)
- `/dashboard/workflows/page.tsx` & `/dashboard/workflows/[id]/builder/page.tsx` 
- `/dashboard/constellation/page.tsx` (Node-based network view)
- `/dashboard/games/page.tsx` (Strategic decision sessions)
- `/dashboard/scheduler/page.tsx`
- `/dashboard/notifications/page.tsx`
- `/dashboard/audit/page.tsx` & `/dashboard/observability/page.tsx`

**Administration & Setup (`/settings`)**
- `/settings/page.tsx`
- `/settings/providers/page.tsx` (LLM configuration)
- `/settings/mcp-servers/page.tsx` (Connecting to Model Context Protocol servers)
- `/settings/bridges/page.tsx` (External platforms)

**API Layer (`/api`)**
Built heavily around REST patterns serving the frontend and potentially external webhooks.
- `api/agent-zero/*` (health, logs, poll, message, terminate)
- `api/agents/*`
- `api/audit/*`
- `api/capabilities/mcps/*`, `api/capabilities/skills/*`
- `api/chat/*`, `api/composio/*` (handshakes & payload bridging)
- `api/connection-profiles/*`
- `api/constellation/*`
- `api/llm/*`, `api/memory/*`, `api/notifications/*`, `api/workflows/*`

---

## 5. Summary / Conclusion

NERV.OS is a highly ambitious, production-ready "OS for Agents." It is not just a UI for LLMs; it functions exactly like an operating system:
1. **Compute & Processes**: Managed via the Task system, Workflows, and OpenClaw execution engine.
2. **Memory/Storage**: The robust Knowledge/RAG system nested natively with `pgvector` or similar fragment indexing.
3. **Networking**: Robust support for incoming Webhooks, external platform Bridges, and MCP servers.
4. **User & Entity Management**: Deep profiling of Agents with distinct System prompts, XP progression, and models.
5. **Observability**: Top-tier tracking of tokens, cost, API performance, and security audits.

The frontend is structurally built utilizing the latest React paradigms (Server Components everywhere possible, client components strictly for interactivity like the `@xyflow` boards and `Zustand` stores), allowing for rapid scaling and complex integrations without severe performance degradation.
