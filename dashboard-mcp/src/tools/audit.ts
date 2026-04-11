// ─── Audit Domain ────────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "audit";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description:
            "List audit log entries. Supports filtering by agent, action type, or date range.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            action: z.string().optional().describe("Filter by action type"),
            since: z.string().optional().describe("ISO timestamp — only entries after this time"),
            limit: z.number().optional().default(50).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("audit_logs")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.action) query = query.eq("action", params.action as string);
            if (params.since) query = query.gte("created_at", params.since as string);
            query = query.limit((params.limit as number) || 50);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ entries: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description: "Write a new audit log entry for observability.",
        inputSchema: {
            action: z.string().describe("Action name (e.g. 'task_created', 'workflow_triggered')"),
            agent_id: z.string().optional().describe("Agent ID performing the action"),
            details: z.string().optional().describe("Human-readable details"),
            diff_payload: z.string().optional().describe("JSON diff or state change payload"),
            session_id: z.string().optional().describe("Session ID for grouping"),
            summit_id: z.string().optional().describe("Associated summit ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("audit_logs")
                .insert({
                    action: params.action,
                    agent_id: params.agent_id || null,
                    details: params.details || null,
                    diff_payload: params.diff_payload || null,
                    session_id: params.session_id || null,
                    summit_id: params.summit_id || null,
                    user_id: userId,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
];

registerTools(tools);
