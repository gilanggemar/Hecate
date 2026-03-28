'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Award, Flame, Zap, Crown, Shield, Target, Gem, Sparkles } from 'lucide-react';
import type { AgentProfile } from '@/lib/agentRoster';
import { useAgentZeroStore } from '@/store/useAgentZeroStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useAgentSettingsStore } from '@/store/useAgentSettingsStore';
import { Outfit } from 'next/font/google';

import { AgentIconSelector } from './AgentIconSelector';

const outfit = Outfit({ subsets: ['latin'], weight: '800' });

const TAG_COLORS = [
    { bg: 'rgba(167,139,250,0.18)', text: '#c4b5fd', border: 'rgba(167,139,250,0.35)' },
    { bg: 'rgba(52,211,153,0.18)', text: '#6ee7b7', border: 'rgba(52,211,153,0.35)' },
    { bg: 'rgba(251,146,60,0.18)', text: '#fdba74', border: 'rgba(251,146,60,0.35)' },
    { bg: 'rgba(56,189,248,0.18)', text: '#7dd3fc', border: 'rgba(56,189,248,0.35)' },
    { bg: 'rgba(251,113,133,0.18)', text: '#fda4af', border: 'rgba(251,113,133,0.35)' },
    { bg: 'rgba(163,230,53,0.18)', text: '#bef264', border: 'rgba(163,230,53,0.35)' },
    { bg: 'rgba(232,121,249,0.18)', text: '#e879f9', border: 'rgba(232,121,249,0.35)' },
    { bg: 'rgba(253,224,71,0.18)', text: '#fde047', border: 'rgba(253,224,71,0.35)' },
];

function getTagColor(tag: string) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ─── XP Calculation (mirrors server-side xpEngine.ts) ───
function calculateLevelFromTotalXp(totalXp: number) {
    let level = 1;
    let cumulativeXp = 0;
    let xpForThisLevel = 100;

    while (totalXp >= cumulativeXp + xpForThisLevel) {
        cumulativeXp += xpForThisLevel;
        level++;
        xpForThisLevel = Math.floor(100 * Math.pow(1.15, level - 1));
    }

    return {
        level,
        currentLevelXp: totalXp - cumulativeXp,  // XP earned within current level
        xpToNextLevel: xpForThisLevel,             // XP needed to complete current level
    };
}

// ─── Achievement Badge System ───
interface BadgeDef {
    id: string;
    label: string;
    icon: typeof Award;
    unlocksAt: number; // level threshold
    gradient: string;
    iconColor: string;
    glowColor: string;
    borderColor: string;
    bgColor: string;
}

const BADGE_DEFINITIONS: BadgeDef[] = [
    {
        id: 'first-steps',
        label: 'First Steps',
        icon: Sparkles,
        unlocksAt: 1,
        gradient: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
        iconColor: '#c7d2fe',
        glowColor: 'rgba(199,210,254,0.4)',
        borderColor: 'rgba(199,210,254,0.5)',
        bgColor: 'rgba(199,210,254,0.12)',
    },
    {
        id: 'rising-spark',
        label: 'Rising Spark',
        icon: Zap,
        unlocksAt: 2,
        gradient: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)',
        iconColor: '#fbbf24',
        glowColor: 'rgba(245,158,11,0.4)',
        borderColor: 'rgba(245,158,11,0.5)',
        bgColor: 'rgba(245,158,11,0.12)',
    },
    {
        id: 'proven-operative',
        label: 'Proven',
        icon: Shield,
        unlocksAt: 3,
        gradient: 'linear-gradient(135deg, #6ee7b7 0%, #10b981 100%)',
        iconColor: '#6ee7b7',
        glowColor: 'rgba(16,185,129,0.4)',
        borderColor: 'rgba(16,185,129,0.5)',
        bgColor: 'rgba(16,185,129,0.12)',
    },
    {
        id: 'sharpshooter',
        label: 'Sharpshooter',
        icon: Target,
        unlocksAt: 5,
        gradient: 'linear-gradient(135deg, #93c5fd 0%, #3b82f6 100%)',
        iconColor: '#93c5fd',
        glowColor: 'rgba(59,130,246,0.4)',
        borderColor: 'rgba(59,130,246,0.5)',
        bgColor: 'rgba(59,130,246,0.12)',
    },
    {
        id: 'specialist',
        label: 'Specialist',
        icon: Gem,
        unlocksAt: 7,
        gradient: 'linear-gradient(135deg, #c4b5fd 0%, #8b5cf6 100%)',
        iconColor: '#c4b5fd',
        glowColor: 'rgba(139,92,246,0.4)',
        borderColor: 'rgba(139,92,246,0.5)',
        bgColor: 'rgba(139,92,246,0.12)',
    },
    {
        id: 'commander',
        label: 'Commander',
        icon: Crown,
        unlocksAt: 10,
        gradient: 'linear-gradient(135deg, #fda4af 0%, #e11d48 100%)',
        iconColor: '#fda4af',
        glowColor: 'rgba(225,29,72,0.4)',
        borderColor: 'rgba(225,29,72,0.5)',
        bgColor: 'rgba(225,29,72,0.12)',
    },
    {
        id: 'inferno',
        label: 'Inferno',
        icon: Flame,
        unlocksAt: 13,
        gradient: 'linear-gradient(135deg, #fdba74 0%, #ea580c 100%)',
        iconColor: '#fdba74',
        glowColor: 'rgba(234,88,12,0.5)',
        borderColor: 'rgba(234,88,12,0.6)',
        bgColor: 'rgba(234,88,12,0.15)',
    },
    {
        id: 'apex',
        label: 'Apex',
        icon: Award,
        unlocksAt: 15,
        gradient: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 50%, #f59e0b 100%)',
        iconColor: '#fef08a',
        glowColor: 'rgba(251,191,36,0.6)',
        borderColor: 'rgba(251,191,36,0.7)',
        bgColor: 'rgba(251,191,36,0.15)',
    },
];

