'use client';

import { useRef, useState, useCallback } from 'react';
import { Camera, ZoomIn, ZoomOut, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper, { type Area } from 'react-easy-crop';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AvatarUploadProps {
    currentAvatar: string | null;
    agentName: string;
    onAvatarChange: (dataUri: string) => void;
    size?: number;
    width?: number;
    height?: number;
}

// ─── Utility: crop image from canvas ────────────────────────────────────────

async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area,
    outputWidth = 192,
    outputHeight = 256,
): Promise<string> {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputWidth,
        outputHeight,
    );

    return canvas.toDataURL('image/webp', 0.85);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AvatarUpload({ currentAvatar, agentName, onAvatarChange, size = 80, width, height }: AvatarUploadProps) {
    const w = width || size;
    const h = height || size;
    const aspectRatio = w / h; // 3:4 = 0.75

    const inputRef = useRef<HTMLInputElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Cropper state
    const [cropperOpen, setCropperOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    const initials = agentName.slice(0, 2).toUpperCase();

    const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    // When file is selected, open the cropper instead of auto-applying
    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setImageSrc(ev.target?.result as string);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCropperOpen(true);
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    // Apply the crop
    const handleApplyCrop = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        // Output resolution: 192×256 for 3:4, or proportional
        const outW = 192;
        const outH = Math.round(outW / aspectRatio);
        const dataUri = await getCroppedImg(imageSrc, croppedAreaPixels, outW, outH);
        onAvatarChange(dataUri);
        setCropperOpen(false);
        setImageSrc(null);
    };

    const handleCancelCrop = () => {
        setCropperOpen(false);
        setImageSrc(null);
    };

    return (
        <>
            {/* Avatar display + click-to-upload trigger */}
            <div
                className="relative rounded-md overflow-hidden border border-border bg-accent/30 flex items-center justify-center cursor-pointer group shrink-0"
                style={{ width: w, height: h }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => inputRef.current?.click()}
            >
                {currentAvatar ? (
                    <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                    <span className="text-muted-foreground font-semibold" style={{ fontSize: Math.min(w, h) * 0.4 }}>
                        {initials}
                    </span>
                )}

                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white"
                        >
                            <Camera className="w-5 h-5 mb-1 text-white" />
                            <span className="text-[10px] uppercase tracking-wider font-medium text-white">Edit</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                />
            </div>

            {/* ─── Cropper Modal ─── */}
            <Dialog open={cropperOpen} onOpenChange={(open) => { if (!open) handleCancelCrop(); }}>
                <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-4 pb-2">
                        <DialogTitle className="text-sm font-semibold">Crop Avatar</DialogTitle>
                    </DialogHeader>

                    {/* Crop area */}
                    <div className="relative w-full bg-black/90" style={{ height: 360 }}>
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={aspectRatio}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                                cropShape="rect"
                                showGrid={false}
                                style={{
                                    containerStyle: { borderRadius: 0 },
                                    cropAreaStyle: {
                                        border: '2px solid var(--accent-base)',
                                        borderRadius: '12px',
                                    },
                                }}
                            />
                        )}
                    </div>

                    {/* Zoom slider */}
                    <div className="flex items-center gap-3 px-5 py-3 border-t border-border/40">
                        <ZoomOut className="w-4 h-4 opacity-50 shrink-0" />
                        <Slider
                            min={1}
                            max={3}
                            step={0.01}
                            value={[zoom]}
                            onValueChange={(v) => setZoom(v[0])}
                            className="flex-1"
                        />
                        <ZoomIn className="w-4 h-4 opacity-50 shrink-0" />
                    </div>

                    {/* Action buttons */}
                    <DialogFooter className="flex-row justify-end gap-2 px-4 py-3 border-t border-border/40">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelCrop}
                            className="gap-1.5 text-xs"
                        >
                            <X className="w-3.5 h-3.5" />
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleApplyCrop}
                            className="gap-1.5 text-xs bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)]"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
