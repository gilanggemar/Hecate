'use client';

import { ReactNode } from 'react';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { Unplug, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ConnectionGuardProps {
    children: ReactNode;
}

export function ConnectionGuard({ children }: ConnectionGuardProps) {
    const isConnected = useOpenClawStore((s) => s.isConnected);
    const router = useRouter();

    if (!isConnected) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-5 text-center max-w-md">
                    <div className="flex items-center justify-center size-16 rounded-2xl bg-white/5 border border-white/10">
                        <Unplug className="size-7 text-white/40" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-semibold text-white/90">
                            Connect to OpenClaw Gateway
                        </h2>
                        <p className="text-sm text-white/50 font-mono leading-relaxed">
                            Capabilities are managed through a live OpenClaw Gateway connection.
                            Configure your connection profile to get started.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/settings/bridges')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono
                            bg-orange-500/10 text-orange-400 border border-orange-500/20
                            hover:bg-orange-500/20 transition-colors"
                    >
                        Go to Connection Settings
                        <ArrowRight className="size-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
