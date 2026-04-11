// ─── Notifications Domain ────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "notifications";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description:
            "List recent notifications. Supports filtering by read/unread status and agent.",
        inputSchema: {
            is_read: z.boolean().optional().describe("Filter by read status"),
            agent_id: z.string().optional().describe("Filter by agent ID"),
            limit: z.number().optional().default(50).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (params.is_read !== undefined) query = query.eq("is_read", params.is_read as boolean);
            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            query = query.limit((params.limit as number) || 50);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ notifications: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description:
            "Create a new notification that will appear in the dashboard's notification panel.",
        inputSchema: {
            type: z.string().describe("Notification type (e.g. 'info', 'warning', 'success', 'error', 'task', 'agent')"),
            title: z.string().describe("Notification title"),
            message: z.string().optional().describe("Notification body message"),
            agent_id: z.string().optional().describe("Associated agent ID"),
            action_url: z.string().optional().describe("URL to navigate to when clicked"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("notifications")
                .insert({
                    type: params.type,
                    title: params.title,
                    message: params.message || null,
                    agent_id: params.agent_id || null,
                    action_url: params.action_url || null,
                    is_read: false,
                    user_id: userId,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "mark_read",
        description: "Mark a single notification as read.",
        inputSchema: {
            notification_id: z.number().describe("The notification ID (numeric)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("id", params.notification_id as number)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "mark_all_read",
        description: "Mark all unread notifications as read.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("notifications")
                .update({ is_read: true })
                .eq("user_id", userId)
                .eq("is_read", false)
                .select("id");
            if (error) return err(error.message);
            return ok({ marked_read: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "delete",
        description: "Delete a notification by ID.",
        inputSchema: {
            notification_id: z.number().describe("The notification ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("id", params.notification_id as number)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true });
        },
    },
];

registerTools(tools);
