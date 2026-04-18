import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns a personalized, single-command install script with embedded credentials.
 * The command:
 *   1. Downloads the plugin from npm
 *   2. Installs all dependencies automatically
 *   3. Configures environment variables
 *   4. Restarts the OpenClaw gateway
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    // Single command that does everything
    const installCmd = [
        `curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s --`,
        `--supabase-url "${SUPABASE_URL}"`,
        `--service-key "${SERVICE_ROLE_KEY}"`,
        `--user-id "${userId}"`,
    ].join(' \\\n  ');

    return NextResponse.json({
        success: true,
        installCommand: installCmd,
        steps: [
            {
                label: 'Install Ofiere plugin (paste this into your VPS terminal)',
                command: installCmd,
            },
        ],
    });
}
