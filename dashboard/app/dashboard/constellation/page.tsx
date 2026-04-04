"use client";

import { ConstellationHeader } from "@/components/constellation-builder/ConstellationHeader";
import { ConstellationCanvas } from "@/components/constellation-builder/ConstellationCanvas";

export default function ConstellationPage() {
    return (
        <div className="relative h-full w-full overflow-hidden">
            <ConstellationHeader />
            <ConstellationCanvas />
        </div>
    );
}
