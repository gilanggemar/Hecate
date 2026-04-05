// dashboard/store/useUsageStore.ts
//
// Fetches REAL usage data from OpenClaw Gateway RPC:
//   - usage.status  → provider rate-limit windows
//   - usage.cost    → daily token/cost totals (31d)
//   - sessions.list → per-session costs, agents, models, latency, daily activity
//
// Zero Supabase. Pure gateway truth.

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProviderWindow {
    label: string;
    usedPercent: number;
    resetAt: number;
}

export interface ProviderStatus {
    provider: string;
    displayName: string;
    windows: ProviderWindow[];
    plan: string;
}

export interface DailyCost {
    date: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheWriteCost: number;
}

export interface CostTotals {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    totalCost: number;
    inputCost: number;
    outputCost: number;
    cacheReadCost: number;
    cacheWriteCost: number;
}

export interface SessionInfo {
    key: string;
    agentName: string;
    sessionName: string;
    kind: string;
    label?: string;
    displayName?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    status?: string;
    runtimeMs?: number;
    model: string;
    modelProvider: string;
    lastChannel?: string;
    updatedAt: number;
}

export interface AgentUsage {
    id: string;
    displayName: string;
    costUsd: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    sessionCount: number;
    model: string;
}

export interface ModelUsage {
    model: string;
    provider: string;
    costUsd: number;
    totalTokens: number;
    messageCount: number;
}

export interface DailyActivity {
    date: string;
    tokens: number;
    cost: number;
    messages: number;
    toolCalls: number;
    errors: number;
}

export interface DailyLatency {
    date: string;
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
}

export interface ModelDaily {
    date: string;
    provider: string;
    model: string;
    tokens: number;
    cost: number;
    count: number;
}

export interface GatewayUsageData {
    source: 'openclaw-gateway' | 'none';
    updatedAt: number;

    // From usage.status
    providers: ProviderStatus[];

    // From usage.cost
    dailyCosts: DailyCost[];
    costTotals: CostTotals;

    // Aggregated from sessions.list
    agents: AgentUsage[];
    sessions: SessionInfo[];
    sessionCount: number;
    totalMessages: number;
    totalToolCalls: number;
    totalErrors: number;
    totalCostUsd: number;
    totalTokens: number;

    // Top models
    models: ModelUsage[];

    // Daily activity
    dailyActivity: DailyActivity[];
    dailyLatency: DailyLatency[];
    modelDaily: ModelDaily[];

    // Computed stats
    cacheHitRate: number;     // percent
    errorRate: number;        // percent
    avgCostPerMessage: number;
}

