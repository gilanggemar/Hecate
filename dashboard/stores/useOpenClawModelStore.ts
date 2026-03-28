// stores/useOpenClawModelStore.ts
// Zustand store for OpenClaw model configuration.
// Reads model config from OpenClaw Gateway via config.get + models.list RPCs.
// Model changes are buffered — not applied until user clicks "Apply".

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModelCatalogEntry {
    ref: string;        // e.g. "openai-codex/gpt-5.3-codex"
    alias?: string;     // e.g. "Codex" — friendly display name
    provider: string;   // e.g. "openai-codex" — derived from ref
    modelName: string;  // e.g. "gpt-5.3-codex" — derived from ref
}

interface PendingModelChange {
    agentId: string;
    modelRef: string;
    isDefault: boolean; // true = change agents.defaults.model.primary
    isHeartbeat?: boolean; // true = change heartbeat model instead of primary
}

interface OpenClawModelState {
    // The resolved active model for each agent (agentId → model string)
    activeModels: Record<string, string>;

    // Heartbeat models per agent
    activeHeartbeatModels: Record<string, string>;

    // The default model (agents.defaults.model.primary)
    defaultModel: string | null;

    // The default heartbeat model
    defaultHeartbeatModel: string | null;

    // The default fallbacks (agents.defaults.model.fallbacks)
    defaultFallbacks: string[];

    // The model catalog/allowlist (from agents.defaults.models + models.list)
    modelCatalog: ModelCatalogEntry[];

    // Config hash for optimistic concurrency
    configHash: string | null;

    // Raw config cache for patching
    rawConfig: any | null;

    // Loading state
    isModelLoading: boolean;
    modelError: string | null;

    // Buffer state — pending model change not yet applied
    pendingModelChange: PendingModelChange | null;
    hasUnsavedModelChange: boolean;

    // Heartbeat buffer
    pendingHeartbeatModelChange: PendingModelChange | null;
    hasUnsavedHeartbeatChange: boolean;

    // Actions
    fetchModels: () => Promise<void>;
    bufferModelChange: (agentId: string, modelRef: string, isDefault: boolean) => void;
    bufferHeartbeatModelChange: (agentId: string, modelRef: string, isDefault: boolean) => void;
    applyModelChange: () => Promise<void>;
    discardModelChange: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseConfigRaw(configRes: any): { config: any; hash: string | null } {
    if (!configRes) return { config: {}, hash: null };
    const hash = configRes.hash || null;
    if (configRes.config && typeof configRes.config === 'object') {
        return { config: configRes.config, hash };
    }
    const raw = configRes.raw;
    if (typeof raw === 'string') {
        try { return { config: JSON.parse(raw), hash }; } catch { /* fallthrough */ }
        try {
            const sanitized = raw
                .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
                .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
                .replace(/,\s*([\]}])/g, '$1')
                .replace(/\/\/.*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');
            return { config: JSON.parse(sanitized), hash };
        } catch { /* fallthrough */ }
    }
    const { path, exists, raw: _raw, ...rest } = configRes;
    if (Object.keys(rest).length > 0) return { config: rest, hash };
    return { config: {}, hash };
}

function buildCatalog(config: any): ModelCatalogEntry[] {
    const modelsObj = config?.agents?.defaults?.models ?? {};
    const catalog: ModelCatalogEntry[] = Object.entries(modelsObj).map(([ref, meta]) => {
        const slashIndex = ref.indexOf('/');
        return {
            ref,
            alias: (meta as any)?.alias ?? undefined,
            provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
            modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
        };
    });
    return catalog;
}

function resolveActiveModels(config: any, defaultModel: string | null): Record<string, string> {
    const agentsList = config?.agents?.list ?? [];
    const activeModels: Record<string, string> = {};
    for (const agent of agentsList) {
        const id = agent.id || agent.agentId;
        if (!id) continue;
        activeModels[id] = agent.model?.primary ?? defaultModel ?? 'unknown';
    }
    if (agentsList.length === 0) {
        activeModels['main'] = defaultModel ?? 'unknown';
    }
    return activeModels;
}

