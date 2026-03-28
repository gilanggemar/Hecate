"use client";

import { useState, useCallback } from 'react';
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
import { ZoomIn, ZoomOut, Check, X } from 'lucide-react';

interface PentagramCropModalProps {
    imageSrc: string;
    aspectRatio?: number; // undefined means free transform
    onClose: () => void;
    onApply: (blob: Blob) => void;
}

async function getCroppedImg(
    imageSrc: string,
    pixelCrop: Area
): Promise<Blob> {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d')!;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas is empty'));
        }, 'image/webp', 0.9);
    });
}

export function PentagramCropModal({ imageSrc, aspectRatio, onClose, onApply }: PentagramCropModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    const handleApply = async () => {
        if (!croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onApply(blob);
        } catch (e) {
            console.error("Cropping failed", e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[800px] p-0 gap-0 overflow-hidden border-white/10 bg-black text-white font-mono object-contain">
                <DialogHeader className="p-4 pb-2 border-b border-white/5 opacity-80">
                    <DialogTitle className="text-sm font-semibold uppercase tracking-widest text-emerald-500">
                        Adjust Asset Injection
                    </DialogTitle>
                </DialogHeader>

                <div className="relative w-full bg-black/90" style={{ height: 500 }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspectRatio}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        cropShape="rect"
                        showGrid={true}
                        style={{
                            containerStyle: { borderRadius: 0 },
                            cropAreaStyle: {
                                border: '2px solid #10b981',
                                borderRadius: '4px',
                            },
                        }}
                    />
                </div>

                <div className="flex items-center gap-3 px-5 py-3 border-t border-white/5">
                    <ZoomOut className="w-4 h-4 opacity-50 shrink-0 text-white" />
                    <Slider
                        min={1}
                        max={3}
                        step={0.01}
                        value={[zoom]}
                        onValueChange={(v) => setZoom(v[0])}
                        className="flex-1"
                    />
                    <ZoomIn className="w-4 h-4 opacity-50 shrink-0 text-white" />
                </div>

                <DialogFooter className="flex-row justify-end gap-2 px-4 py-3 border-t border-white/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="gap-1.5 text-xs text-white/50 hover:text-white"
                    >
                        <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleApply}
                        disabled={isProcessing}
                        className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow shadow-emerald-900"
                    >
                        <Check className="w-3.5 h-3.5" /> {isProcessing ? "Processing..." : "Confirm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
