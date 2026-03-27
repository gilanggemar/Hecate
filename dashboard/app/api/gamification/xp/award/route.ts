import { NextResponse } from 'next/server';
import { awardXP } from '@/lib/gamification/xpEngine';
import { getAuthUserId } from '@/lib/auth';

export async function POST(req: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { agentId, amount, reason, sourceId } = await req.json();
        if (!amount || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        await awardXP(agentId, userId, amount, reason, sourceId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error awarding XP:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
