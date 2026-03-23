import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadImage, deleteImage, isStorageUrl, extractStoragePath } from '@/lib/supabaseStorage';
import { getAuthUserId } from '@/lib/auth';

// Allow large hero image uploads (up to 50MB)
export const runtime = 'nodejs';
export const maxDuration = 60;

// GET all hero images for an agent
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

    try {
        const { data: images } = await db.from('hero_images')
            .select('id, image_data, sort_order, position_x, position_y')
            .eq('user_id', userId)
            .eq('agent_id', agentId)
            .order('sort_order', { ascending: true });

        const { data: agent } = await db.from('agents').select('active_hero_index').eq('user_id', userId).eq('id', agentId).single();
        const activeIndex = agent?.active_hero_index ?? 0;

        return NextResponse.json({
            images: (images || []).map((img: any) => ({
                id: img.id,
                imageData: img.image_data,
                sortOrder: img.sort_order,
                positionX: img.position_x ?? 50,
                positionY: img.position_y ?? 100,
            })),
            activeIndex,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST a new hero image for an agent
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const formData = await request.formData();
        const agentId = formData.get('agentId') as string;
        const heroFile = formData.get('heroImage') as File;

        if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
        if (!heroFile) return NextResponse.json({ error: 'Missing heroImage file' }, { status: 400 });

        // Parse position data
        const positionX = parseFloat(formData.get('positionX') as string) || 50;
        const positionY = parseFloat(formData.get('positionY') as string) || 100;

        // Convert file to base64 data URI, then upload to Supabase Storage
        const buffer = Buffer.from(await heroFile.arrayBuffer());
        const base64 = buffer.toString('base64');
        const dataUri = `data:${heroFile.type};base64,${base64}`;

        // Upload to Supabase Storage
        const ext = heroFile.type.split('/')[1] || 'png';
        const path = `heroes/${agentId}-${Date.now()}.${ext}`;
        const imageUrl = await uploadImage(dataUri, path);

        // Ensure agent exists BEFORE inserting hero_image (foreign key constraint)
        const { data: agentRow } = await db.from('agents').select('id').eq('user_id', userId).eq('id', agentId).single();
        if (!agentRow) {
            await db.from('agents').insert({ user_id: userId, id: agentId, name: agentId, status: 'idle' });
        }

        // Get current max sortOrder
        const { data: existing } = await db.from('hero_images')
            .select('sort_order')
            .eq('agent_id', agentId)
            .order('sort_order', { ascending: true });
        const nextSort = existing && existing.length > 0 ? existing[existing.length - 1].sort_order + 1 : 0;

        // Insert new hero image with URL and position
        const { data: result, error } = await db.from('hero_images').insert({
            user_id: userId,
            agent_id: agentId,
            image_data: imageUrl,
            sort_order: nextSort,
            position_x: positionX,
            position_y: positionY,
        }).select().single();

        if (error) throw new Error(error.message);

        // Update the agent's hero_image column + set active to new image
        await db.from('agents').update({ hero_image: imageUrl, active_hero_index: nextSort }).eq('user_id', userId).eq('id', agentId);

        return NextResponse.json({
            success: true,
            image: {
                id: result.id,
                imageData: imageUrl,
                sortOrder: nextSort,
                positionX,
                positionY,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE a hero image
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { imageId, agentId } = await request.json();
        if (!imageId) return NextResponse.json({ error: 'Missing imageId' }, { status: 400 });

        // Get the image data before deleting to clean up storage
        const { data: imageToDelete } = await db.from('hero_images')
            .select('image_data')
            .eq('id', imageId)
            .single();

        // Delete from storage if it's a storage URL
        if (imageToDelete?.image_data && isStorageUrl(imageToDelete.image_data)) {
            const storagePath = extractStoragePath(imageToDelete.image_data);
            if (storagePath) {
                try {
                    await deleteImage(storagePath);
                } catch (e) {
                    console.warn('Failed to delete image from storage:', e);
                }
            }
        }

        await db.from('hero_images').delete().eq('user_id', userId).eq('id', imageId);

        // If we deleted the active image, reset to first available
        if (agentId) {
            const { data: remaining } = await db.from('hero_images')
                .select('image_data')
                .eq('agent_id', agentId)
                .order('sort_order', { ascending: true });

            const newHero = remaining && remaining.length > 0 ? remaining[0].image_data : null;
            await db.from('agents').update({
                hero_image: newHero,
                active_hero_index: 0,
            }).eq('user_id', userId).eq('id', agentId);
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PATCH to set the active hero image index
export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { agentId, activeIndex } = await request.json();
        if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

        const { data: images } = await db.from('hero_images')
            .select('image_data, sort_order')
            .eq('agent_id', agentId)
            .order('sort_order', { ascending: true });

        const imgList = images || [];
        const clamped = Math.max(0, Math.min(activeIndex, imgList.length - 1));
        const activeImage = imgList[clamped];

        await db.from('agents').update({
            hero_image: activeImage?.image_data || null,
            active_hero_index: clamped,
        }).eq('user_id', userId).eq('id', agentId);

        return NextResponse.json({ success: true, activeIndex: clamped });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
