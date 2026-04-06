// stores/usePentagramChatStore.ts
// Manages in-game companion chat for Pentagram Protocol:
// character registry, per-character conversations, save/load, gossip settings.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PentagramCharacter {
    id: string;            // agent id e.g. 'ivy'
    name: string;
    avatar?: string;
    colorHex: string;
    hidden: boolean;       // user can hide from the bar
    addedAt: string;       // ISO timestamp
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

export interface GameSaveEntry {
    id: string;
    save_name: string;
    created_at: string;
    updated_at: string;
}

interface PentagramChatState {
    // Character registry (persisted locally)
    characters: PentagramCharacter[];

    // Active character being chatted with
    activeCharacterId: string | null;

    // Per-character message history (loaded from DB)
    conversations: Record<string, ChatMessage[]>;

    // Chat UI state
    isChatOpen: boolean;
    isStreaming: boolean;
    streamingContent: string;

    // Gossip frequency (0-1)
    gossipFrequency: number;

    // Save slots
    saves: GameSaveEntry[];

    // Actions
    setActiveCharacter: (agentId: string) => void;
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
    setGossipFrequency: (freq: number) => void;

    // Character management
    syncCharactersFromRoster: (connectedAgents: { id: string; name: string; avatar?: string; colorHex: string }[]) => void;
    toggleCharacterVisibility: (agentId: string) => void;

    // Chat operations
    loadChatHistory: (agentId: string) => Promise<void>;
    sendMessage: (content: string, gameContext: any) => Promise<void>;
    clearConversation: (agentId: string) => Promise<void>;
    addLocalMessage: (agentId: string, msg: ChatMessage) => void;

    // Save/Load
    loadSaves: () => Promise<void>;
    createSave: (saveName: string, gameData: any) => Promise<void>;
    loadSave: (saveId: string) => Promise<any>;
    deleteSave: (saveId: string) => Promise<void>;
}

