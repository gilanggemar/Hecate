import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    try {
        const { data: constellation, error } = await db
            .from('constellations')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw new Error(error.message);

        if (!constellation) {
            return NextResponse.json({ error: 'Constellation not found' }, { status: 404 });
        }

        return NextResponse.json({ constellation });
    } catch (error: any) {
        console.error('[constellation/get GET]', error);
        return NextResponse.json({ error: 'Failed to get constellation' }, { status: 500 });
    }
}
