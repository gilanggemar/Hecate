'use client';

import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { HeroGalleryModal } from './HeroGalleryModal';
import { VignetteTuningModal } from './VignetteTuningModal';

interface HeroImage {
    id: number;
    imageData: string;
    sortOrder: number;
    positionX: number;
    positionY: number;
}

interface HeroImageUploadProps {
    agentId: string;
    agentName: string;
    agentColor: string;
    images: HeroImage[];
    activeIndex: number;
    onSelectImage: (index: number) => void;
    onGalleryChanged: () => void;
    onBackgroundChanged?: () => void;
    className?: string;
}

export function HeroImageUpload({
    agentId, agentName, agentColor,
    images, activeIndex,
    onSelectImage, onGalleryChanged,
    onBackgroundChanged,
    className = '',
}: HeroImageUploadProps) {
    const [showGallery, setShowGallery] = useState(false);
    const [showTuner, setShowTuner] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowGallery(true)}
                className={`flex items-center justify-center w-10 h-10 rounded-full
                    bg-black/60 backdrop-blur-md border border-white/15 text-white/80
                    hover:bg-black/80 hover:border-white/30 hover:text-white
                    transition-all duration-200 cursor-pointer shadow-lg hover:scale-105 active:scale-95 ${className}`}
                title="Update Portrait"
            >
                <Camera size={18} />
            </button>

            {/* Gallery Modal */}
            {showGallery && (
                <HeroGalleryModal
                    agentId={agentId}
                    agentName={agentName}
                    agentColor={agentColor}
                    images={images}
                    activeIndex={activeIndex}
                    onSelectImage={onSelectImage}
                    onImageAdded={onGalleryChanged}
                    onImageDeleted={onGalleryChanged}
                    onBackgroundChanged={onBackgroundChanged}
                    onClose={() => setShowGallery(false)}
                    onTuneVignette={() => {
                        setShowGallery(false);
                        setShowTuner(true);
                    }}
                />
            )}

            <VignetteTuningModal 
                isOpen={showTuner}
                onClose={() => setShowTuner(false)}
            />
        </>
    );
}
