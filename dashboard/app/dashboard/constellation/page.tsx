"use client";

import { ConstellationHeader } from "@/components/constellation-builder/ConstellationHeader";
import { ConstellationCanvas } from "@/components/constellation-builder/ConstellationCanvas";

export default function ConstellationPage() {
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <ConstellationHeader />
            <div className="flex-1 relative">
                <ConstellationCanvas />
            </div>
        </div>
    );
}
