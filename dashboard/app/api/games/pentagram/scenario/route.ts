import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        const [scenesResult, choicesResult] = await Promise.all([
            db.from('pentagram_custom_scenes').select('*'),
            db.from('pentagram_custom_choices').select('*')
        ]);

        if (scenesResult.error) throw scenesResult.error;
        if (choicesResult.error) throw choicesResult.error;

        return NextResponse.json({
            scenes: scenesResult.data,
            choices: choicesResult.data
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { type, payload } = body;

        if (type === 'scene') {
            // payload must have scene_id and scene_data
            const { error, data } = await db.from('pentagram_custom_scenes').upsert(
                { scene_id: payload.scene_id, scene_data: payload.scene_data },
                { onConflict: 'scene_id'}
            ).select().single();
            if (error) throw error;
            return NextResponse.json(data);
        } else if (type === 'choice') {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.id || '');
            
            // Clean up old overrides if the id is a string
            if (!isUUID && payload.choice_data?.id) {
                await db.from('pentagram_custom_choices')
                    .delete()
                    .eq('parent_scene_id', payload.parent_scene_id)
                    .eq('choice_data->>id', payload.choice_data.id);
            }

            const params: any = {
                parent_scene_id: payload.parent_scene_id,
                choice_data: payload.choice_data
            };
            if (isUUID) {
                params.id = payload.id;
            }

            const { error, data } = await db.from('pentagram_custom_choices').upsert(
                params,
                isUUID ? { onConflict: 'id'} : undefined
            ).select().single();
            if (error) throw error;
            return NextResponse.json(data);
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) return NextResponse.json({ error: 'Missing type or id' }, { status: 400 });

        if (type === 'scene') {
            const { error } = await db.from('pentagram_custom_scenes').delete().eq('scene_id', id);
            if (error) throw error;
            return NextResponse.json({ success: true });
        } else if (type === 'choice') {
            const { error } = await db.from('pentagram_custom_choices').delete().eq('id', id);
            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
