// stores/useCompanionProfileStore.ts
// Manages per-agent COMPANION.md structured character profiles.
// Stored in Supabase companion_profiles table — not OpenClaw.

import { create } from 'zustand';

// ─── Section Types ──────────────────────────────────────────────────────────

export interface CompanionSections {
    concept_backstory: {
        core_wound: string;
        motivation: string;
        life_story: string;
        growth_arc: string;
    };
    appearance: {
        physical: string;
        clothing: string;
        sensory: string;
    };
    personality: {
        big_five: string;
        contradictions: string;
        triggers: string;
        flaws: string;
    };
    speech_patterns: {
        quirks: string;
        mannerisms: string;
        example_dialogue: string;
    };
    scenario_world: {
        scenario: string;
        world_info: string;
        user_dynamics: string;
    };
    nsfw_layer: {
        preferences: string;
        boundaries: string;
        physical_reactions: string;
        emotional_tie: string;
    };
    advanced: {
        internal_conflict: string;
        sensory_rp: string;
        evolution_notes: string;
        randomness: string;
    };
    system_greeting: {
        system_prompt: string;
        first_message: string;
        creator_notes: string;
    };
}

export interface CompanionProfile {
    id?: string;
    agentId: string;
    sections: CompanionSections;
    rawMarkdown?: string;
    updatedAt?: string;
}

// Empty template
export const EMPTY_SECTIONS: CompanionSections = {
    concept_backstory: { core_wound: '', motivation: '', life_story: '', growth_arc: '' },
    appearance: { physical: '', clothing: '', sensory: '' },
    personality: { big_five: '', contradictions: '', triggers: '', flaws: '' },
    speech_patterns: { quirks: '', mannerisms: '', example_dialogue: '' },
    scenario_world: { scenario: '', world_info: '', user_dynamics: '' },
    nsfw_layer: { preferences: '', boundaries: '', physical_reactions: '', emotional_tie: '' },
    advanced: { internal_conflict: '', sensory_rp: '', evolution_notes: '', randomness: '' },
    system_greeting: { system_prompt: '', first_message: '', creator_notes: '' },
};

// ─── Markdown Compiler ──────────────────────────────────────────────────────