interface AgentIdentityPlateProps {
    agent: AgentProfile;
    level: number;
    currentXp: number;
    xpToNext: number;
    rank: string;
    currentStreak: number;
    avatarUri?: string | null;
}

function RarityStars({ level }: { level: number }) {
    const starCount = Math.min(5, Math.floor(level / 10) + 1);
    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
                >
                    <Star
                        size={16}
                        className={i < starCount ? 'text-amber-400 fill-amber-400' : 'text-white/10 fill-white/5'}
                        style={i === starCount - 1 && starCount === 5 ? {
                            filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))'
                        } : undefined}
                    />
                </motion.div>
            ))}
        </div>
    );
}

function AchievementBadge({ badge, index }: { badge: BadgeDef; index: number }) {
    const Icon = badge.icon;
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.06 + 0.15, type: 'spring', stiffness: 400, damping: 20 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative group cursor-default"
        >
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
                style={{
                    background: badge.bgColor,
                    border: `1px solid ${badge.borderColor}`,
                    boxShadow: hovered ? `0 0 16px ${badge.glowColor}, 0 4px 12px rgba(0,0,0,0.3)` : `0 2px 6px rgba(0,0,0,0.2)`,
                    transform: hovered ? 'translateY(-2px) scale(1.1)' : 'translateY(0) scale(1)',
                }}
            >
                <Icon
                    size={16}
                    color={badge.iconColor}
                    style={{
                        filter: hovered ? `drop-shadow(0 0 6px ${badge.glowColor})` : 'none',
                        transition: 'filter 0.2s ease',
                    }}
                    strokeWidth={2.2}
                />
            </div>
            {/* Tooltip */}
            {hovered && (
                <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-50"
                >
                    <span
                        className="text-[10px] font-semibold px-2 py-1 rounded-md"
                        style={{
                            background: 'rgba(0,0,0,0.85)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(8px)',
                        }}
                    >
                        {badge.label}
                    </span>
                </motion.div>
            )}
        </motion.div>
    );
}

