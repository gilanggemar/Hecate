import { create } from 'zustand';

interface SummitTaskStore {
    isOpen: boolean;
    summary: string;
    participants: string[];
    // Track auto-generated task lists parsed from agent replies
    agentTasks: Record<string, string[]>;
    
    openModal: (summary: string, participants: string[]) => void;
    closeModal: () => void;
    setAgentTasks: (agentId: string, tasks: string[]) => void;
}

export const useSummitTaskStore = create<SummitTaskStore>((set) => ({
    isOpen: false,
    summary: '',
    participants: [],
    agentTasks: {},

    openModal: (summary, participants) => set({
        isOpen: true,
        summary,
        participants,
        agentTasks: {}
    }),

    closeModal: () => set({
        isOpen: false,
        summary: '',
        participants: [],
        agentTasks: {}
    }),

    setAgentTasks: (agentId, tasks) => set((state) => ({
        agentTasks: { ...state.agentTasks, [agentId]: tasks }
    }))
}));
