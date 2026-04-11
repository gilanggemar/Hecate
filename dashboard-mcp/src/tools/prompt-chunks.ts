// ─── Prompt Chunks Domain ────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "prompt_chunks";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all reusable prompt chunks, optionally filtered by category.",
        inputSchema: {
            category: z.string().optional().describe("Filter by category"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("prompt_chunks")
                .select("*")
                .eq("user_id", userId)
                .order("order", { ascending: true });

            if (params.category) query = query.eq("category", params.category as string);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ chunks: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description: "Create a new reusable prompt chunk.",
        inputSchema: {
            name: z.string().describe("Chunk name"),
            content: z.string().describe("Prompt content"),
            category: z.string().optional().default("general").describe("Category"),
            color: z.string().optional().describe("Display color (hex)"),
            order: z.number().optional().default(0).describe("Sort order"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("prompt_chunks")
                .insert({
                    id,
                    name: params.name,
                    content: params.content,
                    category: params.category || "general",
                    color: params.color || "#a3e635",
                    order: params.order ?? 0,
                    user_id: userId,
                    created_at: now,
                    updated_at: now,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "update",
        description: "Update a prompt chunk's content, name, or category.",
        inputSchema: {
            chunk_id: z.string().describe("Chunk ID to update"),
            name: z.string().optional().describe("New name"),
            content: z.string().optional().describe("New content"),
            category: z.string().optional().describe("New category"),
            color: z.string().optional().describe("New color"),
            order: z.number().optional().describe("New sort order"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            const fields = ["name", "content", "category", "color", "order"];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) updates[f] = (params as any)[f];
            }
            const { data, error } = await supabase
                .from("prompt_chunks")
                .update(updates)
                .eq("id", params.chunk_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "delete",
        description: "Delete a prompt chunk.",
        inputSchema: {
            chunk_id: z.string().describe("Chunk ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("prompt_chunks")
                .delete()
                .eq("id", params.chunk_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, chunk_id: params.chunk_id });
        },
    },
];

registerTools(tools);
