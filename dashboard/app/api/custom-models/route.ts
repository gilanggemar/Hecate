import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptApiKey, maskApiKey, decryptApiKey } from '@/lib/providers/crypto';
import { getAuthUserId } from '@/lib/auth';

// GET /api/custom-models — list all custom models for the user
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data: rows, error } = await db
            .from('custom_models')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        const result = (rows || []).map((row: any) => ({
            id: row.id,
            providerType: row.provider_type,
            providerName: row.provider_name,
            modelId: row.model_id,
            displayName: row.display_name,
            baseUrl: row.base_url,
            contextWindow: row.context_window,
            isActive: !!row.is_active,
            maskedKey: row.encrypted_api_key
                ? maskApiKey(decryptApiKey(row.encrypted_api_key))
                : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Failed to list custom models:', error);
        return NextResponse.json({ error: 'Failed to list custom models' }, { status: 500 });
    }
}

// POST /api/custom-models — create a new custom model
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { providerType, providerName, modelId, displayName, baseUrl, apiKey, contextWindow } = body;

        if (!providerType || !modelId) {
            return NextResponse.json(
                { error: 'providerType and modelId are required' },
                { status: 400 }
            );
        }

        const id = crypto.randomUUID();

        const { error } = await db.from('custom_models').insert({
            id,
            user_id: userId,
            provider_type: providerType,
            provider_name: providerName || providerType,
            model_id: modelId,
            display_name: displayName || modelId,
            base_url: baseUrl || null,
            encrypted_api_key: apiKey ? encryptApiKey(apiKey) : null,
            context_window: contextWindow || null,
            is_active: true,
        });

        if (error) throw new Error(error.message);

        return NextResponse.json({
            id,
            providerType,
            providerName: providerName || providerType,
            modelId,
            displayName: displayName || modelId,
            baseUrl,
            contextWindow,
            isActive: true,
            maskedKey: apiKey ? maskApiKey(apiKey) : undefined,
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create custom model:', error);
        return NextResponse.json({ error: 'Failed to create custom model' }, { status: 500 });
    }
}
