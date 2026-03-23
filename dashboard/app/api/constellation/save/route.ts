import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, name, description, nodes, edges } = body;
        
        console.log(`[constellation/save] Saving: ${name}, nodes: ${nodes?.length}, edges: ${edges?.length}`);

        if (!name || !nodes || !edges) {
            return NextResponse.json({ error: 'Name, nodes, and edges are required' }, { status: 400 });
        }

        let constellationId = id;

        if (constellationId) {
            // Update
            const { error: updateError } = await db
                .from('constellations')
                .update({
                    name,
                    description: description || null,
                    nodes,
                    edges,
                    updated_at: new Date().toISOString()
                })
                .eq('id', constellationId)
                .eq('user_id', userId);
                
            if (updateError) throw new Error(updateError.message);
        } else {
            // Insert
            constellationId = uuidv4();
            const { error: insertError } = await db
                .from('constellations')
                .insert({
                    id: constellationId,
                    user_id: userId,
                    name,
                    description: description || null,
                    nodes,
                    edges,
                });
                
            if (insertError) throw new Error(insertError.message);
        }

        console.log(`[constellation/save] Successfully saved ${constellationId}`);
        return NextResponse.json({ success: true, id: constellationId });
    } catch (error: any) {
        console.error('[constellation/save POST] Exception:', error);
        return NextResponse.json({ error: error.message || 'Failed to save constellation' }, { status: 500 });
    }
}
