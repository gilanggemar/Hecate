import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { content, agentId, source = 'constellation', tags = [] } = body;

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        const newFragment = {
            id: uuidv4(),
            agent_id: agentId || null,
            content,
            source,
            tags,
            importance: 5,
        };

        const { error } = await db.from('knowledge_fragments').insert(newFragment);
        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true, fragment: newFragment });
    } catch (error: any) {
        console.error('[constellation/save-fragment POST]', error);
        return NextResponse.json({ error: error.message || 'Failed to save knowledge fragment' }, { status: 500 });
    }
}
