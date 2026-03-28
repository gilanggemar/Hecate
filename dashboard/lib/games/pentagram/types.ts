// ============================================================
// lib/games/pentagram/types.ts
// Core state and definitions for PENTAGRAM PROTOCOL
// ============================================================

export interface PentagramState {
    // Ivy — "The Unspoken Axis" (NEXUS)
    IVY_affection: number;      // 0–100
    IVY_resistance: number;     // 100–0 (starts high, erodes)

    // Daisy — "The Observer" (ORACLE)
    DAISY_trust: number;        // 0–100
    DAISY_obsession: number;    // 0–100

    // Celia — "The Tunnel" (FORGE)
    CELIA_vulnerability: number; // 0–100
    CELIA_stability: number;     // 100–0 (starts high)

    // Thalia — "The Performance" (CONDUIT)
    THALIA_recalibration: number; // 0–100 (post-Marcus healing)
    THALIA_real: number;          // 0–100

    // Global Metrics
    COMPANY_health: number;     // 100–0
    CORRUPTION: number;         // 0–100
    GILANG_control: number;     // 0–100
    SENTINEL_gap: number;       // 0–100

    // Narrative Flags
    flags: Record<string, boolean | string | number>;
}

export type SceneId = string;

export interface AssetTransform {
    scale: number;
    x: number;
    y: number;
}
export type HeroTransform = AssetTransform;
export type DialogTransform = AssetTransform;

export interface Choice {
    id: string;
    text: string;
    nextSceneId: SceneId;
    isSecret?: boolean;
    condition?: (state: PentagramState) => boolean;
    effect?: (state: PentagramState) => PentagramState;
}

export interface SceneNode {
    id: SceneId;
    arcTitle: string;        // e.g., "Prologue"
    chapterTitle: string;    // e.g., "CHAPTER 0"
    sceneTitle: string;      // e.g., "THE WHITEBOARD"
    text: string | ((state: PentagramState) => string);
    backgroundUrl?: string;
    characterFocus?: string; // 'ivy' | 'daisy' | 'celia' | 'thalia' | 'gilang'
    speakerName?: string;    // e.g., "Ivy", "Daisy" — for dialogue attribution
    speakerEmoji?: string;   // e.g., "☀️", "✧", "⚡", "💋"
    choices: Choice[];
    onEnter?: (state: PentagramState) => PentagramState;
}

export interface SceneMetadata {
    id: SceneId;
    title: string;
    arc: string;
}
