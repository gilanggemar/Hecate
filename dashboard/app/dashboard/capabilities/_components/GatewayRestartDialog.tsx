'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface GatewayRestartDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export function GatewayRestartDialog({ onConfirm, onCancel }: GatewayRestartDialogProps) {
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = async () => {
        setIsConfirming(true);
        onConfirm();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onCancel}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md rounded-2xl bg-[#0c0c0b] border border-white/10 p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/15">
                        <AlertTriangle className="size-5 text-amber-400/80" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white/90">Restart Gateway?</h3>
                        <p className="text-xs font-mono text-white/40 mt-1 leading-relaxed">
                            Applying these changes will restart the OpenClaw Gateway server.
                            Active agent sessions may be briefly interrupted.
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-5">
                    <p className="text-[11px] font-mono text-white/30">
                        All tool and skill configuration changes will be written to the Gateway config.
                        The gateway will reload to activate the new settings.
                    </p>
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={isConfirming}
                        className="px-4 py-2 rounded-lg text-xs font-mono text-white/50 hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isConfirming}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                    >
                        {isConfirming ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        {isConfirming ? 'Restarting...' : 'Confirm & Restart'}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
