'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type TabValue = 'per-agent' | 'global' | 'core-files';

interface TabSwitcherProps {
    activeTab: TabValue;
    onTabChange: (tab: TabValue) => void;
}

const TABS: { value: TabValue; label: string }[] = [
    { value: 'per-agent', label: 'Per Agent' },
    { value: 'global', label: 'Global' },
    { value: 'core-files', label: 'Core Files' },
];

export function TabSwitcher({ activeTab, onTabChange }: TabSwitcherProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-md bg-white/5 border border-white/10 p-1">
            {TABS.map((tab) => (
                <button
                    key={tab.value}
                    onClick={() => onTabChange(tab.value)}
                    className={cn(
                        'relative px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors',
                        activeTab === tab.value
                            ? 'text-white'
                            : 'text-white/40 hover:text-white/60'
                    )}
                >
                    {activeTab === tab.value && (
                        <motion.div
                            layoutId="capabilities-tab"
                            className="absolute inset-0 rounded-lg bg-white/10 border border-white/10"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                        />
                    )}
                    <span className="relative z-10">
                        {tab.label}
                    </span>
                </button>
            ))}
        </div>
    );
}