export function AgentIdentityPlate({ agent, level: propLevel, currentXp: propXp, xpToNext: propXpToNext, rank: propRank, currentStreak, avatarUri }: AgentIdentityPlateProps) {
    const isZero = agent.id === 'agent-zero';
    const zeroState = useAgentZeroStore(s => s.status);
    const statusLabel = isZero ? zeroState : 'standby';

    // Read XP directly from the gamification store (single source of truth)
    const agentXP = useGamificationStore(s => s.agentXP);
    const storeXp = agentXP[agent.id] || agentXP[(agent as any).accountId] || agentXP[agent.name?.toLowerCase()] || null;
    
    // Use store data if available, otherwise fall back to props
    const rawTotalXp = storeXp?.totalXp ?? propXp;
    
    // Recalculate level progression from totalXp to get correct current-level XP
    const levelCalc = useMemo(() => calculateLevelFromTotalXp(rawTotalXp), [rawTotalXp]);
    const level = levelCalc.level;
    const currentLevelXp = levelCalc.currentLevelXp;
    const xpToNext = levelCalc.xpToNextLevel;
    
    const xpPercent = xpToNext > 0 ? Math.min(100, (currentLevelXp / xpToNext) * 100) : 0;

    const [isHovered, setIsHovered] = useState(false);

    // Agent tags from settings store
    const agentTags = useAgentSettingsStore(s => s.agentTags);
    const tags = agentTags[agent.id] || agentTags[(agent as any).accountId] || [];

    // Compute unlocked badges
    const unlockedBadges = useMemo(() => {
        return BADGE_DEFINITIONS.filter(b => level >= b.unlocksAt);
    }, [level]);

    // Dynamic color based on agent
    const accentColor = agent.colorHex || '#FF6D29';

    const gradientValue = isHovered
        ? `linear-gradient(135deg, #ffffff 0%, ${accentColor} 50%, #ffffff 100%)`
        : `linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.65) 100%)`;

    return (
        <div className="flex items-start gap-5">
            {/* Identity Details */}
            <div className="flex flex-col flex-1 pt-1.5 overflow-visible">
                <RarityStars level={level} />
                
                <motion.h2
                    className={`${outfit.className} text-[90px] uppercase leading-none mt-1 mb-3 tracking-tight cursor-default select-none`}
                    title={agent.name}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    animate={{
                        letterSpacing: isHovered ? '0.06em' : '-0.02em',
                    }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        backgroundImage: gradientValue,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: isHovered
                            ? `drop-shadow(0 0 30px ${accentColor}90) drop-shadow(0 4px 12px rgba(0,0,0,0.6))`
                            : 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                        transition: 'filter 0.4s ease, background-image 0.4s ease',
                        paddingBottom: '0.08em',
                    }}
                >
                    {agent.name}
                </motion.h2>

                {/* Agent Tags — displayed under the name */}
                {tags.length > 0 && (
                    <motion.div
                        className="flex items-center gap-2 flex-wrap mb-4"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        {tags.map((tag) => {
                            const c = getTagColor(tag);
                            return (
                                <span
                                    key={tag}
                                    className="text-[11px] font-semibold px-3 py-1 rounded-lg backdrop-blur-sm"
                                    style={{
                                        background: c.bg,
                                        color: c.text,
                                        border: `1px solid ${c.border}`,
                                        boxShadow: `0 2px 8px ${c.bg}`,
                                    }}
                                >
                                    {tag}
                                </span>
                            );
                        })}
                    </motion.div>
                )}
                
                {/* Meta Row: Role, Level, XP */}
                <div className="flex flex-col gap-3 mt-1">
                    <div className="flex items-center gap-3">
                        {agent.role && (
                            <span 
                                className="text-[10px] uppercase font-bold tracking-[0.2em] px-2.5 py-1 rounded-sm text-black"
                                style={{ backgroundColor: agent.colorHex }}
                            >
                                {agent.role}
                            </span>
                        )}
                        <span className="text-[12px] font-mono font-bold tracking-widest text-white/50">
                            LVL.{level}
                        </span>
                    </div>
                    
                    {/* XP Progress Line */}
                    <div className="w-full max-w-[200px] h-[5px] rounded-full bg-white/10 overflow-hidden relative border border-white/5 shadow-inner">
                        <motion.div 
                            className="h-full rounded-full" 
                            style={{ 
                                background: `linear-gradient(90deg, #FF6D29, #FF8C42)`,
                                boxShadow: `0 0 10px rgba(255,109,41,0.6)`
                            }} 
                            initial={{ width: 0 }}
                            animate={{ width: `${xpPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                        />
                    </div>
                    {/* XP Text */}
                    <span className="text-[10px] font-mono text-white/40 tracking-wider -mt-1">
                        {currentLevelXp} / {xpToNext} XP
                    </span>
                </div>

                {/* ─── Achievement Badges ─── */}
                {unlockedBadges.length > 0 && (
                    <motion.div
                        className="flex items-center gap-2 mt-2.5 flex-wrap"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        {unlockedBadges.map((badge, i) => (
                            <AchievementBadge key={badge.id} badge={badge} index={i} />
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
