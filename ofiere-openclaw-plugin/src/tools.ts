// src/tools.ts — Meta-tool registration for Ofiere PM plugin
// Architecture: Each meta-tool handles one domain (tasks, agents, etc.)
// with an "action" parameter that routes to the correct handler.
//
// To add a new domain:
//   1. Create a handler function (e.g. registerProjectOps)
//   2. Add it to the registerAllTools() call at the bottom
//   3. Update prompt.ts to document the new meta-tool
//
// This pattern keeps the tool count low (1 tool per domain)
// while supporting unlimited operations within each domain.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfiereConfig } from "./types.js";
import { resolveAgentId } from "./agent-resolver.js";

// ─── Tool result shape (matches OpenClaw SDK) ────────────────────────────────

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

// ─── Helper: extract calling agent's accountId from OpenClaw context ─────────

// Module-level: set once at registration time from index.ts
let _registrationAgentName = "";
export function setRegistrationAgentName(name: string) {
  if (name && !_registrationAgentName) _registrationAgentName = name;
}

function getCallingAgentName(api: any): string {
  // OpenClaw passes agent context in various ways — try ALL known paths
  try {
    const candidates = [
      api?.agentContext?.accountId,
      api?.agentContext?.name,
      api?.agentContext?.id,
      api?.currentAgent?.accountId,
      api?.currentAgent?.name,
      api?.currentAgent?.id,
      api?.agent?.accountId,
      api?.agent?.name,
      api?.agent?.id,
      api?.agentId,
      api?.agentName,
      api?.accountId,
      api?.name,
      api?.id,
      api?.metadata?.agentId,
      api?.metadata?.accountId,
      api?.metadata?.agentName,
      api?.context?.agentId,
      api?.context?.accountId,
      api?.context?.agent?.name,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Probe the API object for any agent identity info. Called once at registration.
 * Logs ALL available keys for debugging.
 */
export function probeApiForAgentName(api: any, logger?: any): string {
  // Direct detection
  const name = getCallingAgentName(api);
  if (name) {
    logger?.info?.(`[ofiere] Detected agent from API: "${name}"`);
    setRegistrationAgentName(name);
    return name;
  }

  // Log all top-level keys for future debugging
  try {
    const keys = Object.keys(api || {});
    logger?.debug?.(`[ofiere] API object keys: ${JSON.stringify(keys)}`);
    // Check if any key looks like it contains agent info
    for (const key of keys) {
      const val = api[key];
      if (typeof val === "string" && val.length > 0 && val.length < 50) {
        logger?.debug?.(`[ofiere] API.${key} = "${val}"`);
      }
    }
  } catch {
    // ignore
  }
  return "";
}

// ─── Shared: Agent ID Resolution ─────────────────────────────────────────────

function createAgentResolver(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
) {
  /**
   * Resolve the agent ID for the calling agent.
   * Priority: explicit param > runtime context > registration-time detection > env var > DB fallback
   */
  return async function resolveAgent(explicitId?: string): Promise<string | null> {
    // 1. Explicit agent_id passed by the LLM (e.g. "ivy", "daisy", or a UUID)
    if (explicitId && explicitId.trim()) {
      const trimmed = explicitId.trim();
      // If it looks like a UUID or our ID format, use directly
      if (trimmed.match(/^[0-9a-f]{8}-/) || trimmed.match(/^agent-/)) {
        return trimmed;
      }
      // Otherwise treat as a name and resolve to the actual agent ID
      try {
        return await resolveAgentId(trimmed, userId, supabase);
      } catch {
        return trimmed; // fallback: use as-is
      }
    }

    // 2. Runtime: read calling agent's name from OpenClaw context
    const callerName = getCallingAgentName(api);
    if (callerName) {
      try {
        return await resolveAgentId(callerName, userId, supabase);
      } catch {
        // Fall through
      }
    }

    // 3. Registration-time detection (set when plugin was loaded)
    if (_registrationAgentName) {
      try {
        return await resolveAgentId(_registrationAgentName, userId, supabase);
      } catch {
        // Fall through
      }
    }

    // 4. Env var fallback (OFIERE_AGENT_ID — legacy single-agent mode)
    if (fallbackAgentId) return fallbackAgentId;

    // 5. Nuclear fallback: query the FIRST agent for this user
    try {
      const { data } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .order("name", { ascending: true })
        .limit(1)
        .single();
      if (data?.id) return data.id;
    } catch {
      // ignore
    }

    return null;
  };
}

// ─── META-TOOL: OFIERE_TASK_OPS ──────────────────────────────────────────────

function registerTaskOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  resolveAgent: (id?: string) => Promise<string | null>,
): void {
  api.registerTool({
    name: "OFIERE_TASK_OPS",
    label: "Ofiere Task Operations",
    description:
      `Manage tasks in the Ofiere PM dashboard. All task operations go through this tool.\n\n` +
      `Actions:\n` +
      `- "list": List/filter tasks. Optional params: status, agent_id, space_id, folder_id, limit\n` +
      `- "create": Create a new task. Required: title, agent_id. Optional: description, status, priority, space_id, folder_id, start_date, due_date, tags\n` +
      `- "update": Update an existing task. Required: task_id. Optional: title, description, status, priority, progress, agent_id, start_date, due_date, tags\n` +
      `- "delete": Delete a task and its subtasks. Required: task_id\n\n` +
      `agent_id for create: Pass your own name (e.g. 'ivy') to self-assign, another agent's name to assign to them, or 'none'/'unassigned' for no assignee.\n` +
      `Status values: PENDING, IN_PROGRESS, DONE, FAILED\n` +
      `Priority values: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list", "create", "update", "delete"],
        },
        // ── Shared / contextual params ──
        task_id: { type: "string", description: "Task ID (required for update, delete)" },
        title: { type: "string", description: "Task title (required for create)" },
        description: { type: "string", description: "Task description" },
        agent_id: {
          type: "string",
          description:
            "Agent name or ID. For create: your name to self-assign, another name to delegate, 'none' for unassigned. For list: filter by agent.",
        },
        status: {
          type: "string",
          description: "Task status",
          enum: ["PENDING", "IN_PROGRESS", "DONE", "FAILED"],
        },
        priority: { type: "number", description: "Priority: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL" },
        progress: { type: "number", description: "Progress percentage 0-100 (update only)" },
        space_id: { type: "string", description: "PM Space ID" },
        folder_id: { type: "string", description: "PM Folder ID" },
        start_date: { type: "string", description: "Start date (ISO 8601)" },
        due_date: { type: "string", description: "Due date (ISO 8601)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the task",
        },
        limit: { type: "number", description: "Max results for list (default 50)" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list":
          return handleListTasks(supabase, userId, params);
        case "create":
          return handleCreateTask(supabase, userId, resolveAgent, params);
        case "update":
          return handleUpdateTask(supabase, userId, params);
        case "delete":
          return handleDeleteTask(supabase, userId, params);
        default:
          return err(
            `Unknown action "${action}". Valid actions: list, create, update, delete`,
          );
      }
    },
  });
}

// ── Task action handlers ─────────────────────────────────────────────────────

async function handleListTasks(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, agent_id, space_id, folder_id, " +
        "start_date, due_date, progress, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (params.space_id) query = query.eq("space_id", params.space_id as string);
    if (params.folder_id) query = query.eq("folder_id", params.folder_id as string);
    if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
    if (params.status) query = query.eq("status", params.status as string);
    query = query.limit((params.limit as number) || 50);

    const { data, error } = await query;
    if (error) return err(error.message);
    return ok({ tasks: data || [], count: (data || []).length });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleCreateTask(
  supabase: SupabaseClient,
  userId: string,
  resolveAgent: (id?: string) => Promise<string | null>,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.title) return err("Missing required field: title");

    const id = `task-${Date.now()}`;
    const now = new Date().toISOString();

    // Handle explicit "none"/"unassigned"
    const rawAgentId = params.agent_id as string | undefined;
    const isUnassigned =
      rawAgentId &&
      ["none", "unassigned", "null", ""].includes(rawAgentId.toLowerCase().trim());

    const assignee = isUnassigned ? null : await resolveAgent(rawAgentId);

    const insertData: Record<string, unknown> = {
      id,
      user_id: userId,
      title: params.title,
      description: (params.description as string) || null,
      agent_id: assignee,
      assignee_type: "agent",
      status: (params.status as string) || "PENDING",
      priority: params.priority !== undefined ? params.priority : 1,
      space_id: (params.space_id as string) || null,
      folder_id: (params.folder_id as string) || null,
      start_date: (params.start_date as string) || null,
      due_date: (params.due_date as string) || null,
      tags: (params.tags as string[]) || [],
      progress: 0,
      sort_order: 0,
      custom_fields: {},
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from("tasks").insert(insertData);

    if (error) {
      if (error.message?.includes("agent_id") || error.message?.includes("foreign key")) {
        insertData.agent_id = null;
        const retry = await supabase.from("tasks").insert(insertData);
        if (retry.error) return err(retry.error.message);
        return ok({
          id,
          message: `Task "${params.title}" created (agent_id "${assignee}" was invalid, assigned to none)`,
          task: insertData,
        });
      }
      return err(error.message);
    }

    return ok({
      id,
      message: `Task "${params.title}" created and assigned to ${assignee || "no one"}`,
      task: insertData,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleUpdateTask(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.task_id) return err("Missing required field: task_id");

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = [
      "title", "description", "status", "priority", "progress",
      "agent_id", "start_date", "due_date", "tags",
    ];
    for (const f of fields) {
      if (params[f] !== undefined) updates[f] = params[f];
    }
    if (params.status === "DONE") updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", params.task_id as string)
      .eq("user_id", userId)
      .select("id, title, status, priority, agent_id")
      .single();

    if (error) return err(error.message);
    return ok({ message: `Task "${data?.title}" updated`, task: data });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleDeleteTask(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.task_id) return err("Missing required field: task_id");
    const taskId = params.task_id as string;

    await supabase.from("scheduler_events").delete().eq("task_id", taskId);

    const { data: subtasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("parent_task_id", taskId)
      .eq("user_id", userId);

    if (subtasks && subtasks.length > 0) {
      for (const sub of subtasks) {
        await supabase.from("scheduler_events").delete().eq("task_id", sub.id);
      }
      await supabase
        .from("tasks")
        .delete()
        .in("id", subtasks.map((s: { id: string }) => s.id))
        .eq("user_id", userId);
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) return err(error.message);
    return ok({ message: `Task ${taskId} deleted`, deleted: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ─── META-TOOL: OFIERE_AGENT_OPS ────────────────────────────────────────────

function registerAgentOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
): void {
  api.registerTool({
    name: "OFIERE_AGENT_OPS",
    label: "Ofiere Agent Operations",
    description:
      `Query agents in the Ofiere PM system.\n\n` +
      `Actions:\n` +
      `- "list": List all available agents with their IDs, names, roles, and status. Use this to find the correct agent_id for task assignment.`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list"],
        },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list":
          return handleListAgents(api, supabase, userId, fallbackAgentId);
        default:
          return err(`Unknown action "${action}". Valid actions: list`);
      }
    },
  });
}

async function handleListAgents(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
): Promise<ToolResult> {
  try {
    // Resolve calling agent's ID for the "your_agent_id" hint
    const callerName = getCallingAgentName(api);
    let yourAgentId = fallbackAgentId || "";
    if (callerName && !yourAgentId) {
      try {
        yourAgentId = await resolveAgentId(callerName, userId, supabase);
      } catch { /* ignore */ }
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id, name, codename, role, status")
      .eq("user_id", userId)
      .order("name");

    if (error) return err(error.message);
    return ok({
      agents: data || [],
      count: (data || []).length,
      your_agent_id: yourAgentId,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ─── Public: Register All Meta-Tools ─────────────────────────────────────────
// This is the single entry point called by index.ts.
// Returns the number of tools registered for dynamic prompt generation.
//
// To expand: add new register*Ops() calls here and increment the count.

export function registerTools(
  api: any, // OpenClawPluginApi — typed as any to avoid import-path issues at install time
  supabase: SupabaseClient,
  config: OfiereConfig,
): number {
  const userId = config.userId;
  const fallbackAgentId = config.agentId; // May be empty — that's fine

  const resolveAgent = createAgentResolver(api, supabase, userId, fallbackAgentId);

  // ── Register each domain meta-tool ──
  registerTaskOps(api, supabase, userId, resolveAgent);
  registerAgentOps(api, supabase, userId, fallbackAgentId);

  // ── Count and log ──
  const toolCount = 2; // Update this when adding new meta-tools
  const callerName = getCallingAgentName(api);
  const agentLabel = fallbackAgentId || callerName || "auto-detect";
  api.logger.info(`[ofiere] ${toolCount} meta-tools registered (agent: ${agentLabel})`);

  return toolCount;
}
