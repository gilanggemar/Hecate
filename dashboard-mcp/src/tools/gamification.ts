// ─── Gamification Domain ─────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "gamification";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "get_overview",
        description:
            "Get a full gamification overview: all agents' XP/levels, daily missions, achievements, and streak data.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();

            const [xpRes, missionsRes, unlockedRes, lockedRes, streakRes] = await Promise.all([
                supabase.from("agent_xp").select("*").eq("user_id", userId),
                supabase.from("daily_missions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
                supabase.from("unlocked_achievements").select("*, achievements(*)").eq("user_id", userId),
                supabase.from("achievements").select("*").eq("user_id", userId),
                supabase.from("operations_streak").select("*").eq("user_id", userId).limit(1).single(),
            ]);

            // Calculate fleet power score
            const agents = xpRes.data || [];
            const fleetPower = agents.reduce((s, a) => s + (a.total_xp || 0), 0);

            return ok({
                agents: agents.map((a) => ({
                    agentId: a.agent_id,
                    totalXp: a.total_xp,
                    level: a.level,
                    xpToNextLevel: a.xp_to_next_level,
                    rank: a.rank,
                })),
                fleetPowerScore: fleetPower,
                dailyMissions: missionsRes.data ?? [],
                unlockedAchievements: unlockedRes.data ?? [],
                lockedAchievements: lockedRes.data ?? [],
                streak: streakRes.data || { current_streak: 0, longest_streak: 0 },
            });
        },
    },
    {
        domain: DOMAIN,
        action: "award_xp",
        description: "Award XP to an agent. Automatically levels up if threshold is reached.",
        inputSchema: {
            agent_id: z.string().describe("Agent ID to award XP to"),
            amount: z.number().describe("XP amount to award"),
            reason: z.string().describe("Reason for the award (e.g. 'task_completed', 'summit_participated')"),
            source_id: z.string().optional().describe("ID of the source entity (task ID, summit ID, etc.)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();

            // Log XP event
            await supabase.from("xp_events").insert({
                agent_id: params.agent_id,
                amount: params.amount,
                reason: params.reason,
                source_id: params.source_id || null,
                user_id: userId,
            });

            // Get current XP
            const { data: current } = await supabase
                .from("agent_xp")
                .select("*")
                .eq("agent_id", params.agent_id as string)
                .eq("user_id", userId)
                .single();

            let totalXp = (current?.total_xp || 0) + (params.amount as number);
            let level = current?.level || 1;
            let xpToNext = current?.xp_to_next_level || 100;
            let rank = current?.rank || "INITIATE";

            // Level up logic
            while (totalXp >= xpToNext) {
                totalXp -= xpToNext;
                level++;
                xpToNext = Math.floor(xpToNext * 1.5); // Progressive scaling
            }

            // Rank progression
            const ranks = ["INITIATE", "OPERATIVE", "SPECIALIST", "COMMANDER", "DIRECTOR", "SOVEREIGN"];
            const rankIdx = Math.min(Math.floor(level / 5), ranks.length - 1);
            rank = ranks[rankIdx];

            // Upsert XP record
            const { data, error } = await supabase
                .from("agent_xp")
                .upsert({
                    agent_id: params.agent_id as string,
                    total_xp: totalXp,
                    level,
                    xp_to_next_level: xpToNext,
                    rank,
                    user_id: userId,
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "get_missions",
        description: "Get today's daily missions and their progress.",
        inputSchema: {
            date: z.string().optional().describe("Date to query (YYYY-MM-DD, defaults to today)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const date = (params.date as string) || new Date().toISOString().split("T")[0];

            const { data, error } = await supabase
                .from("daily_missions")
                .select("*")
                .eq("user_id", userId)
                .eq("date", date);
            if (error) return err(error.message);

            const allCompleted = (data || []).every((m) => m.is_completed);
            return ok({ missions: data ?? [], date, allCompleted });
        },
    },
    {
        domain: DOMAIN,
        action: "update_mission_progress",
        description: "Increment progress on a mission type for today.",
        inputSchema: {
            type: z.string().describe("Mission type to increment (e.g. 'task_count', 'chat_count')"),
            increment: z.number().optional().default(1).describe("Amount to increment (default 1)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const today = new Date().toISOString().split("T")[0];

            // Find matching mission
            const { data: missions } = await supabase
                .from("daily_missions")
                .select("*")
                .eq("user_id", userId)
                .eq("date", today)
                .eq("type", params.type as string);

            if (!missions || missions.length === 0) {
                return ok({ message: "No matching mission found for today", type: params.type });
            }

            const mission = missions[0];
            const newCurrent = Math.min((mission.current || 0) + ((params.increment as number) || 1), mission.target);
            const isCompleted = newCurrent >= mission.target;

            const { data, error } = await supabase
                .from("daily_missions")
                .update({ current: newCurrent, is_completed: isCompleted })
                .eq("id", mission.id)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "get_streak",
        description: "Get the current operations streak and history.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("operations_streak")
                .select("*")
                .eq("user_id", userId)
                .limit(1)
                .single();
            if (error) return err(error.message);
            return ok({
                currentStreak: data?.current_streak || 0,
                longestStreak: data?.longest_streak || 0,
                lastActiveDate: data?.last_active_date || null,
                streakHistory: data?.streak_history || [],
            });
        },
    },
];

registerTools(tools);
