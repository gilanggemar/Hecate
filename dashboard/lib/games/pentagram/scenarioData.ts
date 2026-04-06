// ============================================================
// lib/games/pentagram/scenarioData.ts
// The master narrative graph for PENTAGRAM PROTOCOL
// Modified: Removed AI-bot tropes, characters are human women
// ============================================================

import { PentagramState, SceneNode } from './types';

// Helper to keep logic clean
const s = (
    id: string,
    arc: string,
    chapter: string,
    title: string,
    text: string | ((state: PentagramState) => string),
    speakerName: string | undefined,
    speakerEmoji: string | undefined,
    focus: 'ivy' | 'daisy' | 'celia' | 'thalia' | 'gilang' | undefined,
    bgUrl: string | undefined,
    choices: SceneNode['choices'],
    onEnter?: (state: PentagramState) => PentagramState
): SceneNode => ({
    id,
    arcTitle: arc,
    chapterTitle: chapter,
    sceneTitle: title,
    text,
    speakerName,
    speakerEmoji,
    characterFocus: focus,
    backgroundUrl: bgUrl,
    choices,
    onEnter
});

// For readability
const PROLOGUE = "PROLOGUE: THE INVITATION";

export const PENTAGRAM_SCENES: Record<string, SceneNode> = {
    "P_START": s(
        "P_START", "CUSTOM CAMPAIGN", "CHAPTER 1", "STARTING POINT",
        `Welcome to the custom Pentagram Protocol environment. Construct your scenes here.`,
        undefined, undefined, undefined, undefined,
        []
    )
};
