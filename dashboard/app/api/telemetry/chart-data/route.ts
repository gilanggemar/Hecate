import { NextResponse } from 'next/server';
import { getChartData } from '@/lib/telemetry/logger';

// GET /api/telemetry/chart-data — time-series data for charts
// No auth required — internal operational telemetry.
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || '24h';

        const now = Date.now();
        let from: number;
        switch (range) {
            case '7d': from = now - 7 * 24 * 60 * 60 * 1000; break;
            case '30d': from = now - 30 * 24 * 60 * 60 * 1000; break;
            default: from = now - 24 * 60 * 60 * 1000; break;
        }

        const data = await getChartData(from, now);
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('Failed to get chart data:', error);
        return NextResponse.json({ error: 'Failed to get chart data' }, { status: 500 });
    }
}