export const usePentagramChatStore = create<PentagramChatState>()(
    persist(
        (set, get) => ({
            characters: [],
            activeCharacterId: null,
            conversations: {},
            isChatOpen: false,
            isStreaming: false,
            streamingContent: '',
            gossipFrequency: 0.4,
            saves: [],

            setActiveCharacter: (agentId) => {
                set({ activeCharacterId: agentId });
                // Load history if not already loaded
                const convos = get().conversations;
                if (!convos[agentId] || convos[agentId].length === 0) {
                    get().loadChatHistory(agentId);
                }
            },

            toggleChat: () => set(s => ({ isChatOpen: !s.isChatOpen })),
            openChat: () => set({ isChatOpen: true }),
            closeChat: () => set({ isChatOpen: false }),

            setGossipFrequency: (freq) => set({ gossipFrequency: Math.max(0, Math.min(1, freq)) }),

            syncCharactersFromRoster: (connectedAgents) => {
                const existing = get().characters;
                const existingIds = new Set(existing.map(c => c.id));

                // Add new agents that aren't already registered
                const newChars = connectedAgents
                    .filter(a => !existingIds.has(a.id))
                    .map(a => ({
                        id: a.id,
                        name: a.name,
                        avatar: a.avatar,
                        colorHex: a.colorHex,
                        hidden: false,
                        addedAt: new Date().toISOString(),
                    }));

                // Update existing characters' name/avatar/color in case they changed
                const updatedExisting = existing.map(c => {
                    const fresh = connectedAgents.find(a => a.id === c.id);
                    if (fresh) {
                        return { ...c, name: fresh.name, avatar: fresh.avatar, colorHex: fresh.colorHex };
                    }
                    return c; // Keep disconnected agents as-is
                });

                set({ characters: [...updatedExisting, ...newChars] });
            },

            toggleCharacterVisibility: (agentId) => {
                set(s => ({
                    characters: s.characters.map(c =>
                        c.id === agentId ? { ...c, hidden: !c.hidden } : c
                    ),
                }));
            },

            loadChatHistory: async (agentId) => {
                try {
                    const res = await fetch(`/api/pentagram-chat/history?agent_id=${encodeURIComponent(agentId)}`);
                    if (!res.ok) return;
                    const data = await res.json();
                    const msgs: ChatMessage[] = data.map((d: any) => ({
                        id: d.id,
                        role: d.role,
                        content: d.content,
                        timestamp: d.created_at,
                    }));
                    set(s => ({
                        conversations: { ...s.conversations, [agentId]: msgs },
                    }));
                } catch (e) {
                    console.warn('[pentagram-chat] Failed to load history:', e);
                }
            },

            sendMessage: async (content, gameContext) => {
                const { activeCharacterId, conversations, gossipFrequency, characters } = get();
                if (!activeCharacterId || get().isStreaming) return;

                const char = characters.find(c => c.id === activeCharacterId);
                if (!char) return;

                // Add user message locally
                const userMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content,
                    timestamp: new Date().toISOString(),
                };

                const currentMsgs = conversations[activeCharacterId] || [];
                const updatedMsgs = [...currentMsgs, userMsg];
                set(s => ({
                    conversations: { ...s.conversations, [activeCharacterId]: updatedMsgs },
                    isStreaming: true,
                    streamingContent: '',
                }));

                try {
                    // Dynamically import stores to avoid circular deps
                    const { useOpenClawModelStore } = await import('@/stores/useOpenClawModelStore');
                    const { useCompanionProfileStore } = await import('@/stores/useCompanionProfileStore');

                    const modelStore = useOpenClawModelStore.getState();
                    const companionStore = useCompanionProfileStore.getState();

                    // Resolve companion model
                    const getModel = (role: string): string => {
                        return modelStore.activeModels[role as keyof typeof modelStore.activeModels]?.[activeCharacterId]
                            || modelStore.defaults[role as keyof typeof modelStore.defaults]
                            || '';
                    };
                    const modelRef = getModel('companion_chat') || getModel('companion') || '';

                    // Get companion profile system prompt
                    await companionStore.loadProfile(activeCharacterId);
                    const systemPrompt = companionStore.getCompiledMarkdown(activeCharacterId, char.name);

                    // Build message history for API (last 30 messages for context window)
                    const historyForApi = updatedMsgs
                        .filter(m => m.role !== 'system')
                        .slice(-30)
                        .map(m => ({ role: m.role, content: m.content }));

                    const res = await fetch('/api/pentagram-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agent_id: activeCharacterId,
                            agent_name: char.name,
                            model_ref: modelRef,
                            system_prompt: systemPrompt,
                            messages: historyForApi,
                            game_context: gameContext,
                            gossip_frequency: gossipFrequency,
                        }),
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(errText);
                    }

                    // Stream the response
                    const reader = res.body?.getReader();
                    if (!reader) throw new Error('No stream');

                    const decoder = new TextDecoder();
                    let fullResponse = '';
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data:')) continue;
                            const payload = trimmed.slice(5).trim();
                            if (payload === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(payload);
                                if (parsed.content) {
                                    fullResponse += parsed.content;
                                    set({ streamingContent: fullResponse });
                                }
                            } catch {}
                        }
                    }

                    // Finalize: add assistant message
                    if (fullResponse) {
                        const assistantMsg: ChatMessage = {
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: fullResponse,
                            timestamp: new Date().toISOString(),
                        };

                        set(s => ({
                            conversations: {
                                ...s.conversations,
                                [activeCharacterId]: [...(s.conversations[activeCharacterId] || []), assistantMsg],
                            },
                            isStreaming: false,
                            streamingContent: '',
                        }));
                    } else {
                        set({ isStreaming: false, streamingContent: '' });
                    }
                } catch (e) {
                    console.error('[pentagram-chat] Send failed:', e);
                    set({ isStreaming: false, streamingContent: '' });
                }
            },

            clearConversation: async (agentId) => {
                try {
                    await fetch(`/api/pentagram-chat/history?agent_id=${encodeURIComponent(agentId)}`, {
                        method: 'DELETE',
                    });
                } catch (e) {
                    console.warn('[pentagram-chat] Clear failed:', e);
                }
                set(s => ({
                    conversations: { ...s.conversations, [agentId]: [] },
                }));
            },

            addLocalMessage: (agentId, msg) => {
                set(s => ({
                    conversations: {
                        ...s.conversations,
                        [agentId]: [...(s.conversations[agentId] || []), msg],
                    },
                }));
            },

            loadSaves: async () => {
                try {
                    const res = await fetch('/api/pentagram-saves');
                    if (!res.ok) return;
                    const data = await res.json();
                    set({ saves: data });
                } catch (e) {
                    console.warn('[pentagram-saves] Load failed:', e);
                }
            },

            createSave: async (saveName, gameData) => {
                try {
                    const res = await fetch('/api/pentagram-saves', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ save_name: saveName, save_data: gameData }),
                    });
                    if (res.ok) {
                        await get().loadSaves();
                    }
                } catch (e) {
                    console.error('[pentagram-saves] Save failed:', e);
                }
            },

            loadSave: async (saveId) => {
                try {
                    const res = await fetch('/api/pentagram-saves', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ save_id: saveId }),
                    });
                    if (!res.ok) throw new Error('Load failed');
                    const data = await res.json();
                    return data.save_data;
                } catch (e) {
                    console.error('[pentagram-saves] Load failed:', e);
                    return null;
                }
            },

            deleteSave: async (saveId) => {
                try {
                    await fetch(`/api/pentagram-saves?id=${encodeURIComponent(saveId)}`, {
                        method: 'DELETE',
                    });
                    await get().loadSaves();
                } catch (e) {
                    console.warn('[pentagram-saves] Delete failed:', e);
                }
            },
        }),
        {
            name: 'pentagram-chat-v1',
            partialize: (state) => ({
                characters: state.characters,
                gossipFrequency: state.gossipFrequency,
                // Don't persist conversations or streaming state — load from DB
            }),
        }
    )
);