function resolveActiveHeartbeatModels(config: any, defaultHeartbeat: string | null): Record<string, string> {
    const agentsList = config?.agents?.list ?? [];
    const models: Record<string, string> = {};
    for (const agent of agentsList) {
        const id = agent.id || agent.agentId;
        if (!id) continue;
        models[id] = agent.model?.heartbeat ?? defaultHeartbeat ?? '';
    }
    return models;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useOpenClawModelStore = create<OpenClawModelState>((set, get) => ({
    activeModels: {},
    activeHeartbeatModels: {},
    defaultModel: null,
    defaultHeartbeatModel: null,
    defaultFallbacks: [],
    modelCatalog: [],
    configHash: null,
    rawConfig: null,
    isModelLoading: false,
    modelError: null,
    pendingModelChange: null,
    hasUnsavedModelChange: false,
    pendingHeartbeatModelChange: null,
    hasUnsavedHeartbeatChange: false,

    // ─── fetchModels ────────────────────────────────────────────────────

    fetchModels: async () => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ modelError: 'Not connected to OpenClaw Gateway', isModelLoading: false });
            return;
        }

        set({ isModelLoading: true, modelError: null });

        try {
            const configRes = await gw.request('config.get', {}).catch((e) => {
                console.warn('[ModelStore] config.get failed:', e);
                return null;
            });

            const { config, hash } = parseConfigRaw(configRes);

            const defaultModel = config?.agents?.defaults?.model?.primary ?? null;
            const defaultHeartbeatModel = config?.agents?.defaults?.model?.heartbeat ?? null;
            const defaultFallbacks = config?.agents?.defaults?.model?.fallbacks ?? [];

            // Build catalog from config
            let catalog = buildCatalog(config);

            // If catalog is empty, try models.list RPC
            if (catalog.length === 0) {
                try {
                    const modelsRes = await gw.request('models.list', {});
                    const modelsList = modelsRes?.models ?? modelsRes ?? [];
                    if (Array.isArray(modelsList)) {
                        catalog = modelsList.map((m: any) => {
                            const ref = m.ref || m.id || m.model || m.name || '';
                            const slashIndex = ref.indexOf('/');
                            return {
                                ref,
                                alias: m.alias ?? m.displayName ?? undefined,
                                provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
                                modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
                            };
                        });
                    }
                } catch (e) {
                    console.warn('[ModelStore] models.list failed:', e);
                }
            }

            // Ensure the current default model is in the catalog
            if (defaultModel && !catalog.find(c => c.ref === defaultModel)) {
                const slashIndex = defaultModel.indexOf('/');
                catalog.unshift({
                    ref: defaultModel,
                    provider: slashIndex > -1 ? defaultModel.substring(0, slashIndex) : defaultModel,
                    modelName: slashIndex > -1 ? defaultModel.substring(slashIndex + 1) : defaultModel,
                });
            }

            // Ensure fallback models are in the catalog
            for (const fb of defaultFallbacks) {
                if (!catalog.find(c => c.ref === fb)) {
                    const slashIndex = fb.indexOf('/');
                    catalog.push({
                        ref: fb,
                        provider: slashIndex > -1 ? fb.substring(0, slashIndex) : fb,
                        modelName: slashIndex > -1 ? fb.substring(slashIndex + 1) : fb,
                    });
                }
            }

            const activeModels = resolveActiveModels(config, defaultModel);
            const activeHeartbeatModels = resolveActiveHeartbeatModels(config, defaultHeartbeatModel);

            set({
                activeModels,
                activeHeartbeatModels,
                defaultModel,
                defaultHeartbeatModel,
                defaultFallbacks,
                modelCatalog: catalog,
                configHash: hash,
                rawConfig: config,
                isModelLoading: false,
                modelError: null,
            });
        } catch (err: any) {
            console.error('[ModelStore] fetchModels failed:', err);
            set({
                isModelLoading: false,
                modelError: err?.message || 'Failed to fetch model configuration',
            });
        }
    },

    // ─── Buffer a model change (don't apply yet) ────────────────────────

    bufferModelChange: (agentId, modelRef, isDefault) => {
        set({
            pendingModelChange: { agentId, modelRef, isDefault },
            hasUnsavedModelChange: true,
        });
    },

    bufferHeartbeatModelChange: (agentId, modelRef, isDefault) => {
        set({
            pendingHeartbeatModelChange: { agentId, modelRef, isDefault, isHeartbeat: true },
            hasUnsavedHeartbeatChange: true,
        });
    },

    // ─── Apply the buffered model change ────────────────────────────────

    applyModelChange: async () => {
        const { pendingModelChange, pendingHeartbeatModelChange, rawConfig, configHash } = get();
        if (!pendingModelChange && !pendingHeartbeatModelChange) return;

        const gw = getGateway();
        if (!gw.isConnected) return;

        try {
            // Re-fetch fresh config for hash
            const freshRes = await gw.request('config.get', {}).catch(() => null);
            const { config: freshConfig, hash: freshHash } = parseConfigRaw(freshRes);
            const baseHash = freshHash || configHash;

            if (pendingModelChange) {
                let patchPayload: any;

                if (pendingModelChange.isDefault) {
                    // Change default model
                    patchPayload = {
                        agents: {
                            defaults: {
                                model: {
                                    primary: pendingModelChange.modelRef,
                                },
                            },
                        },
                    };
                } else {
                    // Change per-agent model — must send full agents.list
                    const agentsList = [...(freshConfig?.agents?.list ?? rawConfig?.agents?.list ?? [])];
                    const agentIndex = agentsList.findIndex(
                        (a: any) => (a.id || a.agentId) === pendingModelChange.agentId
                    );

                    if (agentIndex >= 0) {
                        agentsList[agentIndex] = {
                            ...agentsList[agentIndex],
                            model: {
                                primary: pendingModelChange.modelRef,
                                ...(agentsList[agentIndex].model?.fallbacks
                                    ? { fallbacks: agentsList[agentIndex].model.fallbacks }
                                    : {}),
                            },
                        };
                        patchPayload = { agents: { list: agentsList } };
                    } else {
                        // Agent not in list — fall back to default model change
                        patchPayload = {
                            agents: {
                                defaults: {
                                    model: {
                                        primary: pendingModelChange.modelRef,
                                    },
                                },
                            },
                        };
                    }
                }

                await gw.request('config.patch', {
                    raw: JSON.stringify(patchPayload),
                    baseHash: baseHash,
                });

                // Clear primary buffer and re-fetch
                set({ pendingModelChange: null, hasUnsavedModelChange: false });
            }

            // Apply heartbeat change if pending
            if (pendingHeartbeatModelChange) {
                const hbFreshRes = await gw.request('config.get', {}).catch(() => null);
                const { config: hbConfig, hash: hbHash } = parseConfigRaw(hbFreshRes);
                const hbBaseHash = hbHash || configHash;

                let hbPatchPayload: any;
                if (pendingHeartbeatModelChange.isDefault) {
                    hbPatchPayload = {
                        agents: { defaults: { model: { heartbeat: pendingHeartbeatModelChange.modelRef } } },
                    };
                } else {
                    const hbAgentsList = [...(hbConfig?.agents?.list ?? rawConfig?.agents?.list ?? [])];
                    const hbIdx = hbAgentsList.findIndex(
                        (a: any) => (a.id || a.agentId) === pendingHeartbeatModelChange.agentId
                    );
                    if (hbIdx >= 0) {
                        hbAgentsList[hbIdx] = {
                            ...hbAgentsList[hbIdx],
                            model: {
                                ...hbAgentsList[hbIdx].model,
                                heartbeat: pendingHeartbeatModelChange.modelRef,
                            },
                        };
                        hbPatchPayload = { agents: { list: hbAgentsList } };
                    } else {
                        hbPatchPayload = {
                            agents: { defaults: { model: { heartbeat: pendingHeartbeatModelChange.modelRef } } },
                        };
                    }
                }

                await gw.request('config.patch', {
                    raw: JSON.stringify(hbPatchPayload),
                    baseHash: hbBaseHash,
                });

                set({ pendingHeartbeatModelChange: null, hasUnsavedHeartbeatChange: false });
            }

            await get().fetchModels();
        } catch (err: any) {
            console.error('[ModelStore] applyModelChange failed:', err);
            set({ modelError: err?.message || 'Failed to apply model change' });
        }
    },

    // ─── Discard the buffered model change ──────────────────────────────

    discardModelChange: () => {
        set({ pendingModelChange: null, hasUnsavedModelChange: false });
    },
}));
