"use client";

// ============================================================
// components/games/GameXPAwardModal.tsx
// Modal shown after a game ends. If human won / draw, lets them
// assign XP to any agent. If agent won, shows auto-award info.
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Zap, Check, Skull, Handshake, Star, X } from "lucide-react";
import { useGameXPStore } from "@/stores/useGameXPStore";
import { useAvailableAgents } from "@/hooks/useAvailableAgents";
import { getAgentProfile } from "@/lib/agentRoster";

export function GameXPAwardModal() {
  const { pendingAward, isModalOpen, isAwarding, submitXPAward, dismissModal } = useGameXPStore();
  const availableAgents = useAvailableAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentName, setSelectedAgentName] = useState<string | null>(null);

  if (!isModalOpen || !pendingAward) return null;

  const { amount, reason, game, isHumanWin, isDraw, wasRealAgent, winnerAgentId, winnerAgentName } = pendingAward;

  // Agent won — auto-awarded, just show info
  const isAgentAutoAward = !isHumanWin && !isDraw && !!winnerAgentId;

  const handleSubmit = () => {
    if (isAgentAutoAward) {
      dismissModal();
      return;
    }
    if (!selectedAgentId || !selectedAgentName) return;
    submitXPAward(selectedAgentId, selectedAgentName);
  };

  const gameLabel = game === "tic-tac-toe" ? "Tic-Tac-Toe" : "Neuroverse";
  const modeLabel = wasRealAgent ? "Real Agent" : "Computer";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-md mx-4 bg-[#111] border border-[#333] overflow-hidden"
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {/* Close button */}
          <button
            onClick={dismissModal}
            className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div
            className="p-6 pb-4 border-b border-[#222]"
            style={{
              background: isHumanWin
                ? "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))"
                : isDraw
                ? "linear-gradient(135deg, rgba(100,116,139,0.15), rgba(100,116,139,0.05))"
                : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              {isHumanWin ? (
                <Trophy className="w-8 h-8 text-[#f97316]" />
              ) : isDraw ? (
                <Handshake className="w-8 h-8 text-[#64748b]" />
              ) : (
                <Skull className="w-8 h-8 text-[#ef4444]" />
              )}
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">
                  {isHumanWin ? "Victory" : isDraw ? "Draw" : "Defeat"}
                </h3>
                <p className="text-[10px] text-[#666] font-mono uppercase tracking-widest">
                  {gameLabel} · {modeLabel}
                </p>
              </div>
            </div>

            {/* XP Amount */}
            <div className="flex items-center gap-2 mt-4">
              <Zap className="w-5 h-5 text-[#f97316]" />
              <span className="text-3xl font-black text-[#f97316]">+{amount}</span>
              <span className="text-sm font-bold text-[#666] uppercase tracking-widest">XP</span>
            </div>
            <p className="text-xs text-[#888] mt-1">{reason}</p>
          </div>

          {/* Body */}
          <div className="p-6">
            {isAgentAutoAward ? (
              // Agent won — auto-awarded
              <div className="text-center py-4">
                <p className="text-sm text-[#aaa] mb-2">
                  XP auto-awarded to
                </p>
                <p className="text-lg font-black text-white uppercase tracking-tight">
                  {winnerAgentName || winnerAgentId}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2 text-[#f97316]">
                  <Star className="w-4 h-4" />
                  <span className="text-sm font-bold">+{amount} XP earned</span>
                </div>
              </div>
            ) : (
              // Human won or draw — pick agent to assign XP
              <>
                <p className="text-xs text-[#888] font-bold uppercase tracking-widest mb-3">
                  Assign XP to Agent
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
                  {availableAgents.map((agent: any) => {
                    const agentId = agent.accountId || agent.id;
                    const profile = getAgentProfile(agentId);
                    const isSelected = selectedAgentId === agentId;
                    const color = profile?.colorHex || "#64748b";
                    const fallback = profile?.avatarFallback || (agent.name || agentId).slice(0, 2).toUpperCase();

                    return (
                      <button
                        key={agentId}
                        onClick={() => {
                          setSelectedAgentId(agentId);
                          setSelectedAgentName(agent.name || agentId);
                        }}
                        className={`flex items-center gap-3 p-3 text-left transition-all ${
                          isSelected
                            ? "bg-[#f97316]/10 border border-[#f97316]"
                            : "bg-[#0a0a0a] border border-[#222] hover:border-[#444]"
                        }`}
                      >
                        <div
                          className="w-8 h-8 flex items-center justify-center border-2 text-xs font-black flex-shrink-0"
                          style={{
                            borderColor: isSelected ? "#f97316" : color,
                            color: isSelected ? "#f97316" : color,
                          }}
                        >
                          {isSelected ? <Check className="w-3.5 h-3.5" /> : fallback}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-black text-sm text-white uppercase tracking-tight truncate block">
                            {agent.name || agentId}
                          </span>
                          <span className="text-[10px] text-[#666] font-mono uppercase tracking-widest">
                            {profile?.role || "Agent"}
                          </span>
                        </div>
                        {isSelected && (
                          <Zap className="w-4 h-4 text-[#f97316] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#222] flex justify-end gap-3">
            <button
              onClick={dismissModal}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-transparent border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-all"
            >
              {isAgentAutoAward ? "Close" : "Skip"}
            </button>
            {!isAgentAutoAward && (
              <button
                onClick={handleSubmit}
                disabled={!selectedAgentId || isAwarding}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-black uppercase tracking-widest bg-[#f97316] text-black hover:bg-[#ff8a3d] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5" />
                {isAwarding ? "Awarding..." : "Award XP"}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
