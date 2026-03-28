"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Gamepad2, Trophy, Swords, BrainCircuit, Play, Lock, Zap, ArrowLeft, Check, Wifi, WifiOff, Star, TrendingUp } from "lucide-react";
import { useGameStore } from "@/stores/useGameStore";
import { GameArenaPanel } from "@/components/games/GameArenaPanel";
import { AgentSelectScreen } from "@/components/games/AgentSelectScreen";
import { useNeuroverseStore, AgentSlot } from "@/stores/useNeuroverseStore";
import { NeuroverseBoardPanel } from "@/components/games/NeuroverseBoardPanel";
import { PentagramArenaPanel } from "@/components/games/pentagram/PentagramArenaPanel";
import { useAvailableAgents } from "@/hooks/useAvailableAgents";
import { getAgentProfile } from "@/lib/agentRoster";
import { NETRUNNERS as NETRUNNERS_LIST, PINS, PinType } from "@/lib/games/adapters/neuroverse-data";
import { GameXPAwardModal } from "@/components/games/GameXPAwardModal";
import { useGameXPStore } from "@/stores/useGameXPStore";
import { XP_REWARDS } from "@/lib/gamification/xpRules";

const DEFAULT_PINS: PinType[] = ["drone", "skull", "bolt", "shield"];

