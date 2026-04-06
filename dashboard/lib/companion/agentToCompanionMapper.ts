// lib/companion/agentToCompanionMapper.ts
// Maps OpenClaw AgentArchitecture → CompanionSections.
// When switching to companion mode for an agent, if the companion profile is empty,
// we auto-populate it from the agent's real persona files (SOUL.md, IDENTITY.md, AGENTS.md, etc.)
// This gives users a pre-filled companion card instead of starting from scratch.

import type { AgentArchitecture } from '@/lib/constellation/agentSchema';
import { createEmptyAgent } from '@/lib/constellation/agentSchema';
import { parseAgentFiles } from '@/lib/constellation/markdownParser';
import type { CompanionSections } from '@/stores/useCompanionProfileStore';
import { EMPTY_SECTIONS } from '@/stores/useCompanionProfileStore';
import { getGateway } from '@/lib/openclawGateway';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Join array items into a readable bullet list or comma-separated string */
function bulletList(items: string[]): string {
    const filtered = items.filter(s => s.trim());
    if (filtered.length === 0) return '';
    if (filtered.length <= 3) return filtered.join(', ');
    return filtered.map(s => `- ${s}`).join('\n');
}

/** Truncate long text for better companion card UX */
function cap(text: string, max: number = 1500): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── Fetch & Parse Agent Files from Gateway ─────────────────────────────────

/**
 * Fetches the agent's workspace files directly from the OpenClaw Gateway
 * and parses them into an AgentArchitecture object.
 * This is independent of the constellation store — works from any page.
 */
export async function fetchAndParseAgentFiles(agentId: string): Promise<AgentArchitecture | null> {
    const gw = getGateway();
    if (!gw.isConnected) {
        console.warn(`[AgentToCompanion] Gateway not connected, can't fetch files for ${agentId}`);
        return null;
    }

    try {
        // 1. List workspace files
        const listRes = await gw.request('agents.files.list', { agentId });
        const fileList: Array<{ name: string; size: number; modified: number }> =
            listRes?.files ?? (Array.isArray(listRes) ? listRes : []);

        const mdFiles = fileList.filter(f => f.name.endsWith('.md'));
        if (mdFiles.length === 0) {
            console.warn(`[AgentToCompanion] No .md files found for agent "${agentId}"`);
            return null;
        }

        // 2. Fetch content for each .md file
        const fileContents: Record<string, string> = {};

        for (const file of mdFiles) {
            try {
                const res = await gw.request('agents.files.get', { agentId, name: file.name });
                let content = '';
                if (typeof res === 'string') {
                    content = res;
                } else if (res && typeof res === 'object') {
                    content = res.content ?? res.text ?? res.body ?? res.data ?? '';
                    if (!content && res.file && typeof res.file === 'object') {
                        content = res.file.content ?? res.file.text ?? '';
                    }
                }
                if (content) {
                    fileContents[file.name] = content;
                }
            } catch (e) {
                console.warn(`[AgentToCompanion] Failed to fetch ${file.name} for ${agentId}:`, e);
            }
        }

        if (Object.keys(fileContents).length === 0) {
            console.warn(`[AgentToCompanion] No file contents retrieved for agent "${agentId}"`);
            return null;
        }

        // 3. Parse into AgentArchitecture
        const parsed = parseAgentFiles(agentId, fileContents, false);
        const agent = createEmptyAgent(agentId);

        // Merge parsed data
        function mergeLayer<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
            const result = { ...base };
            for (const [k, v] of Object.entries(patch)) {
                if (v === undefined || v === null) continue;
                if (typeof v === 'string' && v.trim() === '') continue;
                if (Array.isArray(v) && v.length === 0) continue;
                (result as any)[k] = v;
            }
            return result;
        }

        const merged: AgentArchitecture = {
            ...agent,
            roleCharter: mergeLayer(agent.roleCharter, parsed.roleCharter || {}),
            boundaries: mergeLayer(agent.boundaries, parsed.boundaries || {}),
            doctrine: mergeLayer(agent.doctrine, parsed.doctrine || {}),
            operationalProtocol: mergeLayer(agent.operationalProtocol, parsed.operationalProtocol || {}),
            memoryPolicy: mergeLayer(agent.memoryPolicy, parsed.memoryPolicy || {}),
            characterLayer: mergeLayer(agent.characterLayer, parsed.characterLayer || {}),
            identityCard: mergeLayer(agent.identityCard, parsed.identityCard || {}),
            userContext: mergeLayer(agent.userContext, parsed.userContext || {}),
            toolGuide: mergeLayer(agent.toolGuide, parsed.toolGuide || {}),
            heartbeat: mergeLayer(agent.heartbeat, parsed.heartbeat || {}),
        };

        // Override top-level fields from parsed identity
        if (parsed.identityCard?.codename) merged.codename = parsed.identityCard.codename;
        if (parsed.identityCard?.role) merged.executiveRole = parsed.identityCard.role;
        if (parsed.identityCard?.name) merged.name = parsed.identityCard.name;

        console.log(`[AgentToCompanion] Parsed ${agentId}: name="${merged.name}" personality="${merged.characterLayer.personality?.slice(0, 80)}…"`);
        return merged;
    } catch (err) {
        console.error(`[AgentToCompanion] fetchAndParseAgentFiles(${agentId}) failed:`, err);
        return null;
    }
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

