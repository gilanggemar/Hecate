// stores/useOpenClawCapabilitiesStore.ts
// New Zustand store for OpenClaw-native capabilities management.
// All data comes from the OpenClaw Gateway via WebSocket RPC.
// No local database persistence.

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';
import {
    deriveGlobalToolState,
    derivePerAgentToolState,
    deriveGlobalSkillState,
    derivePerAgentSkillState,
    parseAgentsFromConfig,
    parseCatalogTools,
    parseSkillStatuses,
    type OpenClawTool,
    type OpenClawSkill,
    type OpenClawAgent,
    type SkillGroup,
} from '@/lib/openclaw/capabilities';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Try to parse config.get `raw` field into an object. Handles JSON5-style configs. */
function parseConfigRaw(configRes: any): { config: any; hash: string | null } {
    if (!configRes) return { config: {}, hash: null };

    const hash = configRes.hash || null;

    // If configRes already has a structured config field, use it directly
    if (configRes.config && typeof configRes.config === 'object') {
        return { config: configRes.config, hash };
    }

    // configRes.raw is the raw config file string (JSON5/JSONC format)
    const raw = configRes.raw;
    if (typeof raw === 'string') {
        try {
            // Try standard JSON.parse first
            return { config: JSON.parse(raw), hash };
        } catch {
            // JSON5-style: unquoted keys, single-quoted strings, trailing commas
            // Attempt a lenient parse
            try {
                const sanitized = raw
                    // Replace single-quoted strings with double-quoted
                    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
                    // Quote unquoted keys (word chars before colon)
                    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
                    // Remove trailing commas before } or ]
                    .replace(/,\s*([\]}])/g, '$1')
                    // Remove comments
                    .replace(/\/\/.*/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                return { config: JSON.parse(sanitized), hash };
            } catch (e2) {
                console.warn('[Capabilities] Failed to parse config.raw:', e2);
            }
        }
    }

    // Fallback: use the response object itself (minus meta fields)
    const { path, exists, raw: _raw, ...rest } = configRes;
    if (Object.keys(rest).length > 0) {
        return { config: rest, hash };
    }

    return { config: {}, hash };
}

/** Serialize any error into a readable string */
function errMsg(err: any, fallback: string): string {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (err?.error) return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    if (typeof err === 'object') {
        const s = JSON.stringify(err);
        return s === '{}' ? fallback : s;
    }
    return String(err) || fallback;
}

// ─── State Interface ────────────────────────────────────────────────────────

interface WorkspaceFile {
    name: string;
    size: number;
    modified: number; // unix timestamp ms
}

interface OpenClawCapabilitiesState {
    // UI State
    activeTab: 'per-agent' | 'global' | 'core-files';
    selectedAgentId: string | null;

    // Data from Gateway
    agents: OpenClawAgent[];
    globalTools: OpenClawTool[];
    globalSkills: OpenClawSkill[];
    perAgentTools: Record<string, OpenClawTool[]>;
    perAgentSkills: Record<string, OpenClawSkill[]>;

    // Skill management
    skillGroups: SkillGroup[];

    // Raw config cache (for patching)
    rawConfig: any | null;
    draftConfig: any | null;
    configHash: string | null;

    // Buffering State
    hasUnsavedChanges: boolean;
    catalogToolsCache: any[];
    skillStatusesCache: any[];

    // Core Files State
    workspaceFiles: WorkspaceFile[];
    selectedFileName: string | null;
    selectedFileContent: string | null;
    selectedFilePath: string | null;
    fileDraftContent: string | null;
    isFileDirty: boolean;
    isFilesLoading: boolean;
    isFileContentLoading: boolean;
    isFileSaving: boolean;
    fileError: string | null;

    // Loading & Error
    isLoading: boolean;
    error: string | null;
    togglingItems: Set<string>; // keys of items currently being toggled
    isApplying: boolean;

    // Actions
    setActiveTab: (tab: 'per-agent' | 'global' | 'core-files') => void;
    setSelectedAgentId: (id: string | null) => void;
    fetchAll: () => Promise<void>;
    applyChanges: () => Promise<void>;
    discardChanges: () => void;
    toggleGlobalTool: (toolName: string, allowed: boolean) => void;
    toggleGlobalSkill: (skillKey: string, enabled: boolean) => void;
    togglePerAgentTool: (agentId: string, toolName: string, allowed: boolean) => void;
    togglePerAgentSkill: (agentId: string, skillKey: string, enabled: boolean) => void;