export function compileSectionsToMarkdown(sections: CompanionSections, agentName?: string): string {
    const lines: string[] = [];
    const name = agentName || '{{char}}';

    // System prompt override goes first
    if (sections.system_greeting.system_prompt) {
        lines.push(sections.system_greeting.system_prompt);
        lines.push('');
    }

    // Identity block
    if (sections.concept_backstory.core_wound || sections.concept_backstory.motivation) {
        lines.push(`# ${name} — Core Identity`);
        lines.push('');
        if (sections.concept_backstory.core_wound) {
            lines.push(`**Core Wound / Motivation:** ${sections.concept_backstory.core_wound}`);
            lines.push('');
        }
        if (sections.concept_backstory.motivation) {
            lines.push(`**Driving Goal:** ${sections.concept_backstory.motivation}`);
            lines.push('');
        }
    }

    if (sections.concept_backstory.life_story) {
        lines.push('## Backstory');
        lines.push(sections.concept_backstory.life_story);
        lines.push('');
    }

    if (sections.concept_backstory.growth_arc) {
        lines.push('## Growth Arc');
        lines.push(sections.concept_backstory.growth_arc);
        lines.push('');
    }

    // Appearance
    const hasAppearance = Object.values(sections.appearance).some(v => v);
    if (hasAppearance) {
        lines.push(`# Appearance & Physicality`);
        lines.push('');
        if (sections.appearance.physical) lines.push(sections.appearance.physical), lines.push('');
        if (sections.appearance.clothing) lines.push(`**Clothing:** ${sections.appearance.clothing}`), lines.push('');
        if (sections.appearance.sensory) lines.push(`**Sensory Details:** ${sections.appearance.sensory}`), lines.push('');
    }

    // Personality
    const hasPersonality = Object.values(sections.personality).some(v => v);
    if (hasPersonality) {
        lines.push('# Personality & Psychology');
        lines.push('');
        if (sections.personality.big_five) lines.push(`**Traits:** ${sections.personality.big_five}`), lines.push('');
        if (sections.personality.contradictions) lines.push(`**Contradictions:** ${sections.personality.contradictions}`), lines.push('');
        if (sections.personality.triggers) lines.push(`**Triggers & Reactions:** ${sections.personality.triggers}`), lines.push('');
        if (sections.personality.flaws) lines.push(`**Flaws / Vulnerabilities:** ${sections.personality.flaws}`), lines.push('');
    }

    // Speech
    const hasSpeech = Object.values(sections.speech_patterns).some(v => v);
    if (hasSpeech) {
        lines.push('# Speech Patterns & Mannerisms');
        lines.push('');
        if (sections.speech_patterns.quirks) lines.push(sections.speech_patterns.quirks), lines.push('');
        if (sections.speech_patterns.mannerisms) lines.push(`**Mannerisms:** ${sections.speech_patterns.mannerisms}`), lines.push('');
        if (sections.speech_patterns.example_dialogue) {
            lines.push('## Example Dialogue');
            lines.push(sections.speech_patterns.example_dialogue);
            lines.push('');
        }
    }

    // Scenario
    const hasScenario = Object.values(sections.scenario_world).some(v => v);
    if (hasScenario) {
        lines.push('# Scenario & World');
        lines.push('');
        if (sections.scenario_world.scenario) lines.push(sections.scenario_world.scenario), lines.push('');
        if (sections.scenario_world.world_info) lines.push(`**World Info:** ${sections.scenario_world.world_info}`), lines.push('');
        if (sections.scenario_world.user_dynamics) lines.push(`**User Dynamics:** ${sections.scenario_world.user_dynamics}`), lines.push('');
    }

    // NSFW
    const hasNsfw = Object.values(sections.nsfw_layer).some(v => v);
    if (hasNsfw) {
        lines.push('# Intimate & Explicit Layer');
        lines.push('');
        if (sections.nsfw_layer.preferences) lines.push(`**Preferences:** ${sections.nsfw_layer.preferences}`), lines.push('');
        if (sections.nsfw_layer.boundaries) lines.push(`**Boundaries & Consent:** ${sections.nsfw_layer.boundaries}`), lines.push('');
        if (sections.nsfw_layer.physical_reactions) lines.push(`**Physical Reactions:** ${sections.nsfw_layer.physical_reactions}`), lines.push('');
        if (sections.nsfw_layer.emotional_tie) lines.push(`**Emotional Tie-In:** ${sections.nsfw_layer.emotional_tie}`), lines.push('');
    }

    // Advanced
    const hasAdvanced = Object.values(sections.advanced).some(v => v);
    if (hasAdvanced) {
        lines.push('# Advanced Human Touches');
        lines.push('');
        if (sections.advanced.internal_conflict) lines.push(`**Internal Conflict:** ${sections.advanced.internal_conflict}`), lines.push('');
        if (sections.advanced.sensory_rp) lines.push(`**Sensory RP:** ${sections.advanced.sensory_rp}`), lines.push('');
        if (sections.advanced.evolution_notes) lines.push(`**Evolution Notes:** ${sections.advanced.evolution_notes}`), lines.push('');
        if (sections.advanced.randomness) lines.push(`**Randomness / Quirks:** ${sections.advanced.randomness}`), lines.push('');
    }

    // First message & creator notes
    if (sections.system_greeting.first_message) {
        lines.push('# First Message');
        lines.push(sections.system_greeting.first_message);
        lines.push('');
    }
    if (sections.system_greeting.creator_notes) {
        lines.push('# Creator Notes');
        lines.push(sections.system_greeting.creator_notes);
        lines.push('');
    }

    return lines.join('\n').trim();
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface CompanionProfileState {
    profiles: Record<string, CompanionProfile>;     // keyed by agentId
    drafts: Record<string, CompanionSections>;       // unsaved edits keyed by agentId
    isLoading: Record<string, boolean>;
    isSaving: Record<string, boolean>;
    errors: Record<string, string | null>;

    loadProfile: (agentId: string) => Promise<void>;
    saveProfile: (agentId: string, agentName?: string) => Promise<void>;
    updateField: (agentId: string, sectionKey: keyof CompanionSections, fieldKey: string, value: string) => void;
    isDirty: (agentId: string) => boolean;
    getCompiledMarkdown: (agentId: string, agentName?: string) => string;
    getDraft: (agentId: string) => CompanionSections;
}

export const useCompanionProfileStore = create<CompanionProfileState>((set, get) => ({
    profiles: {},
    drafts: {},
    isLoading: {},
    isSaving: {},
    errors: {},

    loadProfile: async (agentId: string) => {
        if (get().isLoading[agentId]) return;
        set(s => ({ isLoading: { ...s.isLoading, [agentId]: true }, errors: { ...s.errors, [agentId]: null } }));

        try {
            const res = await fetch(`/api/companion-profiles?agent_id=${encodeURIComponent(agentId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const profile: CompanionProfile = data.profile
                ? {
                    id: data.profile.id,
                    agentId: data.profile.agent_id,
                    sections: { ...EMPTY_SECTIONS, ...data.profile.sections },
                    rawMarkdown: data.profile.raw_markdown,
                    updatedAt: data.profile.updated_at,
                }
                : { agentId, sections: { ...EMPTY_SECTIONS } };

            set(s => ({
                profiles: { ...s.profiles, [agentId]: profile },
                drafts: { ...s.drafts, [agentId]: JSON.parse(JSON.stringify(profile.sections)) },
                isLoading: { ...s.isLoading, [agentId]: false },
            }));
        } catch (err: any) {
            console.error('[CompanionProfileStore] loadProfile failed:', err);
            set(s => ({
                isLoading: { ...s.isLoading, [agentId]: false },
                errors: { ...s.errors, [agentId]: err.message },
                // Initialize with empty if not loaded
                drafts: { ...s.drafts, [agentId]: s.drafts[agentId] || JSON.parse(JSON.stringify(EMPTY_SECTIONS)) },
            }));
        }
    },

    saveProfile: async (agentId: string, agentName?: string) => {
        const draft = get().drafts[agentId];
        if (!draft) return;

        set(s => ({ isSaving: { ...s.isSaving, [agentId]: true }, errors: { ...s.errors, [agentId]: null } }));

        try {
            const rawMarkdown = compileSectionsToMarkdown(draft, agentName);
            const res = await fetch('/api/companion-profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, sections: draft, raw_markdown: rawMarkdown }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            const profile: CompanionProfile = {
                id: data.profile.id,
                agentId: data.profile.agent_id,
                sections: { ...EMPTY_SECTIONS, ...data.profile.sections },
                rawMarkdown: data.profile.raw_markdown,
                updatedAt: data.profile.updated_at,
            };

            set(s => ({
                profiles: { ...s.profiles, [agentId]: profile },
                drafts: { ...s.drafts, [agentId]: JSON.parse(JSON.stringify(profile.sections)) },
                isSaving: { ...s.isSaving, [agentId]: false },
            }));
        } catch (err: any) {
            console.error('[CompanionProfileStore] saveProfile failed:', err);
            set(s => ({
                isSaving: { ...s.isSaving, [agentId]: false },
                errors: { ...s.errors, [agentId]: err.message },
            }));
        }
    },

    updateField: (agentId, sectionKey, fieldKey, value) => {
        set(s => {
            const currentDraft = s.drafts[agentId] || JSON.parse(JSON.stringify(EMPTY_SECTIONS));
            const section = { ...currentDraft[sectionKey] } as Record<string, string>;
            section[fieldKey] = value;
            return {
                drafts: {
                    ...s.drafts,
                    [agentId]: { ...currentDraft, [sectionKey]: section },
                },
            };
        });
    },

    isDirty: (agentId) => {
        const profile = get().profiles[agentId];
        const draft = get().drafts[agentId];
        if (!draft) return false;
        if (!profile) return true; // No saved profile yet — any content is "dirty"
        return JSON.stringify(profile.sections) !== JSON.stringify(draft);
    },

    getCompiledMarkdown: (agentId, agentName) => {
        const draft = get().drafts[agentId];
        if (!draft) return '';
        return compileSectionsToMarkdown(draft, agentName);
    },

    getDraft: (agentId) => {
        return get().drafts[agentId] || JSON.parse(JSON.stringify(EMPTY_SECTIONS));
    },
}));
