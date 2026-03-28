import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentSettingsState {
    hiddenAgentIds: string[];
    agentTags: Record<string, string[]>;
    toggleAgentVisibility: (agentId: string) => void;
    setAgentVisibility: (agentId: string, isHidden: boolean) => void;
    addTagToAgent: (agentId: string, tag: string) => void;
    removeTagFromAgent: (agentId: string, tag: string) => void;
    getAgentTags: (agentId: string) => string[];
}

export const useAgentSettingsStore = create<AgentSettingsState>()(
    persist(
        (set, get) => ({
            hiddenAgentIds: [],
            agentTags: {},
            toggleAgentVisibility: (agentId) => set((state) => {
                const isHidden = state.hiddenAgentIds.includes(agentId);
                if (isHidden) {
                    return { hiddenAgentIds: state.hiddenAgentIds.filter((id) => id !== agentId) };
                } else {
                    return { hiddenAgentIds: [...state.hiddenAgentIds, agentId] };
                }
            }),
            setAgentVisibility: (agentId, isHidden) => set((state) => {
                const currentlyHidden = state.hiddenAgentIds.includes(agentId);
                if (isHidden && !currentlyHidden) {
                    return { hiddenAgentIds: [...state.hiddenAgentIds, agentId] };
                }
                if (!isHidden && currentlyHidden) {
                    return { hiddenAgentIds: state.hiddenAgentIds.filter((id) => id !== agentId) };
                }
                return state;
            }),
            addTagToAgent: (agentId, tag) => set((state) => {
                const current = state.agentTags[agentId] || [];
                const trimmed = tag.trim();
                if (!trimmed || current.includes(trimmed)) return state;
                return {
                    agentTags: {
                        ...state.agentTags,
                        [agentId]: [...current, trimmed],
                    },
                };
            }),
            removeTagFromAgent: (agentId, tag) => set((state) => {
                const current = state.agentTags[agentId] || [];
                return {
                    agentTags: {
                        ...state.agentTags,
                        [agentId]: current.filter((t) => t !== tag),
                    },
                };
            }),
            getAgentTags: (agentId) => {
                return get().agentTags[agentId] || [];
            },
        }),
        {
            name: 'agent-settings-storage',
        }
    )
);
