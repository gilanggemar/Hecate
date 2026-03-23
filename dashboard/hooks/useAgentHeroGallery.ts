'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface HeroImage {
    id: number;
    imageData: string;
    sortOrder: number;
    positionX: number;
    positionY: number;
}

interface HeroGalleryState {
    images: HeroImage[];
    activeIndex: number;
}

const galleryCache: Record<string, HeroGalleryState> = {};

export function useAgentHeroGallery(agentId: string) {
    const [state, setState] = useState<HeroGalleryState>(
        galleryCache[agentId] || { images: [], activeIndex: 0 }
    );
    const [isLoading, setIsLoading] = useState(false);

    const fetchImages = useCallback(async () => {
        if (!agentId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/agents/hero?agentId=${agentId}`);
            const data = await res.json();
            if (data.images) {
                const newState = { images: data.images, activeIndex: data.activeIndex || 0 };
                galleryCache[agentId] = newState;
                setState(newState);
            }
        } catch (err) {
            console.error('Failed to load hero gallery:', err);
        } finally {
            setIsLoading(false);
        }
    }, [agentId]);

    useEffect(() => {
        if (galleryCache[agentId]) {
            setState(galleryCache[agentId]);
        }
        fetchImages();
    }, [agentId, fetchImages]);

    const activeImageObj = state.images.length > 0
        ? state.images[Math.min(state.activeIndex, state.images.length - 1)]
        : null;
    const activeImage = activeImageObj?.imageData || null;

    const posX = activeImageObj?.positionX ?? 50;
    const posY = activeImageObj?.positionY ?? 100;
    const activePosition = useMemo(() => ({ x: posX, y: posY }), [posX, posY]);

    const setActiveIndex = useCallback(async (index: number) => {
        const clamped = Math.max(0, Math.min(index, state.images.length - 1));
        const newState = { ...state, activeIndex: clamped };
        galleryCache[agentId] = newState;
        setState(newState);

        // Persist to server
        await fetch('/api/agents/hero', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, activeIndex: clamped }),
        });
    }, [agentId, state]);

    const next = useCallback(() => {
        if (state.images.length <= 1) return;
        const nextIdx = (state.activeIndex + 1) % state.images.length;
        setActiveIndex(nextIdx);
    }, [state, setActiveIndex]);

    const prev = useCallback(() => {
        if (state.images.length <= 1) return;
        const prevIdx = (state.activeIndex - 1 + state.images.length) % state.images.length;
        setActiveIndex(prevIdx);
    }, [state, setActiveIndex]);

    const invalidate = useCallback(() => {
        delete galleryCache[agentId];
        fetchImages();
    }, [agentId, fetchImages]);

    return {
        images: state.images,
        activeIndex: state.activeIndex,
        activeImage,
        activePosition,
        imageCount: state.images.length,
        isLoading,
        next,
        prev,
        setActiveIndex,
        invalidate,
    };
}
