"use client";

import { useEffect, useState, useCallback } from "react";
import { usePentagramStore } from "@/stores/usePentagramStore";
import { usePentagramChatStore } from "@/stores/usePentagramChatStore";
import { AGENT_ROSTER } from "@/lib/agentRoster";
import { VisualNovelScreen } from "./VisualNovelScreen";
import { DevToolsPanel } from "./DevToolsPanel";
import { InteractSceneEditor } from "./InteractSceneEditor";
import { PentagramChatPanel } from "./PentagramChatPanel";
import { ChevronRight, ArrowLeft, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentAvatar } from "@/hooks/useAgentAvatar";

// ─── Character Portrait ─────────────────────────────────────────────────────

function CharacterPortrait({
    character,
    isActive,
    onClick,
}: {
    character: { id: string; name: string; avatar?: string; colorHex: string };
    isActive: boolean;
    onClick: () => void;
}) {
    const { avatarUri } = useAgentAvatar(character.id);

    return (
        <button
            onClick={onClick}
            className={cn(
                "relative flex flex-col items-center gap-1 transition-all duration-300 group",
                isActive ? "scale-105" : "opacity-60 hover:opacity-90"
            )}
            title={character.name}
        >
            <div
                className={cn(
                    "w-10 h-14 rounded-md overflow-hidden bg-cover bg-center border-[1.5px] transition-all duration-300 relative flex items-center justify-center font-bold text-xs text-white/90",
                    isActive ? "border-current" : "border-transparent"
                )}
                style={{
                    backgroundImage: avatarUri ? `url(${avatarUri})` : 'none',
                    backgroundColor: avatarUri ? 'transparent' : character.colorHex || '#222',
                    borderColor: isActive ? character.colorHex : 'rgba(255,255,255,0.15)',
                    boxShadow: isActive ? `0 0 12px ${character.colorHex}50, 0 0 4px ${character.colorHex}30` : 'none',
                }}
            >
                {!avatarUri && character.name.substring(0, 2).toUpperCase()}
            </div>
        </button>
    );
}

function CharacterSelector() {
    const { characters, activeCharacterId, setActiveCharacter } = usePentagramChatStore();
    const visibleChars = characters.filter(c => !c.hidden);
    
    if (visibleChars.length === 0) return null;
    
    return (
        <div className="flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md rounded-xl px-1.5 py-3 border border-white/10 pointer-events-auto shadow-2xl w-[52px]">
            {visibleChars.map(c => (
                <CharacterPortrait
                    key={c.id}
                    character={c}
                    isActive={c.id === activeCharacterId}
                    onClick={() => setActiveCharacter(c.id)}
                />
            ))}
        </div>
    );
}


interface PentagramArenaPanelProps {
    onExit?: () => void;
}

