import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns personalized install commands with embedded credentials.
 * The user copies them and runs in their VPS terminal — same pattern as Composio.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        steps: [
            {
                label: 'Install Ofiere OpenClaw plugin',
                command: 'openclaw plugins install ofiere-openclaw-plugin',
            },
            {
                label: 'Set Supabase URL',
                command: `openclaw config set plugins.entries.ofiere.config.supabaseUrl "${SUPABASE_URL}"`,
            },
            {
                label: 'Set Service Role Key',
                command: `openclaw config set plugins.entries.ofiere.config.serviceRoleKey "${SERVICE_ROLE_KEY}"`,
            },
            {
                label: 'Set User ID',
                command: `openclaw config set plugins.entries.ofiere.config.userId "${userId}"`,
            },
            {
                label: 'Allow Ofiere tools',
                command: 'openclaw config set tools.allow composio ofiere',
            },
            {
                label: 'Restart OpenClaw',
                command: 'openclaw gateway restart',
            },
        ],
    });
}
