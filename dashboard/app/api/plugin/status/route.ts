import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/plugin/status
 *
 * Checks if the Ofiere plugin is currently installed by:
 * 1. Checking if the user has tasks in the tasks table (plugin was used)
 * 2. Checking if OFIERE env vars exist in the connection profile
 */
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ installed: false, reason: 'no_config' });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        // Method 1: Check if the user has any agents in the agents table
        // that were created by the Ofiere plugin
        const { data: agents, error: agentsErr } = await supabase
            .from('agents')
            .select('id')
            .eq('user_id', userId)
            .limit(1);
        
        // If agents table exists and has data for this user, plugin is active
        if (!agentsErr && agents && agents.length > 0) {
            return NextResponse.json({ installed: true, source: 'agents_table' });
        }

        // Method 2: Check the tasks table for this user
        const { data: tasks, error: tasksErr } = await supabase
            .from('tasks')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

        if (!tasksErr && tasks && tasks.length > 0) {
            return NextResponse.json({ installed: true, source: 'tasks_table' });
        }

        // Method 3: Check if the connection profile has OFIERE credentials stored
        const { data: profiles } = await supabase
            .from('connection_profiles')
            .select('openclaw_config')
            .eq('user_id', userId)
            .limit(1);

        if (profiles && profiles.length > 0) {
            const config = profiles[0]?.openclaw_config;
            if (config) {
                const configStr = JSON.stringify(config).toLowerCase();
                if (configStr.includes('ofiere')) {
                    return NextResponse.json({ installed: true, source: 'connection_profile' });
                }
            }
        }

        // Nothing found
        return NextResponse.json({ installed: false, reason: 'no_data' });
    } catch (err: any) {
        return NextResponse.json({ installed: false, reason: 'error', message: err.message });
    }
}