export function PentagramArenaPanel({ onExit }: PentagramArenaPanelProps) {
    const restartGame = usePentagramStore((s) => s.restartGame);
    const isInteractEditorOpen = usePentagramStore((s) => s.isInteractEditorOpen);
    const setInteractEditorOpen = usePentagramStore((s) => s.setInteractEditorOpen);
    const [devToolsOpen, setDevToolsOpen] = useState(true);

    const syncCharacters = usePentagramChatStore((s) => s.syncCharactersFromRoster);
    const createSave = usePentagramChatStore((s) => s.createSave);
    const loadSaveData = usePentagramChatStore((s) => s.loadSave);

    useEffect(() => {
        restartGame();
    }, [restartGame]);

    // Sync all connected agents into the character registry
    useEffect(() => {
        const agents = AGENT_ROSTER.map(a => ({
            id: a.id,
            name: a.name,
            avatar: a.avatar,
            colorHex: a.colorHex,
        }));
        syncCharacters(agents);
    }, [syncCharacters]);

    // Save game handler
    const handleSaveGame = useCallback(async (saveName: string) => {
        const store = usePentagramStore.getState();
        const chatStore = usePentagramChatStore.getState();

        const saveData = {
            // VN game state
            gameState: store.gameState,
            currentSceneId: store.currentSceneId,
            history: store.history,
            // Chat conversations snapshot
            conversations: chatStore.conversations,
            // Character registry snapshot
            characters: chatStore.characters,
            // Gossip settings
            gossipFrequency: chatStore.gossipFrequency,
            // Timestamp
            savedAt: new Date().toISOString(),
        };

        await createSave(saveName, saveData);
    }, [createSave]);

    // Load game handler
    const handleLoadGame = useCallback(async (saveId: string) => {
        const saveData = await loadSaveData(saveId);
        if (!saveData) return;

        // Restore VN game state
        const store = usePentagramStore.getState();
        if (saveData.gameState) {
            Object.entries(saveData.gameState).forEach(([key, val]) => {
                store.updateVariable(key as any, val as any);
            });
        }
        if (saveData.currentSceneId) {
            store.jumpToScene(saveData.currentSceneId);
        }

        // Restore chat state
        const chatStore = usePentagramChatStore.getState();
        if (saveData.conversations) {
            // Replace conversations in the store
            usePentagramChatStore.setState({ conversations: saveData.conversations });
        }
        if (saveData.gossipFrequency !== undefined) {
            chatStore.setGossipFrequency(saveData.gossipFrequency);
        }
    }, [loadSaveData]);

    return (
        <div className="w-full h-full flex relative overflow-hidden bg-black">
            
            {/* Main: Visual Novel Screen — fills all available space */}
            <div id="pentagram-vn-container" className="flex-1 min-w-0 h-full relative">
                
                {/* Floating header bar inside the game — sits above the VN */}
                <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-4 px-6 py-4 pointer-events-none">
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest bg-black/60 backdrop-blur-md border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 transition-all rounded-lg"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> End Session
                        </button>
                    )}
                    <h2 className="text-lg font-black uppercase tracking-tight text-white/80 pointer-events-none">
                        PENTAGRAM <span className="text-orange-500">PROTOCOL</span>
                    </h2>
                    
                    {/* Character Selector moved to Left Sidebar context below */}

                    <button
                        onClick={() => setInteractEditorOpen(!isInteractEditorOpen)}
                        className={cn(
                            "pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md border rounded-lg transition-all ml-auto",
                            isInteractEditorOpen
                                ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                                : "bg-black/60 border-white/10 text-neutral-400 hover:text-white hover:border-white/30"
                        )}
                    >
                        <Settings2 className="w-3.5 h-3.5" /> Interact Editor
                    </button>
                </div>

                {/* VN fills entire area */}
                <div className="absolute inset-0">
                    <VisualNovelScreen />
                </div>

                {/* Left Screen Blur Mask (Spans from left edge up to chat's right edge) */}
                <div 
                    className="absolute top-0 bottom-0 left-0 bg-black/40 backdrop-blur-sm z-20 pointer-events-none"
                    style={{ 
                        width: `calc(26% + clamp(190px, 22.5vw, 320px) + 100px)`,
                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 250px), rgba(0,0,0,0.98) calc(100% - 220px), rgba(0,0,0,0.92) calc(100% - 190px), rgba(0,0,0,0.81) calc(100% - 160px), rgba(0,0,0,0.67) calc(100% - 130px), rgba(0,0,0,0.5) calc(100% - 100px), rgba(0,0,0,0.33) calc(100% - 75px), rgba(0,0,0,0.17) calc(100% - 50px), rgba(0,0,0,0.05) calc(100% - 25px), transparent 100%)',
                        maskImage: 'linear-gradient(to right, black calc(100% - 250px), rgba(0,0,0,0.98) calc(100% - 220px), rgba(0,0,0,0.92) calc(100% - 190px), rgba(0,0,0,0.81) calc(100% - 160px), rgba(0,0,0,0.67) calc(100% - 130px), rgba(0,0,0,0.5) calc(100% - 100px), rgba(0,0,0,0.33) calc(100% - 75px), rgba(0,0,0,0.17) calc(100% - 50px), rgba(0,0,0,0.05) calc(100% - 25px), transparent 100%)'
                    }}
                />

                {/* Left Sidebar Character Selector */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2 mt-[10px] z-30 pointer-events-none">
                    {/* The div around CharacterSelector should have pointer-events-none so it doesn't block VN, 
                        because CharacterSelector itself has pointer-events-auto */}
                    <CharacterSelector />
                </div>

                {/* Interact Scene Editor (Floating) */}
                <InteractSceneEditor />

                {/* Pentagram Chat Panel (Floating from bottom) */}
                <PentagramChatPanel
                    onSaveGame={handleSaveGame}
                    onLoadGame={handleLoadGame}
                />
            </div>

            {/* Dev Tools Panel (Floating Overlay) */}
            <div className={cn(
                "absolute right-0 top-0 bottom-0 z-50 flex h-full transition-transform duration-300 ease-in-out",
                devToolsOpen ? "translate-x-0" : "translate-x-full"
            )}>
                
                {/* Toggle Button */}
                <button
                    onClick={() => setDevToolsOpen(!devToolsOpen)}
                    className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-12 bg-neutral-900 border border-white/10 border-r-0 rounded-l-md flex items-center justify-center hover:bg-neutral-800 focus:outline-none z-50 text-neutral-400 hover:text-white"
                >
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${devToolsOpen ? 'rotate-0' : 'rotate-180'}`} />
                </button>

                <div className="w-80 shrink-0 h-full">
                    <DevToolsPanel />
                </div>
            </div>
        </div>
    );
}