/**
 * Maps an OpenClaw AgentArchitecture to CompanionSections.
 */
export function mapAgentToCompanion(agent: AgentArchitecture): CompanionSections {
    const cl = agent.characterLayer;
    const id = agent.identityCard;
    const rc = agent.roleCharter;
    const op = agent.operationalProtocol;

    const sections: CompanionSections = JSON.parse(JSON.stringify(EMPTY_SECTIONS));

    // ─── Concept & Backstory ────────────────────────────────────────────
    sections.concept_backstory.core_wound = [
        rc.mission,
        rc.whyThisRoleExists ? `Why: ${rc.whyThisRoleExists}` : '',
    ].filter(Boolean).join('\n\n') || '';

    sections.concept_backstory.motivation = id.oneLiner || rc.costOfWeakness || '';
    sections.concept_backstory.life_story = id.coreIdentity || '';
    sections.concept_backstory.growth_arc = id.operatingStyle || '';

    // ─── Personality & Psychology ────────────────────────────────────────
    sections.personality.big_five = cap(cl.personality) || '';
    sections.personality.contradictions = cap(cl.emotionalLogic) || '';
    sections.personality.triggers = cap(cl.worldview) || '';
    sections.personality.flaws = cl.forbiddenHabits.length > 0
        ? bulletList(cl.forbiddenHabits)
        : '';

    // ─── Speech Patterns & Mannerisms ───────────────────────────────────
    const voiceLines: string[] = [];
    if (cl.tone) voiceLines.push(`**Tone:** ${cl.tone}`);
    if (cl.voiceMarkers.length > 0) voiceLines.push(`**Voice Markers:**\n${bulletList(cl.voiceMarkers)}`);
    sections.speech_patterns.quirks = voiceLines.join('\n\n') || '';

    const mannerLines: string[] = [];
    if (cl.conversationalFingerprint) mannerLines.push(cl.conversationalFingerprint);
    if (cl.pacing) mannerLines.push(`**Pacing:** ${cl.pacing}`);
    sections.speech_patterns.mannerisms = mannerLines.join('\n\n') || '';

    sections.speech_patterns.example_dialogue = '';

    // ─── Scenario & World ───────────────────────────────────────────────
    sections.scenario_world.scenario = rc.scopeOfResponsibility || '';

    const worldParts: string[] = [];
    if (id.role) worldParts.push(`**Role:** ${id.role}`);
    if (id.codename) worldParts.push(`**Codename:** ${id.codename}`);
    if (rc.title) worldParts.push(`**Title:** ${rc.title}`);
    sections.scenario_world.world_info = worldParts.join('\n') || '';

    sections.scenario_world.user_dynamics = id.teamRelationship || '';

    // ─── Advanced Human Touches ─────────────────────────────────────────
    sections.advanced.internal_conflict = rc.costOfWeakness || '';
    sections.advanced.sensory_rp = cl.pacing || '';
    sections.advanced.evolution_notes = cap(op.defaultBehavior) || '';
    sections.advanced.randomness = op.formattingHabits.length > 0
        ? bulletList(op.formattingHabits)
        : '';

    // ─── System & Greeting ──────────────────────────────────────────────
    const sysParts: string[] = [];
    sysParts.push(`You are ${agent.name}${id.codename ? ` (${id.codename})` : ''}.`);
    if (id.oneLiner) sysParts.push(id.oneLiner);
    if (rc.mission) sysParts.push(`\nYour mission: ${rc.mission}`);
    if (cl.personality) sysParts.push(`\nPersonality: ${cl.personality}`);
    if (cl.tone) sysParts.push(`\nTone: ${cl.tone}`);
    if (cl.conversationalFingerprint) sysParts.push(`\nVoice: ${cl.conversationalFingerprint}`);
    if (cl.forbiddenHabits.length > 0) {
        sysParts.push(`\nNever do:\n${bulletList(cl.forbiddenHabits)}`);
    }
    sections.system_greeting.system_prompt = sysParts.join('\n');

    sections.system_greeting.first_message = '';
    sections.system_greeting.creator_notes =
        `Auto-generated from ${agent.name}'s OpenClaw agent files (SOUL.md, IDENTITY.md, AGENTS.md). ` +
        `Edit any section to customize the companion persona.`;

    return sections;
}

/**
 * Check if a CompanionSections object is essentially empty (all fields blank).
 */
export function isCompanionSectionsEmpty(sections: CompanionSections): boolean {
    for (const sectionKey of Object.keys(sections) as (keyof CompanionSections)[]) {
        const section = sections[sectionKey] as Record<string, string>;
        for (const val of Object.values(section)) {
            if (val && val.trim().length > 0) return false;
        }
    }
    return true;
}
