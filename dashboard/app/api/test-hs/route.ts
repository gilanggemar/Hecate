import { NextResponse } from 'next/server';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';
import fs from 'fs';

export async function GET(request: Request) {
    try {
        fs.appendFileSync('./test_hs_debug.log', `[1] Test route triggered\n`);

        const adapter = getAdapterForAgent('thalia', 'openclaw', {
            baseUrl: 'ws://127.0.0.1:18789/v3/gateway',
            wsToken: 'debug', // assuming we need a token or none for local dev
        });
        
        fs.appendFileSync('./test_hs_debug.log', `[2] Adapter instantiated\n`);

        const promptText = `
{"type":"tools-handshake"}
[SYSTEM DIRECTIVE TEST]
Please reply to this with "HANDSHAKE SUCCESSFUL!"
`;
        
        fs.appendFileSync('./test_hs_debug.log', `[3] Awaiting invoke...\n`);

        const result = await adapter.invoke({
            agentId: 'thalia',
            runId: `ths-${Date.now()}`,
            stepId: 'handshake',
            task: promptText.trim(),
            sessionKeyOverride: 'agent:thalia:nchat',
            responseMode: 'text',
        }).catch(err => {
            fs.appendFileSync('./test_hs_debug.log', `[ERROR] Invoke Promise Rejected: ${err.stack || err}\n`);
        });

        fs.appendFileSync('./test_hs_debug.log', `[4] Invoke finished: ${JSON.stringify(result)}\n`);

        return NextResponse.json({ success: true, result });
    } catch (err: any) {
        fs.appendFileSync('./test_hs_debug.log', `[FATAL] Route crashed: ${err.stack || err}\n`);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
