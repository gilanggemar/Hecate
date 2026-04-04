// stores/useCompanionModeStore.ts
// Per-agent companion mode toggle state.
// Default: agent mode (false). When toggled to true, the chat system
// will use the companion model (if configured) instead of the primary model.

import { create } from 'zustand';

interface CompanionModeState {
    // Map of agentId → boolean (true = companion mode)
    companionModes: Record<string, boolean>;

    // Check if a specific agent is in companion mode
    isCompanionMode: (agentId: string) => boolean;

    // Toggle companion mode for a specific agent
    toggleCompanionMode: (agentId: string) => void;

    // Set companion mode for a specific agent
    setCompanionMode: (agentId: string, enabled: boolean) => void;
}

export const useCompanionModeStore = create<CompanionModeState>((set, get) => ({
    companionModes: {},

    isCompanionMode: (agentId: string) => {
        return get().companionModes[agentId] ?? false;
    },

    toggleCompanionMode: (agentId: string) => {
        set((state) => ({
            companionModes: {
                ...state.companionModes,
                [agentId]: !(state.companionModes[agentId] ?? false),
            },
        }));
    },

    setCompanionMode: (agentId: string, enabled: boolean) => {
        set((state) => ({
            companionModes: {
                ...state.companionModes,
                [agentId]: enabled,
            },
        }));
    },
}));
