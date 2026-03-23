'use client';

import { useMemo } from 'react';

/**
 * Color Theory-Based Dynamic UI Palette
 * 
 * Uses the agent's accent color (which matches the background theme) to compute
 * a harmonious palette for UI containers using established color theory:
 * 
 * - COMPLEMENTARY (180°): Maximum contrast. Used for container backgrounds.
 *   Orange agent → deep blue containers. Blue agent → warm amber containers.
 * 
 * - SPLIT-COMPLEMENTARY (±150°): Softer contrast than pure complement.
 *   Used for border accents and subtle highlights.
 * 
 * - ANALOGOUS (±30°): Harmonious neighbors on the color wheel.
 *   Used for text accents and glow effects.
 * 
 * Container lightness is kept low (10-18%) to remain dark/readable,
 * but saturation is kept high enough (35-60%) for clearly visible color tinting.
 */

export interface DynamicColors {
    /** Container background — complementary hue, dark, saturated */
    containerBg: string;
    /** Container hover background */
    containerBgHover: string;
    /** Container border — split-complementary accent */
    containerBorder: string;
    /** Container border hover */
    containerBorderHover: string;
    /** Container shadow with color tint */
    containerShadow: string;
    /** Complementary hue (0-360) */
    compHue: number;
}

function hexToHsl(hex: string): [number, number, number] {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function computePalette(colorHex: string): DynamicColors {
    const [hue, sat] = hexToHsl(colorHex);

    // Complementary: 180° across the color wheel
    const compHue = (hue + 180) % 360;

    // Split-complementary: ±150° for border accents
    const splitCompHue = (hue + 150) % 360;

    // Container saturation, lightness used for border/shadow if needed,
    // but the background itself should be a dark gradient
    const borderSat = Math.max(30, Math.min(50, sat * 0.6));

    return {
        compHue,
        // Very weak, almost transparent black gradient to separate text from background
        containerBg: `linear-gradient(145deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)`,
        containerBgHover: `linear-gradient(145deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%)`,
        containerBorder: `rgba(255, 255, 255, 0.05)`,
        containerBorderHover: `rgba(255, 255, 255, 0.15)`,
        containerShadow: `none`,
    };
}

export function useAgentDynamicColors(colorHex: string | undefined): DynamicColors {
    return useMemo(() => {
        if (!colorHex) {
            // Neutral fallback — not gray, but a deep cool blue
            return computePalette('#4488FF');
        }
        return computePalette(colorHex);
    }, [colorHex]);
}
