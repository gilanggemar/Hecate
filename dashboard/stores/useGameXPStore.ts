// ============================================================
// stores/useGameXPStore.ts
// Client-side store for tracking game XP earned per session.
// Shows XP award modal and lets user assign XP to an agent.
// ============================================================

import { create } from "zustand";
import { XP_REWARDS } from "@/lib/gamification/xpRules";
import { useGamificationStore } from "@/store/useGamificationStore";

export interface PendingXPAward {
  amount: number;
  reason: string;
  game: "tic-tac-toe" | "neuroverse";
  isHumanWin: boolean;
  isDraw: boolean;
  wasRealAgent: boolean;
  winnerAgentId?: string; // If agent won, auto-assign to them
  winnerAgentName?: string;
}

interface GameXPStore {
  // Pending XP award (shown in modal)
  pendingAward: PendingXPAward | null;
  isModalOpen: boolean;
  isAwarding: boolean;

  // Session stats
  totalGamesPlayed: number;
  totalXPEarned: number;

  // Actions
  awardGameXP: (award: PendingXPAward) => void;
  submitXPAward: (agentId: string, agentName: string) => Promise<void>;
  dismissModal: () => void;
  autoAwardAgentXP: (agentId: string, amount: number, reason: string) => Promise<void>;
}

export const useGameXPStore = create<GameXPStore>((set, get) => ({
  pendingAward: null,
  isModalOpen: false,
  isAwarding: false,
  totalGamesPlayed: 0,
  totalXPEarned: 0,

  awardGameXP: (award) => {
    set({
      pendingAward: award,
      isModalOpen: true,
      totalGamesPlayed: get().totalGamesPlayed + 1,
    });
  },

  submitXPAward: async (agentId, agentName) => {
    const { pendingAward } = get();
    if (!pendingAward) return;

    set({ isAwarding: true });
    try {
      await fetch("/api/gamification/xp/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount: pendingAward.amount,
          reason: `${pendingAward.game} ${pendingAward.reason}`,
          sourceId: `game-${pendingAward.game}-${Date.now()}`,
        }),
      });

      set(s => ({
        totalXPEarned: s.totalXPEarned + pendingAward.amount,
        isModalOpen: false,
        pendingAward: null,
        isAwarding: false,
      }));
      // Refresh gamification store so command center updates immediately
      useGamificationStore.getState().fetchAll();
    } catch (err) {
      console.error("[GameXP] Failed to award XP:", err);
      set({ isAwarding: false });
    }
  },

  dismissModal: () => set({ isModalOpen: false, pendingAward: null }),

  autoAwardAgentXP: async (agentId, amount, reason) => {
    try {
      await fetch("/api/gamification/xp/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount,
          reason,
          sourceId: `game-auto-${Date.now()}`,
        }),
      });
      set(s => ({
        totalGamesPlayed: s.totalGamesPlayed + 1,
        totalXPEarned: s.totalXPEarned + amount,
      }));
      // Refresh gamification store so command center updates immediately
      useGamificationStore.getState().fetchAll();
    } catch (err) {
      console.error("[GameXP] Failed to auto-award XP:", err);
    }
  },
}));

// Helper: Calculate XP for a Tic-Tac-Toe result
export function getTTTXPReward(
  humanWon: boolean,
  isDraw: boolean,
  wasRealAgent: boolean,
): PendingXPAward {
  if (isDraw) {
    return {
      amount: XP_REWARDS.ttt_draw,
      reason: "Draw in Tic-Tac-Toe",
      game: "tic-tac-toe",
      isHumanWin: false,
      isDraw: true,
      wasRealAgent,
    };
  }
  if (humanWon) {
    return {
      amount: wasRealAgent ? XP_REWARDS.ttt_win_vs_real_agent : XP_REWARDS.ttt_win_vs_computer,
      reason: `Victory vs ${wasRealAgent ? "real agent" : "computer"}`,
      game: "tic-tac-toe",
      isHumanWin: true,
      isDraw: false,
      wasRealAgent,
    };
  }
  // Agent won
  return {
    amount: wasRealAgent ? XP_REWARDS.ttt_loss_real_agent : XP_REWARDS.ttt_loss_computer,
    reason: `Agent victory ${wasRealAgent ? "(real)" : "(computer)"}`,
    game: "tic-tac-toe",
    isHumanWin: false,
    isDraw: false,
    wasRealAgent,
  };
}

// Helper: Calculate XP for a Neuroverse result
export function getNVXPReward(
  humanWon: boolean,
  wasRealAgent: boolean,
  winnerAgentId?: string,
  winnerAgentName?: string,
): PendingXPAward {
  if (humanWon) {
    return {
      amount: wasRealAgent ? XP_REWARDS.nv_win_vs_real_agents : XP_REWARDS.nv_win_vs_computer,
      reason: `Neuroverse victory vs ${wasRealAgent ? "real agents" : "computer"}`,
      game: "neuroverse",
      isHumanWin: true,
      isDraw: false,
      wasRealAgent,
    };
  }
  // Agent won
  return {
    amount: wasRealAgent ? XP_REWARDS.nv_agent_win_real : XP_REWARDS.nv_agent_win_computer,
    reason: `Agent Neuroverse victory ${wasRealAgent ? "(real)" : "(computer)"}`,
    game: "neuroverse",
    isHumanWin: false,
    isDraw: false,
    wasRealAgent,
    winnerAgentId,
    winnerAgentName,
  };
}
