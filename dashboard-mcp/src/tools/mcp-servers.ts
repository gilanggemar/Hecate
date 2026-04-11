// ─── MCP Servers Domain ──────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "mcp_servers";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all registered MCP servers with their status and assigned agents.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("mcp_servers")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            if (error) return err(error.message);
            return ok({ servers: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "add",
        description: "Register a new MCP server.",
        inputSchema: {
            name: z.string().describe("Server display name"),
            url: z.string().describe("Server URL or command"),
            transport: z.enum(["stdio", "sse", "http"]).optional().default("sse").describe("Transport type"),
            description: z.string().optional().describe("Server description"),
            assigned_agents: z.array(z.string()).optional().describe("Agent IDs to assign"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const { data, error } = await supabase
                .from("mcp_servers")
                .insert({
                    id,
                    name: params.name,
                    url: params.url,
                    transport: params.transport || "sse",
                    description: params.description || null,
                    status: "disconnected",
                    tools: [],
                    assigned_agents: params.assigned_agents || [],
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
        action: "update",
        description: "Update an MCP server's config (name, URL, transport, assigned agents).",
        inputSchema: {
            server_id: z.string().describe("Server ID to update"),
            name: z.string().optional().describe("New name"),
            url: z.string().optional().describe("New URL"),
            transport: z.enum(["stdio", "sse", "http"]).optional().describe("New transport"),
            description: z.string().optional().describe("New description"),
            status: z.enum(["connected", "disconnected", "error", "testing"]).optional().describe("New status"),
            assigned_agents: z.array(z.string()).optional().describe("Updated agent assignments"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            const fields = ["name", "url", "transport", "description", "status", "assigned_agents"];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) updates[f] = (params as any)[f];
            }
            const { data, error } = await supabase
                .from("mcp_servers")
                .update(updates)
                .eq("id", params.server_id as string)
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
        description: "Remove a registered MCP server.",
        inputSchema: {
            server_id: z.string().describe("Server ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("mcp_servers")
                .delete()
                .eq("id", params.server_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, server_id: params.server_id });
        },
    },
];

registerTools(tools);
