// lib/openclaw/capabilities.ts
// Helper functions for deriving tool/skill state from OpenClaw config

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpenClawTool {
    name: string;
    group?: string;
    description?: string;
    allowed: boolean;
    inherited?: boolean; // true when per-agent has no override
}

export interface OpenClawSkill {
    key: string;
    name: string;
    description?: string;
    enabled: boolean;
    eligible: boolean;
    missingRequirements?: string[];
    inherited?: boolean;
    source?: 'github' | 'skill.sh' | 'manual' | 'inherited';
    sourceUrl?: string;
    tags?: string[];
}

export interface SkillGroup {
    id: string;
    name: string;
}

export interface OpenClawAgent {
    id: string;
    name?: string;
    default?: boolean;
}

// ─── Tool Group Colors ──────────────────────────────────────────────────────

export const TOOL_GROUP_COLORS: Record<string, string> = {
    'runtime': '#f97316',    // orange
    'fs': '#22c55e',         // green
    'sessions': '#6366f1',   // indigo
    'memory': '#8b5cf6',     // violet
    'web': '#3b82f6',        // blue
    'ui': '#ec4899',         // pink
    'automation': '#f59e0b', // amber
    'messaging': '#14b8a6',  // teal
    'nodes': '#64748b',      // slate
};

export const TOOL_GROUP_LABELS: Record<string, string> = {
    'runtime': 'Runtime',
    'fs': 'Filesystem',
    'sessions': 'Sessions',
    'memory': 'Memory',
    'web': 'Web',
    'ui': 'UI',
    'automation': 'Automation',
    'messaging': 'Messaging',
    'nodes': 'Nodes',
};

// ─── Tool Profile Definitions ───────────────────────────────────────────────

export const TOOL_PROFILES: Record<string, string> = {
    'full': 'All tools',
    'coding': 'File I/O, runtime, sessions, memory, image',
    'messaging': 'Messaging, session list/history/send/status',
    'minimal': 'session_status only',
};

// ─── State Derivation Functions ─────────────────────────────────────────────

/**
 * Derive global tool allowed state from config and catalog.
 */
export function deriveGlobalToolState(
    catalogTools: Array<{ name: string; group?: string; description?: string }>,
    config: { tools?: { allow?: string[]; deny?: string[]; profile?: string } }
): OpenClawTool[] {
    const { allow, deny } = config.tools ?? {};

    return catalogTools.map(tool => {
        // Deny always wins over allow
        if (deny?.includes(tool.name) || (tool.group && deny?.includes(`group:${tool.group}`))) {
            return { ...tool, allowed: false };
        }
        // If there's an explicit allowlist, tool must be in it
        if (allow && allow.length > 0) {
            const isAllowed = allow.includes(tool.name) || (tool.group ? allow.includes(`group:${tool.group}`) : false);
            return { ...tool, allowed: isAllowed };
        }
        // Default: all tools are allowed (profile=full)
        return { ...tool, allowed: true };
    });
}

/**
 * Derive per-agent tool allowed state.
 * Falls back to global state if the agent has no tool overrides.
 */
export function derivePerAgentToolState(
    catalogTools: Array<{ name: string; group?: string; description?: string }>,
    agentConfig: { tools?: { allow?: string[]; deny?: string[]; profile?: string } } | undefined,
    globalToolState: OpenClawTool[]
): OpenClawTool[] {
    // If no per-agent tools config, inherit from global
    if (!agentConfig?.tools || (!agentConfig.tools.allow && !agentConfig.tools.deny && !agentConfig.tools.profile)) {
        return globalToolState.map(t => ({ ...t, inherited: true }));
    }

    const { allow, deny } = agentConfig.tools;

    return catalogTools.map(tool => {
        if (deny?.includes(tool.name) || (tool.group && deny?.includes(`group:${tool.group}`))) {
            return { ...tool, allowed: false };
        }
        if (allow && allow.length > 0) {
            const isAllowed = allow.includes(tool.name) || (tool.group ? allow.includes(`group:${tool.group}`) : false);
            return { ...tool, allowed: isAllowed };
        }
        return { ...tool, allowed: true };
    });
}

/**
 * Derive global skill state from skills.status response and config entries.
 */
export function deriveGlobalSkillState(
    skillStatuses: Array<{ key: string; name: string; description?: string; eligible: boolean; missingRequirements?: string[] }>,
    config: { skills?: { entries?: Record<string, { enabled?: boolean }> } }
): OpenClawSkill[] {
    const entries = config.skills?.entries ?? {};

    return skillStatuses.map(skill => ({
        ...skill,
        enabled: entries[skill.key]?.enabled !== false, // default true unless explicitly disabled
    }));
}

/**
 * Derive per-agent skill state.
 * Checks skills.entries.<key>.agents array for per-agent scoping.
 */
export function derivePerAgentSkillState(
    skillStatuses: Array<{ key: string; name: string; description?: string; eligible: boolean; missingRequirements?: string[] }>,
    config: { skills?: { entries?: Record<string, { enabled?: boolean; agents?: string[] }> } },
    agentId: string
): OpenClawSkill[] {
    const entries = config.skills?.entries ?? {};

    return skillStatuses.map(skill => {
        const entry = entries[skill.key];
        const isGloballyEnabled = entry?.enabled !== false;

        // If the skill has an agents array, check if this agent is in it
        if (entry?.agents && Array.isArray(entry.agents)) {
            return {
                ...skill,
                enabled: isGloballyEnabled && entry.agents.includes(agentId),
                inherited: false,
            };
        }

        // No agents array = available to all agents (inherit global state)
        return {
            ...skill,
            enabled: isGloballyEnabled,
            inherited: true,
        };
    });
}