export default function GamesPage() {
    const { view, setView, selectAgent, createGame, startGame, useRealAgents, setUseRealAgents } = useGameStore();
    const neuroverseStore = useNeuroverseStore();
    const availableAgents = useAvailableAgents();
    const [selectedNvAgents, setSelectedNvAgents] = useState<Set<string>>(new Set());
    const gameXPStore = useGameXPStore();

    // Game config state
    const [nvStartingCred, setNvStartingCred] = useState(500);
    const [nvStartingVoltage, setNvStartingVoltage] = useState(2);
    const [nvMaxRounds, setNvMaxRounds] = useState(12);
    const [nvSalary, setNvSalary] = useState(200);
    const [nvNetrunners, setNvNetrunners] = useState<Record<string, string>>({});
    const [nvPins, setNvPins] = useState<Record<string, PinType>>({ "player-1": "drone", "player-2": "skull", "player-3": "bolt", "player-4": "shield" });

    // Leaderboard data
    const [leaderboard, setLeaderboard] = useState<{ agent_id: string; total_xp: number; level: number; rank: string }[]>([]);
    const [lbLoading, setLbLoading] = useState(true);

    // Fetch leaderboard on mount
    useEffect(() => {
        fetch("/api/gamification/xp")
            .then(r => r.json())
            .then(data => {
                if (data.agents && Array.isArray(data.agents)) {
                    const sorted = [...data.agents].sort((a: any, b: any) => (b.total_xp || 0) - (a.total_xp || 0));
                    setLeaderboard(sorted.slice(0, 3));
                }
            })
            .catch(() => {})
            .finally(() => setLbLoading(false));
    }, [gameXPStore.totalXPEarned]); // Refetch when XP changes

    // Handle Tic-Tac-Toe card click: go to agent select
    const handleTicTacToeClick = () => {
        setView("agent-select");
    };

    // Handle Neuroverse card click: go to multi-agent select
    const handleNeuroverseClick = () => {
        setSelectedNvAgents(new Set());
        neuroverseStore.setView("agent-select");
    };

    // Handle Pentagram Protocol click
    const handlePentagramClick = () => {
        setView("pentagram-playing");
    };

    // Toggle agent selection for Neuroverse
    const toggleNvAgent = (agentId: string) => {
        setSelectedNvAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentId)) next.delete(agentId);
            else if (next.size < 3) next.add(agentId); // Max 3 agents
            return next;
        });
    };

    // Start Neuroverse game with selected agents
    const startNeuroverseGame = () => {
        if (selectedNvAgents.size === 0) return;
        const slots: AgentSlot[] = [];
        let i = 2; // player-1 is human
        selectedNvAgents.forEach(agentId => {
            const liveAgent = availableAgents.find((a: any) => (a.accountId || a.id) === agentId);
            const profile = getAgentProfile(agentId);
            slots.push({
                playerId: `player-${i}`,
                agentId,
                agentName: liveAgent?.name || profile?.name || agentId,
            });
            i++;
        });
        // Build netrunner assignments (filter out empty/random)
        const netrunnerAssignments: Record<string, string> = {};
        for (const [pid, nrId] of Object.entries(nvNetrunners)) {
            if (nrId) netrunnerAssignments[pid] = nrId;
        }

        neuroverseStore.startGame(slots, {
            startingCred: nvStartingCred,
            startingVoltage: nvStartingVoltage,
            maxRounds: nvMaxRounds,
            salary: nvSalary,
            ...(Object.keys(netrunnerAssignments).length > 0 ? { netrunnerAssignments } : {}),
            pinAssignments: nvPins,
        });
    };

    // Handle agent selected: create game and start
    const handleAgentSelected = (agentId: string, agentName: string) => {
        selectAgent(agentId, agentName);
        createGame("tic-tac-toe");
        // Small delay then auto-start
        setTimeout(() => {
            useGameStore.getState().startGame();
        }, 100);
    };

    const handleBackToLobby = () => {
        useGameStore.getState().backToLobby();
    };

    // Render: Agent Select Screen
    if (view === "agent-select") {
        return (
            <div className="flex flex-col h-full bg-transparent text-white p-4 md:p-6 lg:p-8 w-full">
                {/* AI Toggle for TicTacToe */}
                <div className="mb-4 flex items-center justify-end">
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#222]">
                        <div className="flex items-center gap-2">
                            {useRealAgents ? <Wifi className="w-3.5 h-3.5 text-[#f97316]" /> : <WifiOff className="w-3.5 h-3.5 text-[#555]" />}
                            <span className="text-xs font-bold text-[#999] uppercase tracking-widest">
                                {useRealAgents ? "Real Agent" : "Computer"}
                            </span>
                        </div>
                        <button
                            onClick={() => setUseRealAgents(!useRealAgents)}
                            style={{
                                width: 40, height: 22, borderRadius: 11, padding: 2,
                                background: useRealAgents
                                    ? "linear-gradient(135deg, #f97316, #ef4444)"
                                    : "rgba(100,116,139,0.3)",
                                border: "none", cursor: "pointer", transition: "background 0.3s",
                                display: "flex", alignItems: "center",
                            }}
                        >
                            <div style={{
                                width: 18, height: 18, borderRadius: 9,
                                background: "#fff",
                                transform: useRealAgents ? "translateX(18px)" : "translateX(0)",
                                transition: "transform 0.2s ease",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }} />
                        </button>
                    </div>
                </div>
                <AgentSelectScreen
                    onSelect={handleAgentSelected}
                    onBack={handleBackToLobby}
                />
                <GameXPAwardModal />
            </div>
        );
    }

    // Render: Active Game (Tic-Tac-Toe)
    if (view === "playing") {
        return (
            <div className="flex flex-col h-full bg-transparent text-white p-4 md:p-6 lg:p-8 w-full">
                <GameArenaPanel />
                <GameXPAwardModal />
            </div>
        );
    }

    // Render: Pentagram Protocol — TRUE FULLSCREEN
    // Uses fixed positioning to fill the entire viewport.
    // The dashboard shell (top rail, bottom dock, SVG frame) renders ON TOP via their z-indexes.
    if (view === "pentagram-playing") {
        return (
            <div className="fixed inset-0 z-[5] bg-black">
                <PentagramArenaPanel onExit={() => setView("lobby")} />
            </div>
        );
    }

    // Render: Neuroverse Game Configuration
    if (neuroverseStore.view === "agent-select") {
        const P_LABELS = ["You (P1)", "Player 2", "Player 3", "Player 4"];
        const P_COLORS = ["#22c55e", "#06b6d4", "#f59e0b", "#ec4899"];
        const selectedArray = Array.from(selectedNvAgents);

        return (
            <div className="flex flex-col h-full bg-transparent text-white p-4 md:p-6 lg:p-8 w-full overflow-y-auto">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => neuroverseStore.setView("lobby")}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest bg-transparent border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-all"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                        </button>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight">
                                Game <span className="text-cyan-400">Configuration</span>
                            </h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">
                                Select opponents and customize game rules
                            </p>
                        </div>
                    </div>
                    {/* AI Toggle — top right, same as TTT */}
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#111] border border-[#222]">
                        <div className="flex items-center gap-2">
                            {neuroverseStore.useRealAgents ? <Wifi className="w-3.5 h-3.5 text-cyan-400" /> : <WifiOff className="w-3.5 h-3.5 text-[#555]" />}
                            <span className="text-xs font-bold text-[#999] uppercase tracking-widest">
                                {neuroverseStore.useRealAgents ? "Real Agent" : "Computer"}
                            </span>
                        </div>
                        <button
                            onClick={() => neuroverseStore.setUseRealAgents(!neuroverseStore.useRealAgents)}
                            style={{
                                width: 40, height: 22, borderRadius: 11, padding: 2,
                                background: neuroverseStore.useRealAgents
                                    ? "linear-gradient(135deg, #06b6d4, #8b5cf6)"
                                    : "rgba(100,116,139,0.3)",
                                border: "none", cursor: "pointer", transition: "background 0.3s",
                                display: "flex", alignItems: "center",
                            }}
                        >
                            <div style={{
                                width: 18, height: 18, borderRadius: 9,
                                background: "#fff",
                                transform: neuroverseStore.useRealAgents ? "translateX(18px)" : "translateX(0)",
                                transition: "transform 0.2s ease",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            }} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 flex-1 min-h-0">
                    {/* LEFT COLUMN — Opponent Selection */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Swords className="w-3.5 h-3.5" /> Select Opponents (1–3)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {availableAgents.map((agent: any, idx: number) => {
                                const agentId = agent.accountId || agent.id;
                                const profile = getAgentProfile(agentId);
                                const isSelected = selectedNvAgents.has(agentId);
                                const color = profile?.colorHex || "#64748b";
                                const fallback = profile?.avatarFallback || (agent.name || agentId).slice(0, 2).toUpperCase();
                                return (
                                    <motion.button
                                        key={agentId}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25, delay: idx * 0.04 }}
                                        onClick={() => toggleNvAgent(agentId)}
                                        className={`group relative flex items-center gap-3 p-4 bg-[#111] border transition-all text-left ${
                                            isSelected ? "border-cyan-500 bg-cyan-500/5" : "border-[#222] hover:border-cyan-500/50"
                                        }`}
                                    >
                                        <div
                                            className={`w-9 h-9 flex items-center justify-center border-2 text-xs font-black flex-shrink-0 ${
                                                isSelected ? "border-cyan-400 text-cyan-400" : ""
                                            }`}
                                            style={!isSelected ? { borderColor: color, color } : {}}
                                        >
                                            {isSelected ? <Check className="w-4 h-4" /> : fallback}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-sm text-white uppercase tracking-tight truncate">{agent.name || agentId}</h4>
                                            <p className="text-[10px] text-[#666] font-mono uppercase tracking-widest">{profile?.role || "Agent"}</p>
                                        </div>
                                        <div className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
                                            isSelected ? "text-cyan-400" : "text-[#444]"
                                        }`}>
                                            {isSelected ? "✓" : ""}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>

                        {/* Player Roster Preview */}
                        {selectedNvAgents.size > 0 && (
                            <div className="mt-2 p-4 bg-[#0a0a0a] border border-[#222]">
                                <h4 className="text-xs font-bold text-[#555] uppercase tracking-widest mb-3">Player Roster</h4>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333]">
                                        <div className="w-3 h-3 rounded-full" style={{ background: P_COLORS[0] }} />
                                        <span className="text-xs font-bold text-white">You</span>
                                        <span className="text-[10px] text-[#666] font-mono">P1</span>
                                    </div>
                                    {selectedArray.map((agentId, i) => {
                                        const liveAgent = availableAgents.find((a: any) => (a.accountId || a.id) === agentId);
                                        return (
                                            <div key={agentId} className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333]">
                                                <div className="w-3 h-3 rounded-full" style={{ background: P_COLORS[i + 1] }} />
                                                <span className="text-xs font-bold text-white">{liveAgent?.name || agentId}</span>
                                                <span className="text-[10px] text-[#666] font-mono">P{i + 2}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN — Game Settings */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xs font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" /> Game Rules
                        </h3>
                        <div className="bg-[#111] border border-[#222] divide-y divide-[#222]">
                            {/* Starting Credits */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#999] uppercase tracking-widest">Starting Credits</label>
                                    <span className="text-sm font-mono font-black text-cyan-400">¢{nvStartingCred}</span>
                                </div>
                                <input
                                    type="range" min={200} max={1500} step={50}
                                    value={nvStartingCred}
                                    onChange={e => setNvStartingCred(Number(e.target.value))}
                                    className="w-full accent-cyan-500 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[#555] mt-1 font-mono">
                                    <span>¢200</span><span>¢1500</span>
                                </div>
                            </div>

                            {/* Starting Voltage */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#999] uppercase tracking-widest">Starting Voltage</label>
                                    <span className="text-sm font-mono font-black text-violet-400">{nvStartingVoltage}V</span>
                                </div>
                                <input
                                    type="range" min={0} max={6} step={1}
                                    value={nvStartingVoltage}
                                    onChange={e => setNvStartingVoltage(Number(e.target.value))}
                                    className="w-full accent-violet-500 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[#555] mt-1 font-mono">
                                    <span>0V</span><span>6V</span>
                                </div>
                            </div>

                            {/* Max Rounds */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#999] uppercase tracking-widest">Max Rounds</label>
                                    <span className="text-sm font-mono font-black text-amber-400">{nvMaxRounds}</span>
                                </div>
                                <input
                                    type="range" min={6} max={30} step={2}
                                    value={nvMaxRounds}
                                    onChange={e => setNvMaxRounds(Number(e.target.value))}
                                    className="w-full accent-amber-500 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[#555] mt-1 font-mono">
                                    <span>6</span><span>30</span>
                                </div>
                            </div>

                            {/* Salary */}
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[#999] uppercase tracking-widest">Salary (Pass Boot Up)</label>
                                    <span className="text-sm font-mono font-black text-green-400">¢{nvSalary}</span>
                                </div>
                                <input
                                    type="range" min={100} max={500} step={25}
                                    value={nvSalary}
                                    onChange={e => setNvSalary(Number(e.target.value))}
                                    className="w-full accent-green-500 h-1.5 bg-[#222] rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-[#555] mt-1 font-mono">
                                    <span>¢100</span><span>¢500</span>
                                </div>
                            </div>

                        </div>

                        {/* Netrunner Assignment + Pin Selection */}
                        {selectedNvAgents.size > 0 && (
                            <div className="bg-[#111] border border-[#222]">
                                <div className="p-4 border-b border-[#222]">
                                    <h4 className="text-xs font-bold text-[#555] uppercase tracking-widest">Netrunner & Pin</h4>
                                    <p className="text-[10px] text-[#444] mt-0.5">Assign character class and board pin per player</p>
                                </div>
                                <div className="divide-y divide-[#1a1a1a]">
                                    {/* Build player rows: human + selected agents */}
                                    {["player-1", ...selectedArray.map((_, i) => `player-${i + 2}`)].map((pId, pIdx) => {
                                        const isHuman = pIdx === 0;
                                        const agentId = isHuman ? null : selectedArray[pIdx - 1];
                                        const liveAgent = agentId ? availableAgents.find((a: any) => (a.accountId || a.id) === agentId) : null;
                                        const pName = isHuman ? "You" : (liveAgent?.name || agentId || pId);
                                        return (
                                            <div key={pId} className="px-4 py-3 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: P_COLORS[pIdx] }} />
                                                    <span className="text-xs font-bold text-white flex-1">{pName}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {/* Netrunner select */}
                                                    <select
                                                        value={nvNetrunners[pId] || ""}
                                                        onChange={e => setNvNetrunners(prev => ({ ...prev, [pId]: e.target.value }))}
                                                        className="flex-1 bg-[#0a0a0a] border border-[#333] text-xs text-white px-2 py-2 font-mono uppercase tracking-wider cursor-pointer focus:border-cyan-500 focus:outline-none relative z-[100]"
                                                        style={{ WebkitAppearance: "menulist", appearance: "menulist" }}
                                                    >
                                                        <option value="">⟐ Random Class</option>
                                                        {NETRUNNERS_LIST.map(n => (
                                                            <option key={n.id} value={n.id}>◆ {n.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {/* Pin selection */}
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {PINS.map(pin => {
                                                        const isActive = nvPins[pId] === pin.id;
                                                        return (
                                                            <button
                                                                key={pin.id}
                                                                onClick={() => setNvPins(prev => ({ ...prev, [pId]: pin.id }))}
                                                                className="transition-all"
                                                                title={pin.name}
                                                                style={{
                                                                    width: 32, height: 32,
                                                                    display: "flex", alignItems: "center", justifyContent: "center",
                                                                    fontSize: 16,
                                                                    background: isActive ? `${P_COLORS[pIdx]}20` : "rgba(255,255,255,0.03)",
                                                                    border: `1.5px solid ${isActive ? P_COLORS[pIdx] : "#333"}`,
                                                                    borderRadius: 4,
                                                                    color: isActive ? P_COLORS[pIdx] : "#555",
                                                                    cursor: "pointer",
                                                                }}
                                                            >
                                                                {pin.symbol}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Launch Button */}
                {selectedNvAgents.size > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 flex justify-center"
                    >
                        <button
                            onClick={startNeuroverseGame}
                            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-600 to-violet-600 text-white font-black uppercase tracking-widest text-sm hover:from-cyan-500 hover:to-violet-500 transition-all shadow-lg shadow-cyan-500/20"
                        >
                            <Play className="w-5 h-5" />
                            Launch Neuroverse ({selectedNvAgents.size + 1} Players)
                        </button>
                    </motion.div>
                )}
                <GameXPAwardModal />
            </div>
        );
    }

    // Render: Neuroverse Playing
    if (neuroverseStore.view === "playing") {
        return (
            <div className="h-full w-full" style={{ overflow: "hidden" }}>
                <NeuroverseBoardPanel />
                <GameXPAwardModal />
            </div>
        );
    }

    // Helper for leaderboard display
    const getAgentDisplayName = (agentId: string) => {
        const profile = getAgentProfile(agentId);
        const liveAgent = availableAgents.find((a: any) => (a.accountId || a.id) === agentId);
        return liveAgent?.name || profile?.name || agentId;
    };

    // Render: Lobby (original bento layout)
    return (
        <div className="flex flex-col h-full bg-transparent text-white p-4 md:p-6 lg:p-8 w-full">
            {/* Bento Box Layout Grid - Full Screen */}
            <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-[1.2fr_1fr] gap-4 md:gap-6 flex-1 min-h-0">
                
                {/* 1. Large Hero / Games Arena Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="col-span-1 md:col-span-8 bg-[#111] border border-[#f97316] relative overflow-hidden group p-6 md:p-8 lg:p-10 flex flex-col h-full"
                >
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#f97316]/5 rounded-bl-[100px] translate-x-10 -translate-y-10 group-hover:bg-[#f97316]/10 transition-colors" />
                    
                    <div className="relative z-10 flex flex-col h-full justify-between flex-1">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Trophy className="w-10 h-10 text-[#f97316]" />
                                    <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">Games <span className="text-[#f97316]">Arena</span></h1>
                                </div>
                                <span className="font-mono text-sm text-[#777] uppercase tracking-widest hidden sm:inline-block border border-[#333] px-3 py-1 bg-black/50">Protocol v2.0</span>
                            </div>
                            
                            <div className="space-y-4 text-[#aaa] text-lg font-medium leading-relaxed max-w-3xl mt-4">
                                <p className="text-xl sm:text-2xl text-[#ccc] mb-6 font-bold tracking-tight">
                                    Deploy agents in synthetic simulations to earn combat experience.
                                </p>
                                <ul className="space-y-4 mt-6 flex flex-col gap-2">
                                    <li className="flex items-start gap-4">
                                        <div className="mt-2 w-2 h-2 bg-[#f97316] shrink-0" />
                                        <span><strong className="text-white">Agent Victory:</strong> The agent automatically earns XP upon winning a match.</span>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="mt-2 w-2 h-2 bg-text-white shrink-0 bg-white" />
                                        <span><strong className="text-[#f97316]">User Victory:</strong> You gain a massive XP bounty which can be manually assigned to <span className="underline decoration-[#f97316] underline-offset-4">any</span> agent of your choice.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* XP Stats Bar */}
                        <div className="mt-auto pt-6 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Gamepad2 className="w-4 h-4 text-[#555]" />
                                    <span className="font-mono text-sm text-[#888]">
                                        <span className="text-white font-black">{gameXPStore.totalGamesPlayed}</span> games
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-[#f97316]" />
                                    <span className="font-mono text-sm text-[#888]">
                                        <span className="text-[#f97316] font-black">{gameXPStore.totalXPEarned}</span> XP earned
                                    </span>
                                </div>
                            </div>
                            {/* XP Reward Rates */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1 px-2 py-1 bg-black/50 border border-[#222]">
                                    <Swords className="w-3 h-3 text-[#f97316]" />
                                    <span className="text-[10px] font-mono text-[#666]">TTT</span>
                                    <span className="text-[10px] font-mono text-[#f97316]">+{XP_REWARDS.ttt_win_vs_real_agent}</span>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 bg-black/50 border border-[#222]">
                                    <Zap className="w-3 h-3 text-cyan-400" />
                                    <span className="text-[10px] font-mono text-[#666]">NV</span>
                                    <span className="text-[10px] font-mono text-cyan-400">+{XP_REWARDS.nv_win_vs_real_agents}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Global Leaderboard — DYNAMIC */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="col-span-1 md:col-span-4 bg-[#111] border border-[#222] p-6 md:p-8 flex flex-col h-full hover:border-[#444] transition-colors group"
                >
                    <div className="flex-1 flex flex-col">
                        <h3 className="text-sm font-bold text-[#555] group-hover:text-[#aaa] transition-colors uppercase tracking-widest mb-6 md:mb-8 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-[#f97316] shadow-[0_0_10px_#f97316] rounded-full animate-pulse"></span>
                            Global Leaderboard
                        </h3>
                        
                        <div className="space-y-6 flex-1 flex flex-col justify-center pb-4">
                            {lbLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-5 h-5 border-2 border-[#333] border-t-[#f97316] rounded-full animate-spin" />
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <>
                                    <div className="text-center py-6">
                                        <TrendingUp className="w-10 h-10 text-[#333] mx-auto mb-3" />
                                        <p className="text-sm text-[#555] font-bold uppercase tracking-widest">No agents ranked yet</p>
                                        <p className="text-xs text-[#444] mt-1">Play games to earn XP and rank your agents</p>
                                    </div>
                                </>
                            ) : (
                                leaderboard.map((entry, idx) => {
                                    const name = getAgentDisplayName(entry.agent_id);
                                    const colors = ["#f97316", "#ccc", "#888"];
                                    const textColors = ["text-[#f97316]", "text-[#ccc]", "text-[#888]"];
                                    return (
                                        <div key={entry.agent_id} className={`flex items-center justify-between ${idx < 2 ? "pb-4 border-b border-[#222]" : ""} group/item cursor-default`}>
                                            <div className="flex items-center gap-4">
                                                <span className="font-mono text-2xl font-black text-[#333] group-hover/item:text-[#f97316] transition-colors">
                                                    {String(idx + 1).padStart(2, "0")}
                                                </span>
                                                <div>
                                                    <span className={`font-bold tracking-widest text-lg ${textColors[idx] || "text-[#888]"}`}>
                                                        {name.toUpperCase()}
                                                    </span>
                                                    <span className="block text-[10px] font-mono text-[#444] uppercase tracking-widest">
                                                        Lv.{entry.level || 1} · {entry.rank || "INITIATE"}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className={`font-mono font-bold text-lg ${textColors[idx] || "text-[#888]"}`}>
                                                {(entry.total_xp || 0).toLocaleString()} <span className="text-xs text-[#555]">XP</span>
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* 3. Game 1: Tic-Tac-Toe — CLICKABLE */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    onClick={handleTicTacToeClick}
                    className="col-span-1 md:col-span-4 bg-[#f97316] text-black border border-[#f97316] p-6 md:p-8 flex flex-col h-full justify-between group cursor-pointer hover:bg-[#ff8a3d] transition-colors"
                >
                    <div className="flex items-center justify-between mb-4">
                        <Swords className="w-10 h-10" />
                        <span className="font-mono text-xs font-black tracking-widest opacity-80 border-2 border-black/20 px-3 py-1.5 bg-black/5">READY</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                        <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Tic-Tac-Toe</h3>
                        <p className="opacity-80 font-bold text-lg leading-snug mb-4">Classic 1v1 grid combat. Outsmart the agent in pure logic.</p>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-xs font-black bg-black/20 px-2 py-1">Win +{XP_REWARDS.ttt_win_vs_real_agent}xp</span>
                            <span className="text-xs font-bold bg-black/10 px-2 py-1 opacity-70">CPU +{XP_REWARDS.ttt_win_vs_computer}xp</span>
                        </div>
                        <div className="flex items-center gap-2 font-black uppercase tracking-widest text-sm bg-black text-[#f97316] w-fit px-5 py-4 group-hover:bg-white group-hover:text-black transition-colors shadow-xl">
                            <Play className="w-4 h-4" /> Initialize Match
                        </div>
                    </div>
                </motion.div>

                {/* 4. Game 2: Pentagram Protocol */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    onClick={handlePentagramClick}
                    className="col-span-1 md:col-span-4 bg-[#0a0a0a] border border-orange-500/20 p-6 md:p-8 flex flex-col h-full justify-between group hover:border-orange-500/50 transition-colors relative overflow-hidden cursor-pointer"
                >
                    <div className="absolute -right-8 -top-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Lock className="w-64 h-64 text-orange-500" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <Lock className="w-10 h-10 text-orange-500" />
                            <span className="font-mono text-xs font-black tracking-widest text-orange-500 border-2 border-orange-500/30 bg-orange-500/10 px-3 py-1.5">READY</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                            <h3 className="text-4xl font-black uppercase tracking-tighter text-white mb-2">Pentagram Protocol</h3>
                            <p className="text-[#888] font-medium text-lg leading-snug group-hover:text-[#aaa] transition-colors mb-4">An interactive psychological evaluation. Navigate the narrative and extract the hidden variables.</p>
                            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-sm text-black bg-orange-500 w-fit px-5 py-3 group-hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20">
                                <Play className="w-4 h-4" /> Begin Session
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 5. Game 3: Neuroverse — CLICKABLE */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    onClick={handleNeuroverseClick}
                    className="col-span-1 md:col-span-4 bg-gradient-to-br from-[#0a192f] to-[#111] border border-cyan-500/30 p-6 md:p-8 flex flex-col h-full justify-between group cursor-pointer hover:border-cyan-400/60 transition-all relative overflow-hidden"
                >
                    {/* Neon glow effect */}
                    <div className="absolute -right-12 -top-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors" />
                    <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <Zap className="w-10 h-10 text-cyan-400" />
                            <span className="font-mono text-xs font-black tracking-widest text-cyan-400 border-2 border-cyan-500/30 px-3 py-1.5 bg-cyan-500/5">READY</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                            <h3 className="text-4xl font-black uppercase tracking-tighter mb-2">
                                <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">Neuroverse</span>
                            </h3>
                            <p className="text-[#8892a4] font-bold text-base leading-snug mb-4">Cyberpunk Monopoly. Own the grid. Hack the system. Rule the night.</p>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-black bg-cyan-500/20 text-cyan-300 px-2 py-1">Win +{XP_REWARDS.nv_win_vs_real_agents}xp</span>
                                <span className="text-xs font-bold bg-cyan-500/10 text-cyan-400/60 px-2 py-1">CPU +{XP_REWARDS.nv_win_vs_computer}xp</span>
                            </div>
                            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-sm text-black bg-gradient-to-r from-cyan-400 to-violet-500 w-fit px-5 py-4 group-hover:from-cyan-300 group-hover:to-violet-400 transition-colors shadow-xl shadow-cyan-500/20">
                                <Play className="w-4 h-4" /> Deploy Agents
                            </div>
                        </div>
                    </div>
                </motion.div>

            </div>
            <GameXPAwardModal />
        </div>
    );
}