interface UsageStore {
    usage: GatewayUsageData | null;
    isLoading: boolean;
    error: string | null;
    fetchUsage: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractAgentName(key: string): string {
    // key format: "agent:celia:main", "agent:echo:cron:uuid"
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : key;
}

function extractSessionName(key: string): string {
    const parts = key.split(':');
    return parts.length >= 3 ? parts.slice(2).join(':') : 'default';
}

function aggregateByAgent(sessions: SessionInfo[]): AgentUsage[] {
    const map = new Map<string, AgentUsage>();

    for (const s of sessions) {
        const existing = map.get(s.agentName);
        if (existing) {
            existing.costUsd += s.estimatedCostUsd;
            existing.totalTokens += s.totalTokens;
            existing.inputTokens += s.inputTokens;
            existing.outputTokens += s.outputTokens;
            existing.sessionCount += 1;
            // Use the model from the most expensive session
            if (s.estimatedCostUsd > 0 && s.model) {
                existing.model = s.model;
            }
        } else {
            map.set(s.agentName, {
                id: s.agentName,
                displayName: s.agentName.charAt(0).toUpperCase() + s.agentName.slice(1),
                costUsd: s.estimatedCostUsd,
                totalTokens: s.totalTokens,
                inputTokens: s.inputTokens,
                outputTokens: s.outputTokens,
                sessionCount: 1,
                model: s.model || 'unknown',
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd);
}

function aggregateModelUsage(modelDaily: ModelDaily[]): ModelUsage[] {
    const map = new Map<string, ModelUsage>();

    for (const m of modelDaily) {
        const key = `${m.provider}:${m.model}`;
        const existing = map.get(key);
        if (existing) {
            existing.costUsd += m.cost;
            existing.totalTokens += m.tokens;
            existing.messageCount += m.count;
        } else {
            map.set(key, {
                model: m.model,
                provider: m.provider,
                costUsd: m.cost,
                totalTokens: m.tokens,
                messageCount: m.count,
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd);
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useUsageStore = create<UsageStore>((set) => ({
    usage: null,
    isLoading: false,
    error: null,

    fetchUsage: async () => {
        set({ isLoading: true, error: null });

        try {
            const gw = getGateway();

            if (!gw.isConnected) {
                set({
                    usage: null,
                    isLoading: false,
                    error: 'Gateway not connected',
                });
                return;
            }

            // Fire all three RPC calls in parallel
            const [statusRes, costRes, sessionsRes] = await Promise.allSettled([
                gw.request('usage.status', {}),
                gw.request('usage.cost', {}),
                gw.request('sessions.list', {}),
            ]);

            // ─── Parse usage.status ─────────────────────────────────────
            const providers: ProviderStatus[] = [];
            if (statusRes.status === 'fulfilled' && statusRes.value?.providers) {
                for (const p of statusRes.value.providers) {
                    providers.push({
                        provider: p.provider || '',
                        displayName: p.displayName || p.provider || '',
                        windows: (p.windows || []).map((w: any) => ({
                            label: w.label || '',
                            usedPercent: w.usedPercent || 0,
                            resetAt: w.resetAt || 0,
                        })),
                        plan: p.plan || '',
                    });
                }
            }

            // ─── Parse usage.cost ───────────────────────────────────────
            let dailyCosts: DailyCost[] = [];
            let costTotals: CostTotals = {
                input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
                totalTokens: 0, totalCost: 0,
                inputCost: 0, outputCost: 0, cacheReadCost: 0, cacheWriteCost: 0,
            };

            if (costRes.status === 'fulfilled' && costRes.value) {
                const cv = costRes.value;
                dailyCosts = (cv.daily || []).map((d: any) => ({
                    date: d.date,
                    input: d.input || 0,
                    output: d.output || 0,
                    cacheRead: d.cacheRead || 0,
                    cacheWrite: d.cacheWrite || 0,
                    totalTokens: d.totalTokens || 0,
                    totalCost: d.totalCost || 0,
                    inputCost: d.inputCost || 0,
                    outputCost: d.outputCost || 0,
                    cacheReadCost: d.cacheReadCost || 0,
                    cacheWriteCost: d.cacheWriteCost || 0,
                }));

                if (cv.totals) {
                    costTotals = {
                        input: cv.totals.input || 0,
                        output: cv.totals.output || 0,
                        cacheRead: cv.totals.cacheRead || 0,
                        cacheWrite: cv.totals.cacheWrite || 0,
                        totalTokens: cv.totals.totalTokens || 0,
                        totalCost: cv.totals.totalCost || 0,
                        inputCost: cv.totals.inputCost || 0,
                        outputCost: cv.totals.outputCost || 0,
                        cacheReadCost: cv.totals.cacheReadCost || 0,
                        cacheWriteCost: cv.totals.cacheWriteCost || 0,
                    };
                }
            }

            // ─── Parse sessions.list ────────────────────────────────────
            let sessions: SessionInfo[] = [];
            let dailyActivity: DailyActivity[] = [];
            let dailyLatency: DailyLatency[] = [];
            let modelDaily: ModelDaily[] = [];
            let sessionCount = 0;
            let totalMessages = 0;
            let totalToolCalls = 0;
            let totalErrors = 0;

            if (sessionsRes.status === 'fulfilled' && sessionsRes.value) {
                const sv = sessionsRes.value;
                sessionCount = sv.count || 0;

                // Parse sessions array
                sessions = (sv.sessions || []).map((s: any) => ({
                    key: s.key || '',
                    agentName: extractAgentName(s.key || ''),
                    sessionName: extractSessionName(s.key || ''),
                    kind: s.kind || '',
                    label: s.label,
                    displayName: s.displayName,
                    inputTokens: s.inputTokens || 0,
                    outputTokens: s.outputTokens || 0,
                    totalTokens: s.totalTokens || 0,
                    estimatedCostUsd: s.estimatedCostUsd || 0,
                    status: s.status,
                    runtimeMs: s.runtimeMs,
                    model: s.model || sv.defaults?.model || '',
                    modelProvider: s.modelProvider || sv.defaults?.modelProvider || '',
                    lastChannel: s.lastChannel,
                    updatedAt: s.updatedAt || 0,
                }));

                // Parse daily activity
                if (sv.daily) {
                    dailyActivity = sv.daily.map((d: any) => ({
                        date: d.date,
                        tokens: d.tokens || 0,
                        cost: d.cost || 0,
                        messages: d.messages || 0,
                        toolCalls: d.toolCalls || 0,
                        errors: d.errors || 0,
                    }));

                    totalMessages = dailyActivity.reduce((s, d) => s + d.messages, 0);
                    totalToolCalls = dailyActivity.reduce((s, d) => s + d.toolCalls, 0);
                    totalErrors = dailyActivity.reduce((s, d) => s + d.errors, 0);
                }

                // Parse latency
                if (sv.dailyLatency) {
                    dailyLatency = sv.dailyLatency.map((d: any) => ({
                        date: d.date,
                        count: d.count || 0,
                        avgMs: d.avgMs || 0,
                        minMs: d.minMs || 0,
                        maxMs: d.maxMs || 0,
                        p95Ms: d.p95Ms || 0,
                    }));
                }

                // Parse model daily
                if (sv.modelDaily) {
                    modelDaily = sv.modelDaily.map((m: any) => ({
                        date: m.date,
                        provider: m.provider || '',
                        model: m.model || '',
                        tokens: m.tokens || 0,
                        cost: m.cost || 0,
                        count: m.count || 0,
                    }));
                }
            }

            // ─── Aggregate ──────────────────────────────────────────────
            const agents = aggregateByAgent(sessions);

            // Derive models from modelDaily if available, otherwise from sessions
            let models: ModelUsage[];
            if (modelDaily.length > 0) {
                models = aggregateModelUsage(modelDaily);
            } else {
                // Fallback: derive from individual sessions
                const mMap = new Map<string, ModelUsage>();
                for (const s of sessions) {
                    if (!s.model) continue;
                    const key = `${s.modelProvider}:${s.model}`;
                    const e = mMap.get(key);
                    if (e) {
                        e.costUsd += s.estimatedCostUsd;
                        e.totalTokens += s.totalTokens;
                        e.messageCount += 1;
                    } else {
                        mMap.set(key, {
                            model: s.model,
                            provider: s.modelProvider,
                            costUsd: s.estimatedCostUsd,
                            totalTokens: s.totalTokens,
                            messageCount: 1,
                        });
                    }
                }
                models = Array.from(mMap.values()).sort((a, b) => b.costUsd - a.costUsd);
            }

            // If messages/toolCalls are 0 but we have sessions, estimate from sessions
            if (totalMessages === 0 && sessions.length > 0) {
                // Each session ≈ multiple messages; use session count as fallback
                totalMessages = sessions.length;
            }

            const totalCostFromSessions = agents.reduce((s, a) => s + a.costUsd, 0);
            const totalTokensFromSessions = agents.reduce((s, a) => s + a.totalTokens, 0);

            // Compute cache hit rate from cost totals
            const totalPromptTokens = costTotals.input + costTotals.cacheRead;
            const cacheHitRate = totalPromptTokens > 0
                ? (costTotals.cacheRead / totalPromptTokens) * 100
                : 0;

            // Error rate
            const errorRate = totalMessages > 0
                ? (totalErrors / totalMessages) * 100
                : 0;

            // Avg cost per message
            const avgCostPerMessage = totalMessages > 0
                ? totalCostFromSessions / totalMessages
                : 0;

            const usage: GatewayUsageData = {
                source: 'openclaw-gateway',
                updatedAt: Date.now(),
                providers,
                dailyCosts,
                costTotals,
                agents,
                sessions,
                sessionCount,
                totalMessages,
                totalToolCalls,
                totalErrors,
                totalCostUsd: totalCostFromSessions || costTotals.totalCost,
                totalTokens: totalTokensFromSessions || costTotals.totalTokens,
                models,
                dailyActivity,
                dailyLatency,
                modelDaily,
                cacheHitRate,
                errorRate,
                avgCostPerMessage,
            };

            console.log('[UsageStore] Gateway usage loaded:', {
                agents: agents.length,
                sessions: sessions.length,
                models: models.length,
                totalCost: usage.totalCostUsd,
                totalTokens: usage.totalTokens,
                cacheHitRate: usage.cacheHitRate.toFixed(1) + '%',
            });

            set({ usage, isLoading: false, error: null });
        } catch (err: any) {
            console.error('[UsageStore] Failed to fetch usage:', err);
            set({
                isLoading: false,
                error: err?.message || 'Failed to fetch usage data',
            });
        }
    },
}));
