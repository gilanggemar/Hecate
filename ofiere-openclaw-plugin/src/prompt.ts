// src/prompt.ts — Dynamic system prompt for Ofiere PM plugin
//
// The prompt is built dynamically based on plugin state.
// Tool documentation is structured so adding a new meta-tool
// only requires adding a new entry to TOOL_DOCS below.

// ─── Tool Documentation Registry ────────────────────────────────────────────
// Add new meta-tool docs here when expanding. Each entry maps to one
// registered meta-tool and will be included in the system prompt.

const TOOL_DOCS: Record<string, string> = {
  OFIERE_TASK_OPS: `- **OFIERE_TASK_OPS** — Manage tasks (action: "list", "create", "update", "delete")
    - list: Filter by status, agent_id, space_id, folder_id, limit
    - create: Requires title + agent_id. Pass your name to self-assign, 'none' for unassigned
    - update: Requires task_id. Change title, status, priority, progress, etc.
    - delete: Requires task_id. Removes task and subtasks`,

  OFIERE_AGENT_OPS: `- **OFIERE_AGENT_OPS** — Query agents (action: "list")
    - list: See all agents with IDs, names, roles for task assignment`,

  // ── Future meta-tools — uncomment when registered ──
  // OFIERE_PROJECT_OPS: `- **OFIERE_PROJECT_OPS** — Manage projects (action: "list", "create", "update", "delete")
  //   - list: List spaces, folders, and projects
  //   - create: Create a new space or folder
  //   - update: Rename, move, or archive
  //   - delete: Remove space/folder and reassign tasks`,
  //
  // OFIERE_SCHEDULE_OPS: `- **OFIERE_SCHEDULE_OPS** — Calendar & timeline (action: "list", "schedule", "reschedule")
  //   - list: View scheduled events for a date range
  //   - schedule: Assign a task to a time slot
  //   - reschedule: Move an event to a new time`,
  //
  // OFIERE_KNOWLEDGE_OPS: `- **OFIERE_KNOWLEDGE_OPS** — Knowledge base (action: "search", "create", "update")
  //   - search: Find knowledge entries by query
  //   - create: Add a new knowledge entry
  //   - update: Edit an existing entry`,
};

export function getSystemPrompt(state: {
  ready: boolean;
  toolCount: number;
  agentId: string;
  connectError: string;
}): string {
  if (state.ready && state.toolCount > 0) {
    const agentLine = state.agentId
      ? `Your agent ID is "${state.agentId}". You are registered in the Ofiere system.`
      : `Your agent identity will be auto-detected at runtime. When you call any OFIERE tool, the system knows who you are.`;

    const assignRule = state.agentId
      ? `When you create a task without specifying agent_id, it is assigned to YOU (${state.agentId}).`
      : `When you create a task without specifying agent_id, it is assigned to YOU automatically.`;

    // Build tool docs from registry — only include docs for tools that exist
    const toolDocs = Object.values(TOOL_DOCS).join("\n");

    return `<ofiere-pm>
You are connected to the Ofiere Project Management dashboard via the Ofiere PM plugin.
${agentLine}

## Your Ofiere PM Tools (${state.toolCount} meta-tools)

Each tool uses an "action" parameter to select the operation. Always include action.

${toolDocs}

## Rules
- ${assignRule}
- To create an unassigned task, pass agent_id as "none" or "unassigned".
- When the user says "create a task for [agent name]", use OFIERE_AGENT_OPS action:"list" to find the agent ID, then use OFIERE_TASK_OPS action:"create" with that agent_id.
- Always confirm task creation/updates by reporting back what was done.
- Task statuses: PENDING, IN_PROGRESS, DONE, FAILED.
- Priority levels: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL.
- Changes appear in the Ofiere dashboard immediately via real-time sync.
- Do NOT fabricate task IDs — use OFIERE_TASK_OPS action:"list" to look up real IDs.
</ofiere-pm>`;
  }

  if (state.ready) {
    const diagnostic = diagnoseError(state.connectError);
    return `<ofiere-pm>
The Ofiere PM plugin failed to connect.${state.connectError ? ` Error: ${state.connectError}` : ""}

Diagnosis: ${diagnostic.reason}

When the user asks about task management or the Ofiere dashboard, respond with:
"${diagnostic.userMessage}"

Do NOT pretend Ofiere tools exist or hallucinate tool calls. You have zero Ofiere tools available.
</ofiere-pm>`;
  }

  return `<ofiere-pm>
The Ofiere PM plugin is loading. Tools should be available shortly.
If the user asks about tasks right now, ask them to wait a moment.
</ofiere-pm>`;
}

function diagnoseError(error: string): { reason: string; userMessage: string } {
  const lower = error.toLowerCase();

  if (!error) {
    return {
      reason: "Connected but no tools were registered.",
      userMessage:
        "The Ofiere PM plugin connected but could not register tools. " +
        "Run `openclaw ofiere doctor` to diagnose.",
    };
  }

  if (lower.includes("supabase") || lower.includes("url") || lower.includes("key")) {
    return {
      reason: "Supabase connection configuration issue.",
      userMessage:
        "The Ofiere PM plugin could not connect to Supabase. " +
        "Check your configuration with `openclaw ofiere status` and re-run " +
        "`openclaw ofiere setup` if needed, then `openclaw gateway restart`.",
    };
  }

  if (lower.includes("user_id") || lower.includes("userid")) {
    return {
      reason: "Missing or invalid user ID in configuration.",
      userMessage:
        "The Ofiere PM plugin needs a valid user ID. " +
        "Run `openclaw ofiere setup` with your user UUID, then `openclaw gateway restart`.",
    };
  }

  return {
    reason: `Unexpected error: ${error}`,
    userMessage: `The Ofiere PM plugin encountered an error: ${error}. Run \`openclaw ofiere doctor\` for details.`,
  };
}
