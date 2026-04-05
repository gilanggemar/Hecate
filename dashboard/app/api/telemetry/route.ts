import { NextResponse } from 'next/server';
import { getTelemetrySummary, getAgentTelemetrySummary, logTelemetry } from '@/lib/telemetry/logger';
import type { TelemetryEntry } from '@/lib/telemetry/types';

// GET /api/telemetry — get summary stats (global or per-agent)
// Note: No auth required — telemetry is internal operational data, not user PII.
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agentId');

        // If agentId is provided, return per-agent summary
        if (agentId) {
            const agentSummary = await getAgentTelemetrySummary(agentId);
            return NextResponse.json(agentSummary);
        }

        // Otherwise return global summary
        const summary = await getTelemetrySummary();
        return NextResponse.json(summary);
    } catch (error: unknown) {
        console.error('Failed to get telemetry summary:', error);
        return NextResponse.json({ error: 'Failed to get telemetry' }, { status: 500 });
    }
}

// POST /api/telemetry — log a new telemetry entry
// Note: No auth required — this is called internally by client-side telemetry
// hooks (useSocket, useOpenClawStore) after every agent run completes.
// Blocking this behind auth caused all telemetry logging to silently fail.
export async function POST(request: Request) {
    try {
        const body: TelemetryEntry = await request.json();
        if (!body.agentId || !body.status) {
            return NextResponse.json({ error: 'agentId and status are required' }, { status: 400 });
        }
        await logTelemetry({ ...body, timestamp: body.timestamp || Date.now() });
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to log telemetry:', error);
        return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 });
    }
}
