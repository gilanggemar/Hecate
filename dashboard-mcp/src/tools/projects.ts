// ─── Projects Domain ─────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "projects";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all projects.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("projects")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ projects: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get",
        description: "Get a project's details, including associated files.",
        inputSchema: {
            project_id: z.string().describe("Project ID (UUID)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: project, error } = await supabase
                .from("projects")
                .select("*")
                .eq("id", params.project_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);

            const { data: files } = await supabase
                .from("project_files")
                .select("*")
                .eq("project_id", params.project_id as string);

            return ok({ ...project, files: files ?? [] });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description: "Create a new project with optional custom instructions.",
        inputSchema: {
            name: z.string().describe("Project name"),
            description: z.string().optional().describe("Project description"),
            custom_instructions: z.string().optional().describe("Custom instructions for agents in this project"),
            agent_id: z.string().optional().describe("Default agent for this project"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("projects")
                .insert({
                    user_id: userId,
                    name: params.name,
                    description: params.description || null,
                    custom_instructions: params.custom_instructions || null,
                    agent_id: params.agent_id || null,
                    context_files: [],
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
        description: "Update project details (name, description, instructions).",
        inputSchema: {
            project_id: z.string().describe("Project ID to update"),
            name: z.string().optional().describe("New name"),
            description: z.string().optional().describe("New description"),
            custom_instructions: z.string().optional().describe("New custom instructions"),
            agent_id: z.string().optional().describe("New default agent"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (params.name !== undefined) updates.name = params.name;
            if (params.description !== undefined) updates.description = params.description;
            if (params.custom_instructions !== undefined) updates.custom_instructions = params.custom_instructions;
            if (params.agent_id !== undefined) updates.agent_id = params.agent_id;

            const { data, error } = await supabase
                .from("projects")
                .update(updates)
                .eq("id", params.project_id as string)
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
        description: "Delete a project and its associated files.",
        inputSchema: {
            project_id: z.string().describe("Project ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // Delete files first
            await supabase
                .from("project_files")
                .delete()
                .eq("project_id", params.project_id as string);

            const { error } = await supabase
                .from("projects")
                .delete()
                .eq("id", params.project_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, project_id: params.project_id });
        },
    },
];

registerTools(tools);
