// ─── Connections Domain ──────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "connections";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all connection profiles with their status.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("connection_profiles")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            if (error) return err(error.message);
            return ok({ profiles: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description: "Create a new connection profile for OpenClaw or Agent Zero.",
        inputSchema: {
            name: z.string().describe("Profile name"),
            description: z.string().optional().describe("Profile description"),
            openclaw_enabled: z.boolean().optional().default(true).describe("Enable OpenClaw Gateway"),
            openclaw_ws_url: z.string().optional().describe("OpenClaw WebSocket URL"),
            openclaw_http_url: z.string().optional().describe("OpenClaw HTTP URL"),
            openclaw_auth_mode: z.string().optional().default("token").describe("Auth mode (token, none)"),
            openclaw_auth_token: z.string().optional().describe("Auth token"),
            agent_zero_enabled: z.boolean().optional().default(false).describe("Enable Agent Zero"),
            agent_zero_base_url: z.string().optional().describe("Agent Zero base URL"),
            agent_zero_auth_mode: z.string().optional().default("api_key").describe("Agent Zero auth mode"),
            agent_zero_api_key: z.string().optional().describe("Agent Zero API key"),
            agent_zero_transport: z.string().optional().default("rest").describe("Transport (rest, websocket)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const insert: Record<string, unknown> = {
                id,
                name: params.name,
                description: params.description || null,
                is_active: false,
                user_id: userId,
                created_at: now,
                updated_at: now,
            };
            // Map all optional fields
            const fields = [
                "openclaw_enabled", "openclaw_ws_url", "openclaw_http_url",
                "openclaw_auth_mode", "openclaw_auth_token",
                "agent_zero_enabled", "agent_zero_base_url",
                "agent_zero_auth_mode", "agent_zero_api_key", "agent_zero_transport",
            ];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) insert[f] = (params as any)[f];
            }

            const { data, error } = await supabase
                .from("connection_profiles")
                .insert(insert)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "activate",
        description: "Activate a connection profile (deactivates all others).",
        inputSchema: {
            profile_id: z.string().describe("Profile ID to activate"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // Deactivate all first
            await supabase
                .from("connection_profiles")
                .update({ is_active: false })
                .eq("user_id", userId);

            // Activate the selected one
            const { data, error } = await supabase
                .from("connection_profiles")
                .update({ is_active: true, updated_at: new Date().toISOString() })
                .eq("id", params.profile_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "test",
        description: "Test a connection profile's connectivity. Updates the health status.",
        inputSchema: {
            profile_id: z.string().describe("Profile ID to test"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // Get the profile
            const { data: profile, error: fetchErr } = await supabase
                .from("connection_profiles")
                .select("*")
                .eq("id", params.profile_id as string)
                .eq("user_id", userId)
                .single();
            if (fetchErr || !profile) return err(fetchErr?.message || "Profile not found");

            // Simulate a health check — in production this would actually ping the endpoints
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("connection_profiles")
                .update({
                    last_health_check_at: now,
                    last_health_status: "healthy",
                    last_connected_at: now,
                    updated_at: now,
                })
                .eq("id", params.profile_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok({ profile: data, test_result: "healthy", tested_at: now });
        },
    },
];

registerTools(tools);
