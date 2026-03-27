import { db } from '@/lib/db';
import { awardXP } from './xpEngine';

export const ACHIEVEMENT_DEFINITIONS = [
    {
        id: 'first_flame',
        name: 'First Flame',
        description: 'Achieve a 7-day operations streak',
        icon: 'flame',
        category: 'streak',
        condition: { type: 'streak_days', value: 7 },
        xp_reward: 100,
        rarity: 'COMMON',
    },
    {
        id: 'speed_demon',
        name: 'Speed Demon',
        description: 'Complete 10 tasks in a single day',
        icon: 'zap',
        category: 'tasks',
        condition: { type: 'daily_tasks', value: 10 },
        xp_reward: 150,
        rarity: 'RARE',
    },
    {
        id: 'sharpshooter',
        name: 'Sharpshooter',
        description: 'Maintain 95%+ success rate for 30 days',
        icon: 'target',
        category: 'tasks',
        condition: { type: 'sustained_rate', value: 95, days: 30 },
        xp_reward: 500,
        rarity: 'EPIC',
    },
    {
        id: 'diplomat',
        name: 'Diplomat',
        description: 'Run 5 Summit deliberation sessions',
        icon: 'message-square',
        category: 'summit',
        condition: { type: 'summit_count', value: 5 },
        xp_reward: 200,
        rarity: 'RARE',
    },
    {
        id: 'full_fleet',
        name: 'Full Fleet',
        description: 'Have all agents online simultaneously',
        icon: 'users',
        category: 'fleet',
        condition: { type: 'all_agents_online', value: true },
        xp_reward: 75,
        rarity: 'COMMON',
    },
    {
        id: 'commander_rank',
        name: 'Commander',
        description: 'Reach Commander rank with any agent',
        icon: 'crown',
        category: 'mastery',
        condition: { type: 'agent_rank', value: 'COMMANDER' },
        xp_reward: 300,
        rarity: 'EPIC',
    },
    {
        id: 'automator',
        name: 'Automator',
        description: 'Create and run 3 workflows',
        icon: 'git-branch',
        category: 'workflow',
        condition: { type: 'workflow_runs', value: 3 },
        xp_reward: 200,
        rarity: 'RARE',
    },
    {
        id: 'diamond_ops',
        name: 'Diamond Ops',
        description: 'Reach a 100-day operations streak',
        icon: 'gem',
        category: 'streak',
        condition: { type: 'streak_days', value: 100 },
        xp_reward: 2000,
        rarity: 'LEGENDARY',
    },
    {
        id: 'century',
        name: 'Century',
        description: 'Complete 100 total tasks',
        icon: 'trophy',
        category: 'tasks',
        condition: { type: 'total_tasks', value: 100 },
        xp_reward: 250,
        rarity: 'RARE',
    },
    {
        id: 'apex_predator',
        name: 'Apex Predator',
        description: 'Reach Apex rank with any agent',
        icon: 'shield',
        category: 'mastery',
        condition: { type: 'agent_rank', value: 'APEX' },
        xp_reward: 1000,
        rarity: 'LEGENDARY',
    },
    {
        id: 'knowledge_keeper',
        name: 'Knowledge Keeper',
        description: 'Create 20 knowledge fragments',
        icon: 'brain',
        category: 'mastery',
        condition: { type: 'knowledge_count', value: 20 },
        xp_reward: 200,
        rarity: 'RARE',
    },
    {
        id: 'night_owl',
        name: 'Night Owl',
        description: 'Complete a task between midnight and 5 AM',
        icon: 'moon',
        category: 'tasks',
        condition: { type: 'task_time_range', startHour: 0, endHour: 5 },
        xp_reward: 50,
        rarity: 'COMMON',
    },
    // ── Game Achievements ──
    {
        id: 'first_victory',
        name: 'First Victory',
        description: 'Win your first game in the Arena',
        icon: 'trophy',
        category: 'games',
        condition: { type: 'game_wins', value: 1 },
        xp_reward: 50,
        rarity: 'COMMON',
    },
    {
        id: 'arena_veteran',
        name: 'Arena Veteran',
        description: 'Win 10 games in the Arena',
        icon: 'swords',
        category: 'games',
        condition: { type: 'game_wins', value: 10 },
        xp_reward: 200,
        rarity: 'RARE',
    },
    {
        id: 'agent_slayer',
        name: 'Agent Slayer',
        description: 'Defeat a real AI agent in Tic-Tac-Toe',
        icon: 'skull',
        category: 'games',
        condition: { type: 'ttt_win_real', value: 1 },
        xp_reward: 75,
        rarity: 'RARE',
    },
    {
        id: 'grid_master',
        name: 'Grid Master',
        description: 'Win a Neuroverse game against real agents',
        icon: 'crown',
        category: 'games',
        condition: { type: 'nv_win_real', value: 1 },
        xp_reward: 150,
        rarity: 'EPIC',
    },
    {
        id: 'undefeated',
        name: 'Undefeated',
        description: 'Win 5 games in a row without losing',
        icon: 'shield',
        category: 'games',
        condition: { type: 'game_win_streak', value: 5 },
        xp_reward: 300,
        rarity: 'EPIC',
    },
    {
        id: 'xp_hoarder',
        name: 'XP Hoarder',
        description: 'Earn 1,000 total XP from games',
        icon: 'gem',
        category: 'games',
        condition: { type: 'game_xp_total', value: 1000 },
        xp_reward: 500,
        rarity: 'LEGENDARY',
    },
];

export async function checkAllAchievements(userId: string) {
    // In a real app, this would evaluate conditions against the DB.
    // For now, it's a stub to prevent errors and show structure.
}

export async function getUnlockedAchievements(userId: string) {
    // Fetch unlocked achievements + join to get definition data
    const { data: unlocked } = await db.from('unlocked_achievements').select('*').eq('user_id', userId);
    if (!unlocked || unlocked.length === 0) return [];

    const achievementIds = unlocked.map((u: any) => u.achievement_id);
    const { data: definitions } = await db.from('achievements').select('*').in('id', achievementIds);

    const defMap = new Map((definitions || []).map((d: any) => [d.id, d]));

    return unlocked.map((u: any) => ({
        ...u,
        definition: defMap.get(u.achievement_id) || null,
    }));
}

export async function getLockedAchievements(userId: string) {
    const { data: unlocked } = await db.from('unlocked_achievements').select('achievement_id').eq('user_id', userId);
    const unlockedIds = new Set((unlocked || []).map((u: any) => u.achievement_id));

    const { data: allAchievements } = await db.from('achievements').select('*');
    return (allAchievements || []).filter((a: any) => !unlockedIds.has(a.id));
}
