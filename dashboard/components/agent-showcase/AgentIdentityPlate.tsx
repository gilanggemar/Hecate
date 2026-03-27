'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import type { AgentProfile } from '@/lib/agentRoster';
import { useAgentZeroStore } from '@/store/useAgentZeroStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { Outfit } from 'next/font/google';

import { AgentIconSelector } from './AgentIconSelector';

const outfit = Outfit({ subsets: ['latin'], weight: '800' });

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

export function AgentIdentityPlate({ agent, level: propLevel, currentXp: propXp, xpToNext: propXpToNext, rank: propRank, currentStreak, avatarUri }: AgentIdentityPlateProps) {
    const isZero = agent.id === 'agent-zero';
    const zeroState = useAgentZeroStore(s => s.status);
    const statusLabel = isZero ? zeroState : 'standby';
    const statusDotColor = statusLabel === 'online' ? '#4ade80' : statusLabel === 'standby' ? '#60a5fa' : '#f59e0b';

    // Read XP directly from the gamification store (single source of truth)
    const agentXP = useGamificationStore(s => s.agentXP);
    const storeXp = agentXP[agent.id] || agentXP[(agent as any).accountId] || agentXP[agent.name?.toLowerCase()] || null;
    
    // Use store data if available, otherwise fall back to props
    const level = storeXp?.level ?? propLevel;
    const currentXp = storeXp?.totalXp ?? propXp;
    const xpToNext = storeXp?.xpToNextLevel ?? propXpToNext;
    
    const xpPercent = xpToNext > 0 ? Math.min(100, (currentXp / xpToNext) * 100) : 0;

    const [isHovered, setIsHovered] = useState(false);

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
                    className={`${outfit.className} text-[90px] uppercase leading-none mt-1 mb-6 tracking-tight cursor-default select-none`}
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
                        {currentXp} / {xpToNext} XP
                    </span>
                </div>
            </div>
        </div>
    );
}
