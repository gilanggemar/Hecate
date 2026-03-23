import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';


export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('constellations')
            .select('id, name, description, nodes, updated_at')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Map to get count of nodes instead of full json
        const mappedData = (data || []).map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            nodesCount: Array.isArray(c.nodes) ? c.nodes.length : 0,
            updatedAt: c.updated_at,
        }));

        return NextResponse.json({ constellations: mappedData });
    } catch (error: any) {
        console.error('[constellation/list GET]', error);
        return NextResponse.json({ error: 'Failed to fetch constellations' }, { status: 500 });
    }
}
