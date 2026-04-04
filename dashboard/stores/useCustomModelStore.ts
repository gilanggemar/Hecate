// stores/useCustomModelStore.ts
// Zustand store for user-defined custom LLM models.
// These models are persisted in Supabase and appear in agent model dropdowns.

import { create } from 'zustand';

export interface CustomModel {
    id: string;
    providerType: string;
    providerName: string;
    modelId: string;
    displayName: string;
    baseUrl?: string;
    contextWindow?: number;
    isActive: boolean;
    maskedKey?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CustomModelState {
    models: CustomModel[];
    isLoading: boolean;
    error: string | null;
    hasFetched: boolean;

    // Actions
    fetchModels: () => Promise<void>;
    addModel: (model: CustomModel) => void;
    removeModel: (id: string) => Promise<void>;
}

export const useCustomModelStore = create<CustomModelState>((set, get) => ({
    models: [],
    isLoading: false,
    error: null,
    hasFetched: false,

    fetchModels: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
            const res = await fetch('/api/custom-models');
            if (!res.ok) throw new Error('Failed to fetch custom models');
            const data = await res.json();
            set({ models: Array.isArray(data) ? data : [], hasFetched: true });
        } catch (err: any) {
            console.error('[CustomModelStore] fetch failed:', err);
            set({ error: err.message || 'Failed to load custom models' });
        } finally {
            set({ isLoading: false });
        }
    },

    addModel: (model) => {
        set((state) => ({
            models: [model, ...state.models],
        }));
    },

    removeModel: async (id) => {
        try {
            const res = await fetch(`/api/custom-models/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            set((state) => ({
                models: state.models.filter((m) => m.id !== id),
            }));
        } catch (err: any) {
            console.error('[CustomModelStore] delete failed:', err);
        }
    },
}));
