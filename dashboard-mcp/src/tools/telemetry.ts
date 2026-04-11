// ─── Telemetry Domain ────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "telemetry";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "get_summary",
        description:
            "Get aggregated telemetry summary — total tokens, cost, latency stats, broken down by agent and model.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            since: z.string().optional().describe("ISO timestamp — only include data after this time"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("telemetry_logs")
                .select("*")
                .eq("user_id", userId);

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.since) query = query.gte("created_at", params.since as string);

            const { data, error } = await query;
            if (error) return err(error.message);

            const logs = data || [];
            const totalInput = logs.reduce((s, l) => s + (l.input_tokens || 0), 0);
            const totalOutput = logs.reduce((s, l) => s + (l.output_tokens || 0), 0);
            const totalCost = logs.reduce((s, l) => s + (l.cost_usd || 0), 0);
            const avgLatency = logs.length > 0
                ? logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / logs.length
                : 0;

            // Group by model
            const byModel: Record<string, { count: number; input: number; output: number; cost: number }> = {};
            for (const l of logs) {
                const m = l.model || "unknown";
                if (!byModel[m]) byModel[m] = { count: 0, input: 0, output: 0, cost: 0 };
                byModel[m].count++;
                byModel[m].input += l.input_tokens || 0;
                byModel[m].output += l.output_tokens || 0;
                byModel[m].cost += l.cost_usd || 0;
            }

            return ok({
                totalRequests: logs.length,
                totalInputTokens: totalInput,
                totalOutputTokens: totalOutput,
                totalCostUsd: Math.round(totalCost * 10000) / 10000,
                avgLatencyMs: Math.round(avgLatency),
                byModel,
            });
        },
    },
    {
        domain: DOMAIN,
        action: "get_chart_data",
        description: "Get time-series telemetry data for charts. Groups by hour or day.",
        inputSchema: {
            granularity: z.enum(["hour", "day"]).optional().default("day").describe("Time grouping"),
            days: z.number().optional().default(7).describe("Number of days to look back"),
            agent_id: z.string().optional().describe("Filter by agent ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const daysBack = (params.days as number) || 7;
            const since = new Date(Date.now() - daysBack * 86400000).toISOString();

            let query = supabase
                .from("telemetry_logs")
                .select("created_at, input_tokens, output_tokens, cost_usd, latency_ms, model, agent_id")
                .eq("user_id", userId)
                .gte("created_at", since)
                .order("created_at", { ascending: true });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ data: data ?? [], count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "log_event",
        description: "Log a new telemetry event (API call record).",
        inputSchema: {
            agent_id: z.string().optional().describe("Agent ID"),
            provider: z.string().optional().describe("Provider name (e.g. 'openai', 'anthropic')"),
            model: z.string().optional().describe("Model name"),
            input_tokens: z.number().optional().default(0).describe("Input token count"),
            output_tokens: z.number().optional().default(0).describe("Output token count"),
            cost_usd: z.number().optional().default(0).describe("Cost in USD"),
            latency_ms: z.number().optional().default(0).describe("Latency in ms"),
            status: z.string().optional().default("success").describe("Status (success, error)"),
            session_id: z.string().optional().describe("Session ID for grouping"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("telemetry_logs")
                .insert({
                    agent_id: params.agent_id || null,
                    provider: params.provider || null,
                    model: params.model || null,
                    input_tokens: params.input_tokens ?? 0,
                    output_tokens: params.output_tokens ?? 0,
                    cost_usd: params.cost_usd ?? 0,
                    latency_ms: params.latency_ms ?? 0,
                    status: params.status || "success",
                    session_id: params.session_id || null,
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