/**
 * Parse agents from config.get response.
 */
export function parseAgentsFromConfig(config: any): OpenClawAgent[] {
    // Try agents.list, agents directly, or agents as array
    let agentsList = config?.agents?.list;
    if (!Array.isArray(agentsList)) {
        agentsList = config?.agents;
    }
    if (!Array.isArray(agentsList)) return [];

    return agentsList.map((agent: any, index: number) => ({
        id: agent.id || agent.agentId || agent.name || `agent-${index}`,
        name: agent.name || agent.id || `Agent ${index + 1}`,
        default: agent.default === true || index === 0,
    }));
}

/**
 * Parse tools from tools.catalog response.
 */
export function parseCatalogTools(catalog: any): Array<{ name: string; group?: string; description?: string }> {
    if (!catalog) return [];

    // Unwrap common response wrappers
    const unwrapped = catalog?.payload?.catalog || catalog?.payload?.tools || catalog?.payload
        || catalog?.catalog || catalog?.result?.tools || catalog?.result
        || catalog;

    // Helper to extract tools from a flat array of tool objects
    const mapToolArray = (arr: any[]) => arr
        .map((t: any) => ({
            name: t.name || t.id || t.tool || t.toolName || '',
            group: (t.group || t.category || '')?.replace('group:', '') || undefined,
            description: t.description || t.desc || t.summary || undefined,
        }))
        .filter(t => t.name);

    // Case 1: Direct array of tools
    if (Array.isArray(unwrapped)) {
        return mapToolArray(unwrapped);
    }

    // Case 2: Object with `groups` array — OpenClaw format:
    // { groups: [{ id: "fs", label: "Files", tools: [{ id: "read", description: "..." }] }] }
    if (unwrapped?.groups && Array.isArray(unwrapped.groups)) {
        const tools: Array<{ name: string; group?: string; description?: string }> = [];
        for (const group of unwrapped.groups) {
            const groupName = group.label || group.id || 'other';
            if (Array.isArray(group.tools)) {
                for (const t of group.tools) {
                    tools.push({
                        name: t.id || t.name || t.tool || '',
                        group: groupName,
                        description: t.description || t.desc || t.summary || undefined,
                    });
                }
            }
        }
        if (tools.filter(t => t.name).length > 0) {
            console.log(`[Capabilities] Parsed ${tools.length} tools from ${unwrapped.groups.length} groups`);
            return tools.filter(t => t.name);
        }
    }

    // Case 3: Object with a `tools` array
    if (unwrapped?.tools && Array.isArray(unwrapped.tools)) {
        return mapToolArray(unwrapped.tools);
    }

    // Case 4: Object with `items` array
    if (unwrapped?.items && Array.isArray(unwrapped.items)) {
        return mapToolArray(unwrapped.items);
    }

    // Case 5: Object keyed by group name → array of tools per group
    if (unwrapped && typeof unwrapped === 'object') {
        const tools: Array<{ name: string; group?: string; description?: string }> = [];
        for (const [groupName, groupValue] of Object.entries(unwrapped)) {
            // Skip metadata fields
            if (['type', 'ok', 'id', 'method', 'hash', 'error', 'payload', 'status', 'agentId', 'profiles', 'groups'].includes(groupName)) continue;

            if (Array.isArray(groupValue)) {
                for (const t of groupValue as any[]) {
                    if (typeof t === 'string') {
                        tools.push({ name: t, group: groupName.replace('group:', '') });
                    } else if (typeof t === 'object' && t) {
                        tools.push({
                            name: t.name || t.id || t.tool || t.toolName || '',
                            group: groupName.replace('group:', ''),
                            description: t.description || t.desc || t.summary || undefined,
                        });
                    }
                }
            }
        }
        if (tools.filter(t => t.name).length > 0) return tools.filter(t => t.name);
    }

    console.warn('[Capabilities] parseCatalogTools: could not parse catalog format:', typeof unwrapped, Object.keys(unwrapped || {}));
    return [];
}

/**
 * Parse skills from skills.status response.
 */
export function parseSkillStatuses(statusResponse: any): Array<{ key: string; name: string; description?: string; eligible: boolean; missingRequirements?: string[] }> {
    const skills = statusResponse?.skills || statusResponse;
    if (!Array.isArray(skills)) {
        // Maybe it's an object keyed by skill key
        if (skills && typeof skills === 'object') {
            return Object.entries(skills).map(([key, val]: [string, any]) => ({
                key,
                name: val.name || key,
                description: val.description || undefined,
                eligible: val.eligible !== false,
                missingRequirements: val.missingRequirements || val.missing || undefined,
            }));
        }
        return [];
    }

    return skills.map((s: any) => ({
        key: s.key || s.skillKey || s.id || s.name || '',
        name: s.name || s.key || s.id || '',
        description: s.description || undefined,
        eligible: s.eligible !== false,
        missingRequirements: s.missingRequirements || s.missing || undefined,
    }));
}
