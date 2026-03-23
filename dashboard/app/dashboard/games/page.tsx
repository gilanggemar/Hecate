"use client";

import { motion } from "framer-motion";
import { Gamepad2, Trophy, Swords, BrainCircuit, Play, Lock } from "lucide-react";

export default function GamesPage() {
    return (
        <div className="flex flex-col h-full bg-transparent text-white p-4 md:p-6 lg:p-8 w-full">
            {/* Bento Box Layout Grid - Full Screen */}
            <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-[1.2fr_1fr] gap-4 md:gap-6 flex-1 min-h-0">
                
                {/* 1. Large Hero / Explanation Card */}
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
                        <div className="mt-auto pt-6 flex items-center justify-between">
                            <span className="font-mono text-sm text-[#555] uppercase tracking-widest bg-black/50 px-3 py-1 border border-[#222]">Awaiting deployment command...</span>
                            <Gamepad2 className="w-8 h-8 text-[#f97316]/50" />
                        </div>
                    </div>
                </motion.div>

                {/* 2. Top Right Stats/Status Card */}
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
                            <div className="flex items-center justify-between pb-4 border-b border-[#222] group/item cursor-default">
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-2xl font-black text-[#333] group-hover/item:text-[#f97316] transition-colors">01</span>
                                    <span className="font-bold text-white tracking-widest text-lg">ALICE-9</span>
                                </div>
                                <span className="text-[#f97316] font-mono font-bold text-lg">4,200 <span className="text-xs text-[#555]">XP</span></span>
                            </div>
                            <div className="flex items-center justify-between pb-4 border-b border-[#222] group/item cursor-default">
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-2xl font-black text-[#333] group-hover/item:text-white transition-colors">02</span>
                                    <span className="font-bold text-[#ccc] tracking-widest text-lg">BOB-EX</span>
                                </div>
                                <span className="text-[#ccc] font-mono font-bold text-lg">3,850 <span className="text-xs text-[#555]">XP</span></span>
                            </div>
                            <div className="flex items-center justify-between group/item cursor-default">
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-2xl font-black text-[#333] group-hover/item:text-white transition-colors">03</span>
                                    <span className="font-bold text-[#888] tracking-widest text-lg">CHARLIE Z</span>
                                </div>
                                <span className="text-[#888] font-mono font-bold text-lg">2,100 <span className="text-xs text-[#555]">XP</span></span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* 3. Game 1: Tic-Tac-Toe */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="col-span-1 md:col-span-4 bg-[#f97316] text-black border border-[#f97316] p-6 md:p-8 flex flex-col h-full justify-between group cursor-pointer hover:bg-[#ff8a3d] transition-colors"
                >
                    <div className="flex items-center justify-between mb-4">
                        <Swords className="w-10 h-10" />
                        <span className="font-mono text-xs font-black tracking-widest opacity-80 border-2 border-black/20 px-3 py-1.5 bg-black/5">READY</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-end">
                        <h3 className="text-4xl font-black uppercase tracking-tighter mb-4">Tic-Tac-Toe</h3>
                        <p className="opacity-80 font-bold text-lg leading-snug mb-8">Classic 1v1 grid combat. Outsmart the agent in pure logic.</p>
                        <div className="flex items-center gap-2 font-black uppercase tracking-widest text-sm bg-black text-[#f97316] w-fit px-5 py-4 group-hover:bg-white group-hover:text-black transition-colors shadow-xl">
                            <Play className="w-4 h-4" /> Initialize Match
                        </div>
                    </div>
                </motion.div>

                {/* 4. Game 2: Trivia Battle */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.3 }}
                    className="col-span-1 md:col-span-4 bg-[#111] border border-[#333] p-6 md:p-8 flex flex-col h-full justify-between group hover:border-[#f97316] transition-colors relative overflow-hidden cursor-pointer"
                >
                    <div className="absolute -right-8 -top-8 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BrainCircuit className="w-64 h-64" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <BrainCircuit className="w-10 h-10 text-white" />
                            <span className="font-mono text-xs font-black tracking-widest text-[#555] border-2 border-[#333] bg-black px-3 py-1.5 group-hover:border-[#f97316]/50 group-hover:text-[#f97316] transition-colors">IN DEV</span>
                        </div>
                        <div className="flex-1 flex flex-col justify-end">
                            <h3 className="text-4xl font-black uppercase tracking-tighter text-white mb-4">Trivia Battle</h3>
                            <p className="text-[#888] font-medium text-lg leading-snug group-hover:text-[#aaa] transition-colors">Test your knowledge against the LLM's vast parameter set.</p>
                        </div>
                    </div>
                </motion.div>

                {/* 5. Game 3: Agent Chess */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="col-span-1 md:col-span-4 bg-[#0a0a0a] border border-[#222] p-6 flex flex-col items-center justify-center relative overflow-hidden group h-full cursor-not-allowed"
                >
                    {/* Add subtle noise or scanning effect later. For now, dark solid. */}
                    <div className="text-center flex flex-col items-center z-10 w-full px-4">
                        <div className="w-20 h-20 rounded-none border-2 border-[#333] flex items-center justify-center mb-6 bg-[#111] group-hover:border-[#555] transition-colors">
                            <Lock className="w-8 h-8 text-[#444]" />
                        </div>
                        <h3 className="text-3xl font-black uppercase text-[#444] tracking-tighter mb-4">Agent Chess</h3>
                        <div className="bg-black px-4 py-2 border border-[#333] w-full max-w-[200px]">
                            <p className="text-[#666] font-mono text-xs uppercase font-black tracking-widest text-center">Global Lvl 10 Req</p>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
