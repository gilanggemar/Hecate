// ─── Scheduler Domain ────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "scheduler";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list_events",
        description:
            "List scheduled events. Optionally filter by agent, date range, or status.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            status: z
                .enum(["scheduled", "completed", "cancelled", "in_progress"])
                .optional()
                .describe("Filter by event status"),
            from_date: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
            to_date: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
            limit: z.number().optional().default(50).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("scheduler_events")
                .select("*")
                .eq("user_id", userId)
                .order("scheduled_date", { ascending: true });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.status) query = query.eq("status", params.status as string);
            if (params.from_date) query = query.gte("scheduled_date", params.from_date as string);
            if (params.to_date) query = query.lte("scheduled_date", params.to_date as string);
            query = query.limit((params.limit as number) || 50);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ events: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "create_event",
        description:
            "Create a new scheduled event for an agent on a specific date.",
        inputSchema: {
            title: z.string().describe("Event title"),
            description: z.string().optional().describe("Event description"),
            agent_id: z.string().optional().describe("Agent to assign"),
            scheduled_date: z.string().describe("Date in YYYY-MM-DD format"),
            scheduled_time: z.string().optional().describe("Time in HH:MM format"),
            duration_minutes: z.number().optional().default(30).describe("Duration in minutes"),
            recurrence_type: z
                .enum(["none", "daily", "weekly", "monthly", "yearly"])
                .optional()
                .default("none")
                .describe("Recurrence pattern"),
            priority: z.number().optional().default(0).describe("Priority level"),
            color: z.string().optional().describe("Display color (hex)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const { data, error } = await supabase
                .from("scheduler_events")
                .insert({
                    id,
                    title: params.title,
                    description: params.description || null,
                    agent_id: params.agent_id || null,
                    scheduled_date: params.scheduled_date,
                    scheduled_time: params.scheduled_time || null,
                    duration_minutes: params.duration_minutes ?? 30,
                    recurrence_type: params.recurrence_type || "none",
                    status: "scheduled",
                    priority: params.priority ?? 0,
                    color: params.color || null,
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
        action: "update_event",
        description: "Update a scheduled event's details.",
        inputSchema: {
            event_id: z.string().describe("Event ID to update"),
            title: z.string().optional().describe("New title"),
            description: z.string().optional().describe("New description"),
            agent_id: z.string().optional().describe("Reassign to agent"),
            scheduled_date: z.string().optional().describe("New date (YYYY-MM-DD)"),
            scheduled_time: z.string().optional().describe("New time (HH:MM)"),
            duration_minutes: z.number().optional().describe("New duration"),
            status: z.enum(["scheduled", "completed", "cancelled", "in_progress"]).optional().describe("New status"),
            priority: z.number().optional().describe("New priority"),
            color: z.string().optional().describe("New color"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            const fields = ["title", "description", "agent_id", "scheduled_date", "scheduled_time", "duration_minutes", "status", "priority", "color"];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) updates[f] = (params as any)[f];
            }
            const { data, error } = await supabase
                .from("scheduler_events")
                .update(updates)
                .eq("id", params.event_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "delete_event",
        description: "Delete a scheduled event.",
        inputSchema: {
            event_id: z.string().describe("Event ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("scheduler_events")
                .delete()
                .eq("id", params.event_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, event_id: params.event_id });
        },
    },
    {
        domain: DOMAIN,
        action: "move_event",
        description: "Reschedule an event to a new date and/or time.",
        inputSchema: {
            event_id: z.string().describe("Event ID to move"),
            new_date: z.string().describe("New date (YYYY-MM-DD)"),
            new_time: z.string().optional().describe("New time (HH:MM)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = {
                scheduled_date: params.new_date,
                updated_at: new Date().toISOString(),
            };
            if (params.new_time !== undefined) updates.scheduled_time = params.new_time;

            const { data, error } = await supabase
                .from("scheduler_events")
                .update(updates)
                .eq("id", params.event_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "execute_event",
        description:
            "Manually trigger a scheduled event now by setting its status to in_progress and updating last_run_at.",
        inputSchema: {
            event_id: z.string().describe("Event ID to execute"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const now = Date.now();
            const { data, error } = await supabase
                .from("scheduler_events")
                .update({
                    status: "in_progress",
                    last_run_at: now,
                    run_count: undefined, // will increment below
                    updated_at: new Date().toISOString(),
                })
                .eq("id", params.event_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);

            // Increment run_count
            if (data) {
                await supabase
                    .from("scheduler_events")
                    .update({ run_count: (data.run_count || 0) + 1 })
                    .eq("id", params.event_id as string)
                    .eq("user_id", userId);
            }

            return ok({ ...data, run_count: (data?.run_count || 0) + 1, executed_at: now });
        },
    },
];

registerTools(tools);