    // Skill management actions
    installSkill: (skill: { key: string; name: string; description?: string; source: 'github' | 'skill.sh' | 'manual'; sourceUrl?: string; content?: string; compatibilityNote?: string }) => void;
    deleteSkill: (skillKey: string) => void;
    renameSkill: (skillKey: string, newName: string) => void;
    setSkillTags: (skillKey: string, tags: string[]) => void;
    createSkillGroup: (name: string) => void;
    renameSkillGroup: (groupId: string, name: string) => void;
    deleteSkillGroup: (groupId: string) => void;

    // Core Files Actions
    fetchWorkspaceFiles: (agentId: string) => Promise<void>;
    selectFile: (agentId: string, fileName: string) => Promise<void>;
    updateFileDraft: (content: string) => void;
    saveFile: (agentId: string) => Promise<void>;
    resetFileDraft: () => void;
    clearFileSelection: () => void;
}

export const useOpenClawCapabilitiesStore = create<OpenClawCapabilitiesState>((set, get) => ({
    // Initial state
    activeTab: 'global',
    selectedAgentId: null,

    agents: [],
    globalTools: [],
    globalSkills: [],
    perAgentTools: {},
    perAgentSkills: {},

    skillGroups: [],

    rawConfig: null,
    draftConfig: null,
    configHash: null,

    hasUnsavedChanges: false,
    catalogToolsCache: [],
    skillStatusesCache: [],

    // Core Files initial state
    workspaceFiles: [],
    selectedFileName: null,
    selectedFileContent: null,
    selectedFilePath: null,
    fileDraftContent: null,
    isFileDirty: false,
    isFilesLoading: false,
    isFileContentLoading: false,
    isFileSaving: false,
    fileError: null,

    isLoading: false,
    error: null,
    togglingItems: new Set(),
    isApplying: false,

    // ─── UI Actions ─────────────────────────────────────────────────────

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedAgentId: (id) => set({ selectedAgentId: id }),

    // ─── fetchAll ───────────────────────────────────────────────────────

    fetchAll: async () => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ error: 'Not connected to OpenClaw Gateway', isLoading: false });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            // 1. Fetch config and skills status
            const [configRes, skillsRes] = await Promise.all([
                gw.request('config.get', {}).catch((e) => { console.warn('[Capabilities] config.get failed:', e); return null; }),
                gw.request('skills.status', {}).catch((e) => { console.warn('[Capabilities] skills.status failed:', e); return null; }),
            ]);

            // 2. Parse config from raw JSON5 string
            const { config, hash } = parseConfigRaw(configRes);
            console.log('[Capabilities] Parsed config keys:', Object.keys(config));

            // 3. Parse agents and determine IDs
            const agents = parseAgentsFromConfig(config);
            console.log('[Capabilities] Agents:', agents);

            // 4. Fetch tools catalog — use first agent's ID, then fallback to no agentId
            let catalogRes: any = null;
            const firstAgentId = agents.length > 0 ? agents[0].id : null;

            if (firstAgentId) {
                catalogRes = await gw.request('tools.catalog', { agentId: firstAgentId })
                    .catch((e) => { console.warn(`[Capabilities] tools.catalog(${firstAgentId}) failed:`, e); return null; });
            }
            if (!catalogRes) {
                catalogRes = await gw.request('tools.catalog', {})
                    .catch((e) => { console.warn('[Capabilities] tools.catalog({}) failed:', e); return null; });
            }

            console.log('[Capabilities] tools.catalog response:', JSON.stringify(catalogRes)?.slice(0, 500));

            // 5. Parse catalog tools
            const catalogTools = parseCatalogTools(catalogRes);
            console.log('[Capabilities] Parsed catalog tools:', catalogTools.length, catalogTools.slice(0, 3));

            // 6. Derive global tool state
            const globalTools = deriveGlobalToolState(catalogTools, config);

            // 7. Parse skills — The config uses `plugins.entries` for skill settings
            const skillStatuses = parseSkillStatuses(skillsRes);

            // Map config.plugins.entries to the format deriveGlobalSkillState expects
            const skillConfig = {
                skills: {
                    entries: config?.plugins?.entries ?? config?.skills?.entries ?? {},
                },
            };
            const globalSkills = deriveGlobalSkillState(skillStatuses, skillConfig);
            console.log('[Capabilities] Global skills:', globalSkills.length, 'enabled:', globalSkills.filter(s => s.enabled).length);

            // 8. Derive per-agent states
            const perAgentTools: Record<string, OpenClawTool[]> = {};
            const perAgentSkills: Record<string, OpenClawSkill[]> = {};

            const agentsList = config?.agents?.list || config?.agents;
            if (Array.isArray(agentsList)) {
                for (const agent of agentsList) {
                    const agentId = agent.id || agent.agentId;
                    if (!agentId) continue;

                    perAgentTools[agentId] = derivePerAgentToolState(
                        catalogTools,
                        agent,
                        globalTools
                    );

                    perAgentSkills[agentId] = derivePerAgentSkillState(
                        skillStatuses,
                        skillConfig,
                        agentId
                    );
                }
            }

            // Parse skill groups from config
            const skillGroups: SkillGroup[] = (config?.plugins?.skillGroups ?? config?.skills?.skillGroups ?? []).map((g: any) => ({
                id: g.id || crypto.randomUUID(),
                name: g.name || 'Unnamed Group',
            }));

            // Enrich skills with source/tags from config entries
            const enrichSkills = (skills: OpenClawSkill[]): OpenClawSkill[] => {
                const entries = config?.plugins?.entries ?? config?.skills?.entries ?? {};
                return skills.map(s => {
                    const entry = entries[s.key];
                    return {
                        ...s,
                        source: entry?.source ?? 'inherited',
                        sourceUrl: entry?.sourceUrl ?? undefined,
                        tags: entry?.tags ?? [],
                    };
                });
            };

            set({
                agents,
                globalTools,
                globalSkills: enrichSkills(globalSkills),
                perAgentTools,
                perAgentSkills: Object.fromEntries(
                    Object.entries(perAgentSkills).map(([k, v]) => [k, enrichSkills(v)])
                ),
                rawConfig: config,
                draftConfig: JSON.parse(JSON.stringify(config)),
                configHash: hash,
                hasUnsavedChanges: false,
                catalogToolsCache: catalogTools,
                skillStatusesCache: skillStatuses,
                skillGroups,
                isLoading: false,
                error: null,
            });
        } catch (err: any) {
            console.error('[Capabilities] fetchAll failed:', err);
            set({
                isLoading: false,
                error: errMsg(err, 'Failed to fetch capabilities from Gateway'),
            });
        }
    },

    // ─── applyChanges & discardChanges ──────────────────────────────────

    applyChanges: async () => {
        const gw = getGateway();
        if (!gw.isConnected) return;

        const { draftConfig, configHash } = get();
        if (!draftConfig) return;

        set({ isApplying: true, error: null });

        try {
            await gw.request('config.patch', {
                raw: JSON.stringify(draftConfig),
                baseHash: configHash,
            });

            // Re-fetch to confirm changes
            await get().fetchAll();
        } catch (err: any) {
            console.error('[Capabilities] applyChanges failed:', err);
            set({ error: errMsg(err, 'Failed to apply configuration changes'), isApplying: false });
        }
    },

    discardChanges: () => {
        const { rawConfig, selectedFileContent } = get();
        if (!rawConfig) return;

        // Reset draft to raw, then re-derive state
        const draftConfig = JSON.parse(JSON.stringify(rawConfig));
        set({
            draftConfig,
            hasUnsavedChanges: false,
            // Also reset file draft if dirty
            fileDraftContent: selectedFileContent,
            isFileDirty: false,
        });
        
        // Re-run derivations
        const s = get();
        const skillConfig = { skills: { entries: draftConfig?.plugins?.entries ?? draftConfig?.skills?.entries ?? {} } };
        
        const globalTools = deriveGlobalToolState(s.catalogToolsCache, draftConfig);
        const globalSkills = deriveGlobalSkillState(s.skillStatusesCache, skillConfig);

        const perAgentTools: Record<string, OpenClawTool[]> = {};
        const perAgentSkills: Record<string, OpenClawSkill[]> = {};

        const agentsList = draftConfig?.agents?.list || draftConfig?.agents;
        if (Array.isArray(agentsList)) {
            for (const agent of agentsList) {
                const agentId = agent.id || agent.agentId;
                if (!agentId) continue;
                perAgentTools[agentId] = derivePerAgentToolState(s.catalogToolsCache, agent, globalTools);
                perAgentSkills[agentId] = derivePerAgentSkillState(s.skillStatusesCache, skillConfig, agentId);
            }
        }

        set({ globalTools, globalSkills, perAgentTools, perAgentSkills });
    },

    // ─── Local State Derivation Helper ──────────────────────────────────
    
    _rederiveLocalState: () => {
        const s = get();
        const draftConfig = s.draftConfig;
        if (!draftConfig) return;

        const skillConfig = { skills: { entries: draftConfig?.plugins?.entries ?? draftConfig?.skills?.entries ?? {} } };
        
        const globalTools = deriveGlobalToolState(s.catalogToolsCache, draftConfig);
        const globalSkills = deriveGlobalSkillState(s.skillStatusesCache, skillConfig);

        const perAgentTools: Record<string, OpenClawTool[]> = {};
        const perAgentSkills: Record<string, OpenClawSkill[]> = {};

        const agentsList = draftConfig?.agents?.list || draftConfig?.agents;
        if (Array.isArray(agentsList)) {
            for (const agent of agentsList) {
                const agentId = agent.id || agent.agentId;
                if (!agentId) continue;
                perAgentTools[agentId] = derivePerAgentToolState(s.catalogToolsCache, agent, globalTools);
                perAgentSkills[agentId] = derivePerAgentSkillState(s.skillStatusesCache, skillConfig, agentId);
            }
        }

        set({
            globalTools,
            globalSkills,
            perAgentTools,
            perAgentSkills,
            hasUnsavedChanges: true,
        });
    },

    // ─── toggleGlobalTool ───────────────────────────────────────────────

    toggleGlobalTool: (toolName, allowed) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.tools) draftConfig.tools = {};
        const currentAllow = Array.isArray(draftConfig.tools.allow) ? draftConfig.tools.allow : [];
        const currentDeny = Array.isArray(draftConfig.tools.deny) ? draftConfig.tools.deny : [];

        if (allowed) {
            if (!currentAllow.includes(toolName)) draftConfig.tools.allow = [...currentAllow, toolName];
            draftConfig.tools.deny = currentDeny.filter((t: string) => t !== toolName);
        } else {
            if (!currentDeny.includes(toolName)) draftConfig.tools.deny = [...currentDeny, toolName];
            draftConfig.tools.allow = currentAllow.filter((t: string) => t !== toolName);
        }

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── toggleGlobalSkill ──────────────────────────────────────────────

    toggleGlobalSkill: (skillKey, enabled) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.entries) draftConfig.plugins.entries = {};
        if (!draftConfig.plugins.entries[skillKey]) draftConfig.plugins.entries[skillKey] = {};

        draftConfig.plugins.entries[skillKey].enabled = enabled;

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── togglePerAgentTool ─────────────────────────────────────────────

    togglePerAgentTool: (agentId, toolName, allowed) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        const agentsList = draftConfig.agents?.list || draftConfig.agents;
        if (!Array.isArray(agentsList)) return;

        const agent = agentsList.find((a: any) => (a.id || a.agentId) === agentId);
        if (!agent) return;

        if (!agent.tools) agent.tools = {};
        const currentAllow = Array.isArray(agent.tools.allow) ? agent.tools.allow : [];
        const currentDeny = Array.isArray(agent.tools.deny) ? agent.tools.deny : [];

        if (allowed) {
            if (!currentAllow.includes(toolName)) agent.tools.allow = [...currentAllow, toolName];
            agent.tools.deny = currentDeny.filter((t: string) => t !== toolName);
        } else {
            if (!currentDeny.includes(toolName)) agent.tools.deny = [...currentDeny, toolName];
            agent.tools.allow = currentAllow.filter((t: string) => t !== toolName);
        }

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── togglePerAgentSkill ────────────────────────────────────────────
    
    togglePerAgentSkill: (_agentId, skillKey, enabled) => {
        // Delegate to global toggle
        get().toggleGlobalSkill(skillKey, enabled);
    },

    // ─── Core Files Actions ─────────────────────────────────────────────

    fetchWorkspaceFiles: async (agentId) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ fileError: 'Not connected to OpenClaw Gateway', isFilesLoading: false });
            return;
        }

        set({ isFilesLoading: true, fileError: null });

        try {
            const res = await gw.request('agents.files.list', { agentId });
            const files = res?.files ?? (Array.isArray(res) ? res : []);
            set({
                workspaceFiles: files.map((f: any) => ({
                    name: f.name,
                    size: f.size ?? 0,
                    modified: f.modified ?? 0,
                })),
                isFilesLoading: false,
            });
        } catch (err: any) {
            console.error('[Capabilities] fetchWorkspaceFiles failed:', err);
            set({
                isFilesLoading: false,
                fileError: err?.message || 'Failed to load workspace files',
            });
        }
    },

    selectFile: async (agentId, fileName) => {
        const gw = getGateway();
        if (!gw.isConnected) return;

        set({
            selectedFileName: fileName,
            isFileContentLoading: true,
            fileError: null,
        });

        try {
            const res = await gw.request('agents.files.get', { agentId, name: fileName });
            console.log('[Capabilities] agents.files.get response:', JSON.stringify(res).slice(0, 500));

            // Defensively extract content — the response shape may vary
            let content = '';
            let path: string | null = null;

            if (typeof res === 'string') {
                // Direct string response
                content = res;
            } else if (res && typeof res === 'object') {
                // Try common field names
                content = res.content ?? res.text ?? res.body ?? res.data ?? '';
                path = res.path ?? res.filePath ?? null;

                // Maybe content is nested under a payload or file key
                if (!content && res.file && typeof res.file === 'object') {
                    content = res.file.content ?? res.file.text ?? '';
                    path = (path || res.file.path) ?? null;
                }

                // If content is still empty but there are keys, log them for debugging
                if (!content) {
                    console.warn('[Capabilities] agents.files.get returned object with no content field. Keys:', Object.keys(res));
                }
            }

            set({
                selectedFileContent: content,
                selectedFilePath: path,
                fileDraftContent: content,
                isFileDirty: false,
                isFileContentLoading: false,
            });
        } catch (err: any) {
            console.error('[Capabilities] selectFile failed:', err);
            set({
                isFileContentLoading: false,
                fileError: err?.message || 'Failed to load file content',
            });
        }
    },

    updateFileDraft: (content) => {
        const selectedFileContent = get().selectedFileContent;
        set({
            fileDraftContent: content,
            isFileDirty: content !== selectedFileContent,
            hasUnsavedChanges: content !== selectedFileContent || get().hasUnsavedChanges,
        });
    },

    saveFile: async (agentId) => {
        const { isFileDirty, selectedFileName, fileDraftContent } = get();
        if (!isFileDirty || !selectedFileName || fileDraftContent === null) return;

        const gw = getGateway();
        if (!gw.isConnected) return;

        set({ isFileSaving: true, fileError: null });

        try {
            await gw.request('agents.files.set', {
                agentId,
                name: selectedFileName,
                content: fileDraftContent,
            });

            set({
                selectedFileContent: fileDraftContent,
                isFileDirty: false,
                isFileSaving: false,
            });

            // Re-fetch file list to update size/modified
            await get().fetchWorkspaceFiles(agentId);
        } catch (err: any) {
            console.error('[Capabilities] saveFile failed:', err);
            set({
                isFileSaving: false,
                fileError: err?.message || 'Failed to save file',
            });
        }
    },

    resetFileDraft: () => {
        const selectedFileContent = get().selectedFileContent;
        set({
            fileDraftContent: selectedFileContent,
            isFileDirty: false,
        });
    },

    clearFileSelection: () => {
        set({
            selectedFileName: null,
            selectedFileContent: null,
            selectedFilePath: null,
            fileDraftContent: null,
            isFileDirty: false,
            fileError: null,
        });
    },

    // ─── Skill Management Actions ───────────────────────────────────────

    installSkill: (skill) => {
        const { draftConfig, skillStatusesCache, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.entries) draftConfig.plugins.entries = {};

        // Add the skill entry to draft config
        draftConfig.plugins.entries[skill.key] = {
            enabled: true,
            source: skill.source,
            sourceUrl: skill.sourceUrl || undefined,
            name: skill.name,
            description: skill.description || undefined,
            tags: [],
            ...(skill.content ? { content: skill.content } : {}),
            ...(skill.compatibilityNote ? { compatibilityNote: skill.compatibilityNote } : {}),
        };

        // Also add to skillStatusesCache so _rederiveLocalState picks it up
        const alreadyInCache = skillStatusesCache.some((s: any) => s.key === skill.key);
        if (!alreadyInCache) {
            set({
                skillStatusesCache: [
                    ...skillStatusesCache,
                    {
                        key: skill.key,
                        name: skill.name,
                        description: skill.description,
                        eligible: true,
                    },
                ],
            });
        }

        set({ draftConfig });
        _rederiveLocalState();
    },

    deleteSkill: (skillKey) => {
        const { draftConfig, skillStatusesCache, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        // Remove from plugins.entries
        if (draftConfig.plugins?.entries?.[skillKey]) {
            delete draftConfig.plugins.entries[skillKey];
        }

        // Remove from cache
        set({
            draftConfig,
            skillStatusesCache: skillStatusesCache.filter((s: any) => s.key !== skillKey),
        });
        _rederiveLocalState();
    },

    renameSkill: (skillKey, newName) => {
        const { draftConfig, skillStatusesCache, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (draftConfig.plugins?.entries?.[skillKey]) {
            draftConfig.plugins.entries[skillKey].name = newName;
        }

        // Also update the cache
        const updatedCache = skillStatusesCache.map((s: any) =>
            s.key === skillKey ? { ...s, name: newName } : s
        );

        set({ draftConfig, skillStatusesCache: updatedCache });
        _rederiveLocalState();
    },

    setSkillTags: (skillKey, tags) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.entries) draftConfig.plugins.entries = {};
        if (!draftConfig.plugins.entries[skillKey]) draftConfig.plugins.entries[skillKey] = {};

        draftConfig.plugins.entries[skillKey].tags = tags;

        set({ draftConfig });
        _rederiveLocalState();
    },

    createSkillGroup: (name) => {
        const { draftConfig, skillGroups } = get();
        if (!draftConfig) return;

        const newGroup: SkillGroup = {
            id: crypto.randomUUID(),
            name,
        };

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.skillGroups) draftConfig.plugins.skillGroups = [];
        draftConfig.plugins.skillGroups.push({ id: newGroup.id, name: newGroup.name });

        set({
            draftConfig,
            skillGroups: [...skillGroups, newGroup],
            hasUnsavedChanges: true,
        });
    },

    renameSkillGroup: (groupId, name) => {
        const { draftConfig, skillGroups } = get();
        if (!draftConfig) return;

        if (draftConfig.plugins?.skillGroups) {
            const g = draftConfig.plugins.skillGroups.find((g: any) => g.id === groupId);
            if (g) g.name = name;
        }

        set({
            draftConfig,
            skillGroups: skillGroups.map(g => g.id === groupId ? { ...g, name } : g),
            hasUnsavedChanges: true,
        });
    },

    deleteSkillGroup: (groupId) => {
        const { draftConfig, skillGroups, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (draftConfig.plugins?.skillGroups) {
            draftConfig.plugins.skillGroups = draftConfig.plugins.skillGroups.filter(
                (g: any) => g.id !== groupId
            );
        }

        // Remove this group from all skill tags
        if (draftConfig.plugins?.entries) {
            for (const entry of Object.values(draftConfig.plugins.entries) as any[]) {
                if (entry.tags && Array.isArray(entry.tags)) {
                    entry.tags = entry.tags.filter((t: string) => t !== groupId);
                }
            }
        }

        set({
            draftConfig,
            skillGroups: skillGroups.filter((g: SkillGroup) => g.id !== groupId),
        });
        _rederiveLocalState();
    },
}));
