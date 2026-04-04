"use client";

import React, { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import { Star, X, Zap, Bot, MessageSquare, Wrench, GitBranch, Code, Flag, Timer, Users, Clock, Globe, Radio, Box } from "lucide-react";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { NODE_CATEGORIES, type NodePaletteItem } from "./nodes/nodeStyles";

const ICON_MAP: Record<string, React.ReactNode> = {
    Zap: <Zap size={16} />, Bot: <Bot size={16} />, MessageSquare: <MessageSquare size={16} />,
    Wrench: <Wrench size={16} />, GitBranch: <GitBranch size={16} />, Code: <Code size={16} />,
    Flag: <Flag size={16} />, Timer: <Timer size={16} />, Users: <Users size={16} />,
    Clock: <Clock size={16} />, Globe: <Globe size={16} />, Radio: <Radio size={16} />,
    Box: <Box size={16} />,
};

export default function FavoritesModal() {
    const open = useWorkflowBuilderStore((s) => s.favoritesModalOpen);
    const setOpen = useWorkflowBuilderStore((s) => s.setFavoritesModalOpen);
    const favoriteNodes = useWorkflowBuilderStore((s) => s.favoriteNodes);
    const addNode = useWorkflowBuilderStore((s) => s.addNode);
    const setSelectedNode = useWorkflowBuilderStore((s) => s.setSelectedNode);

    let rf: ReturnType<typeof useReactFlow> | null = null;
    try { rf = useReactFlow(); } catch { }

    // Collect all favorited items
    const favorites = useMemo(() => {
        const items: (NodePaletteItem & { accent: string })[] = [];
        for (const cat of NODE_CATEGORIES) {
            for (const item of cat.items) {
                const key = `${item.type}:${item.label}`;
                if (favoriteNodes.has(key)) {
                    items.push({ ...item, accent: cat.accent });
                }
            }
        }
        return items;
    }, [favoriteNodes]);

    const handleAdd = useCallback((item: NodePaletteItem) => {
        let pos = { x: 250, y: 250 };
        if (rf) {
            const b = document.querySelector('.react-flow')?.getBoundingClientRect();
            if (b) pos = rf.screenToFlowPosition({ x: b.width / 2, y: b.height / 2 });
        }
        const nodeId = `${item.type}-${Date.now()}`;
        addNode({
            id: nodeId, type: item.type, position: pos,
            data: { label: item.label, ...(item.defaultData || {}) },
        });
        setSelectedNode(nodeId);
        setOpen(false);
    }, [addNode, setSelectedNode, setOpen, rf]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setOpen(false)}
                        style={{
                            position: "absolute", inset: 0, zIndex: 40,
                            background: "oklch(0 0 0 / 0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                    />
                    {/* Modal — centered via inset + margin auto */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 50,
                            margin: "auto",
                            width: 280,
                            height: "fit-content",
                            maxHeight: 360,
                            background: "oklch(0.11 0.005 0 / 0.9)",
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                            border: "1px solid oklch(1 0 0 / 0.10)",
                            borderRadius: 6,
                            boxShadow: "0 16px 64px oklch(0 0 0 / 0.5)",
                            display: "flex", flexDirection: "column", overflow: "hidden",
                        }}
                    >
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px 8px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Star size={12} style={{ color: "var(--accent-base)" }} />
                                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>
                                    Favorites
                                </span>
                            </div>
                            <button onClick={() => setOpen(false)}
                                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                                <X size={12} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
                            {favorites.length === 0 && (
                                <div style={{ textAlign: "center", padding: "32px 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
                                    No favorites yet.<br />
                                    <span style={{ fontSize: 9 }}>Star nodes in the inventory to quick-add them here.</span>
                                </div>
                            )}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {favorites.map((item, i) => (
                                    <motion.button
                                        key={`${item.type}-${i}`}
                                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                        onClick={() => handleAdd(item)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 8,
                                            padding: "8px 10px", borderRadius: 6,
                                            background: "oklch(0.15 0.005 0 / 0.5)",
                                            border: "1px solid oklch(1 0 0 / 0.04)",
                                            cursor: "pointer", color: item.accent,
                                            transition: "border-color 150ms",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = item.accent; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.04)"; }}
                                    >
                                        {ICON_MAP[item.icon] || <Zap size={16} />}
                                        <div style={{ flex: 1, textAlign: "left" }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{item.label}</div>
                                            {item.description && <div style={{ fontSize: 8, color: "var(--text-muted)" }}>{item.description}</div>}
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
