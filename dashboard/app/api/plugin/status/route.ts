import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/plugin/status
 *
 * Checks if the Ofiere plugin is currently installed and active
 * by querying the OpenClaw gateway for registered tools.
 */
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || process.env.NEXT_PUBLIC_OPENCLAW_URL || '';

    if (!GATEWAY_URL) {
        return NextResponse.json({ installed: false, reason: 'no_gateway', message: 'No OpenClaw gateway configured' });
    }

    try {
        // Try to check via the gateway's health or tools endpoint
        const wsUrl = GATEWAY_URL.replace(/^ws/, 'http').replace(/\/ws\/?$/, '');
        
        // Method 1: Check via REST health endpoint (most OpenClaw setups expose this)
        const healthRes = await fetch(`${wsUrl}/api/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        }).catch(() => null);

        if (healthRes?.ok) {
            const health = await healthRes.json().catch(() => null);
            
            // Check if ofiere tools are in the registered tools list
            const tools = health?.tools || health?.registeredTools || [];
            const plugins = health?.plugins || health?.loadedPlugins || [];
            
            const hasOfiereTools = Array.isArray(tools) && tools.some((t: any) => {
                const name = typeof t === 'string' ? t : t?.name || t?.id || '';
                return name.toLowerCase().includes('ofiere');
            });
            
            const hasOfierePlugin = Array.isArray(plugins) && plugins.some((p: any) => {
                const name = typeof p === 'string' ? p : p?.name || p?.id || '';
                return name.toLowerCase().includes('ofiere');
            });

            if (hasOfiereTools || hasOfierePlugin) {
                return NextResponse.json({ installed: true, source: 'health' });
            }
        }

        // Method 2: Check via tools.list RPC (if gateway supports it)
        const toolsRes = await fetch(`${wsUrl}/api/tools`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        }).catch(() => null);

        if (toolsRes?.ok) {
            const toolsData = await toolsRes.json().catch(() => null);
            const toolsList = toolsData?.tools || toolsData || [];
            
            if (Array.isArray(toolsList)) {
                const hasOfiere = toolsList.some((t: any) => {
                    const name = typeof t === 'string' ? t : t?.name || t?.id || '';
                    return name.toLowerCase().includes('ofiere');
                });
                if (hasOfiere) {
                    return NextResponse.json({ installed: true, source: 'tools' });
                }
            }
        }

        // Method 3: Fallback — check if the Supabase table has records for this user
        // (indicates the plugin was at least configured and used)
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        if (SUPABASE_URL && SERVICE_ROLE_KEY) {
            const sbRes = await fetch(
                `${SUPABASE_URL}/rest/v1/tasks?user_id=eq.${userId}&select=id&limit=1`,
                {
                    headers: {
                        'apikey': SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    },
                    signal: AbortSignal.timeout(3000),
                }
            ).catch(() => null);

            // If tasks table exists and has records, plugin was installed at some point
            // But this only tells us it WAS installed, not that it IS installed now
            // So we return 'unknown' status to be safe
        }

        // If we couldn't detect the plugin via any method, report it as not detected
        return NextResponse.json({ 
            installed: false, 
            reason: 'not_detected',
            message: 'Ofiere tools not found in gateway. Plugin may not be installed or gateway may need a restart.'
        });
        
    } catch (err: any) {
        return NextResponse.json({ 
            installed: false, 
            reason: 'error',
            message: err.message || 'Failed to check plugin status'
        });
    }
}
