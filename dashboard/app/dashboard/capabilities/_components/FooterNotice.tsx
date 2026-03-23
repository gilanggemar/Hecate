'use client';

import { AlertTriangle } from 'lucide-react';

export function FooterNotice() {
    return (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500/70" />
            <p className="text-xs font-mono text-amber-500/70 leading-relaxed">
                Changes are applied directly to the OpenClaw Gateway.
                Tool and skill changes take effect on the next agent turn.
            </p>
        </div>
    );
}
