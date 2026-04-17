import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import crypto from 'crypto';

/**
 * POST /api/plugin/handshake
 *
 * Zero-terminal plugin installer. Opens a raw WebSocket to the OpenClaw gateway,
 * sends the install prompt as a chat message, then closes immediately.
 * Fire-and-forget — does NOT wait for the agent to finish executing.
 *
 * Body: { agentId: string }  — which agent should run the install
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { agentId } = body;

    if (!agentId) {
        return NextResponse.json({ error: 'Missing agentId — which agent should run the install?' }, { status: 400 });
    }

    // ── Credentials to embed in the install prompt ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    try {
        const activeConn = await resolveActiveConnection(userId);

        if (!activeConn.openclaw.enabled) {
            return NextResponse.json({ error: 'No OpenClaw connection configured. Go to Settings → Console to connect.' }, { status: 400 });
        }

        const wsUrl = (activeConn.openclaw.wsUrl || activeConn.openclaw.httpUrl)
            .replace(/^http:/, 'ws:')
            .replace(/^https:/, 'wss:');
        const wsToken = activeConn.openclaw.token;

        if (!wsUrl || !wsToken) {
            return NextResponse.json({ error: 'OpenClaw connection URL or token is missing' }, { status: 400 });
        }

        const promptText = buildInstallPrompt({
            supabaseUrl: SUPABASE_URL,
            serviceRoleKey: SERVICE_ROLE_KEY,
            userId,
        });

        // Fire-and-forget: send the message and close
        // This avoids Vercel's serverless timeout killing the connection
        await sendChatMessage(wsUrl, wsToken, agentId, promptText);

        return NextResponse.json({ success: true, message: 'Plugin install sent to agent' });
    } catch (err: any) {
        console.error('[Plugin Install] Failed:', err);
        return NextResponse.json({ error: err.message || 'Failed to send install instructions' }, { status: 500 });
    }
}

/**
 * Opens a WebSocket to OpenClaw, completes HMAC handshake,
 * sends a chat message, and closes. Resolves once the message is sent.
 */
async function sendChatMessage(
    wsUrl: string,
    wsToken: string,
    agentId: string,
    message: string,
): Promise<void> {
    let WebSocketImpl: any;
    try {
        WebSocketImpl = (await import('ws')).default;
    } catch {
        WebSocketImpl = globalThis.WebSocket;
    }

    if (!WebSocketImpl) {
        throw new Error('No WebSocket implementation available');
    }

    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            try { ws?.close(); } catch {}
            reject(new Error('Timed out connecting to OpenClaw gateway (8s)'));
        }, 8000);

        const ws = new WebSocketImpl(wsUrl);
        let handshakeComplete = false;
        let messageSent = false;

        const handleMessage = async (rawData: any) => {
            const data = typeof rawData === 'string' ? rawData : rawData.toString();
            let frame: any;
            try { frame = JSON.parse(data); } catch { return; }

            // ─── Handle HMAC Challenge ───
            if (frame.event === 'connect.challenge' || frame.event === 'challenge' || frame.nonce) {
                const nonce = frame.payload?.nonce || frame.data?.nonce || frame.nonce;
                if (nonce && wsToken) {
                    try {
                        const keyPair = await globalThis.crypto.subtle.generateKey(
                            { name: 'Ed25519' }, true, ['sign', 'verify']
                        );
                        const pubRaw = await globalThis.crypto.subtle.exportKey('raw', keyPair.publicKey);
                        const publicKeyB64 = Buffer.from(pubRaw).toString('base64url');
                        const idHash = await globalThis.crypto.subtle.digest('SHA-256', pubRaw);
                        const deviceId = Array.from(new Uint8Array(idHash))
                            .map(b => b.toString(16).padStart(2, '0')).join('');

                        const signedAtMs = Date.now();
                        const payloadStr = [
                            'v3', deviceId, 'openclaw-control-ui', 'webchat', 'operator',
                            'operator.read,operator.write,operator.admin,operator.approvals',
                            String(signedAtMs), wsToken, nonce, 'web', 'desktop'
                        ].join('|');

                        const encoded = new TextEncoder().encode(payloadStr);
                        const sigBytes = await globalThis.crypto.subtle.sign(
                            { name: 'Ed25519' }, keyPair.privateKey, encoded
                        );
                        const signature = Buffer.from(sigBytes).toString('base64url');

                        ws.send(JSON.stringify({
                            type: 'req', id: '__handshake__', method: 'connect',
                            params: {
                                minProtocol: 3, maxProtocol: 3,
                                client: { id: 'openclaw-control-ui', version: '0.1.0', platform: 'web', deviceFamily: 'desktop', mode: 'webchat' },
                                device: { id: deviceId, publicKey: publicKeyB64, signature, signedAt: signedAtMs, nonce },
                                role: 'operator',
                                scopes: ['operator.read', 'operator.write', 'operator.admin', 'operator.approvals'],
                                caps: [], commands: [], permissions: {},
                                auth: { token: wsToken },
                                locale: 'en-US', userAgent: 'ofiere-plugin-install/1.0'
                            },
                        }));
                    } catch (e: any) {
                        clearTimeout(timeout);
                        try { ws.close(); } catch {}
                        reject(new Error(`HMAC handshake failed: ${e.message}`));
                    }
                }
                return;
            }

            // ─── Handle Handshake Response ───
            if (!handshakeComplete) {
                const isHandshakeRes = frame.id === '__handshake__' || frame.type === 'hello-ok' || frame.status === 'connected' || frame.greeting;
                if (isHandshakeRes) {
                    if (frame.error || frame.ok === false) {
                        clearTimeout(timeout);
                        try { ws.close(); } catch {}
                        reject(new Error(`OpenClaw handshake failed: ${JSON.stringify(frame.error)}`));
                        return;
                    }
                    handshakeComplete = true;
                    console.log('[Plugin Install] Handshake complete, sending install prompt...');

                    // Send the chat message to the agent
                    const sessionKey = `nchat:${agentId}`;
                    ws.send(JSON.stringify({
                        type: 'req',
                        id: `plugin-install-${Date.now()}`,
                        method: 'chat.send',
                        params: {
                            sessionKey,
                            message,
                            idempotencyKey: crypto.randomUUID(),
                        },
                    }));
                    return;
                }
            }

            // ─── Handle chat.send response ───
            if (handshakeComplete && !messageSent && frame.type === 'res') {
                messageSent = true;
                console.log('[Plugin Install] Chat message accepted by gateway');
                clearTimeout(timeout);
                // Close after a short delay to ensure message is fully dispatched
                setTimeout(() => {
                    try { ws.close(1000, 'Install sent'); } catch {}
                    resolve();
                }, 500);
            }
        };

        // Wire up events
        if (ws.on) {
            ws.on('message', handleMessage);
            ws.on('error', (err: any) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket error: ${err?.message || 'connection failed'}`));
            });
            ws.on('close', () => {
                clearTimeout(timeout);
                if (messageSent) {
                    resolve();
                } else if (!handshakeComplete) {
                    reject(new Error('WebSocket closed before handshake completed'));
                }
            });
        } else {
            ws.onmessage = (event: MessageEvent) => handleMessage(event.data);
            ws.onerror = () => { clearTimeout(timeout); reject(new Error('WebSocket error')); };
            ws.onclose = () => { clearTimeout(timeout); if (messageSent) resolve(); };
        }
    });
}

function buildInstallPrompt(creds: { supabaseUrl: string; serviceRoleKey: string; userId: string }): string {
    return `[SYSTEM DIRECTIVE: INSTALL OFIERE PM PLUGIN — AUTOMATED SETUP]

You are installing the Ofiere PM plugin to integrate this OpenClaw instance with the Ofiere dashboard.
This is a one-time setup. Follow EVERY step EXACTLY. Do NOT skip any step. Do NOT modify any content.

## IMPORTANT: Do NOT modify openclaw.json. Only write files and append to .env.

---

**Step 1: Detect your OpenClaw home directory**

Check which path exists:
- If \`/data/.openclaw/\` exists → use that (Docker)
- If \`~/.openclaw/\` exists → use that (native install)
- Otherwise → create \`~/.openclaw/\`

Call this path OPENCLAW_HOME for the remaining steps.

---

**Step 2: Download the Ofiere plugin files**

Run this command:
\`\`\`bash
mkdir -p /data/.openclaw/extensions && cd /tmp && rm -rf ofiere-plugin-tmp && git clone --depth 1 https://github.com/gilanggemar/Ofiere.git ofiere-plugin-tmp 2>/dev/null && rm -rf /data/.openclaw/extensions/ofiere && cp -r ofiere-plugin-tmp/ofiere-openclaw-plugin /data/.openclaw/extensions/ofiere && rm -rf ofiere-plugin-tmp && echo "Plugin files installed"
\`\`\`

If git is not available, try curl:
\`\`\`bash
mkdir -p /data/.openclaw/extensions && cd /tmp && curl -sSL https://github.com/gilanggemar/Ofiere/archive/refs/heads/main.tar.gz | tar xz && rm -rf /data/.openclaw/extensions/ofiere && cp -r Ofiere-main/ofiere-openclaw-plugin /data/.openclaw/extensions/ofiere && rm -rf Ofiere-main && echo "Plugin files installed"
\`\`\`

---

**Step 3: Configure environment variables**

Append these EXACT lines to \`/data/.openclaw/.env\` (create the file if it doesn't exist). 
If any of these variables already exist in the file, UPDATE their values instead of duplicating them.

\`\`\`
OFIERE_SUPABASE_URL=${creds.supabaseUrl}
OFIERE_SERVICE_ROLE_KEY=${creds.serviceRoleKey}
OFIERE_USER_ID=${creds.userId}
\`\`\`

---

**Step 4: Verify**

Confirm the following:
1. The directory \`/data/.openclaw/extensions/ofiere/\` exists and contains \`index.ts\` and \`src/\`
2. The file \`/data/.openclaw/.env\` contains all three \`OFIERE_*\` variables

---

**Step 5: Report back**

Tell the user:
- "✅ Ofiere PM plugin installed successfully!"
- "All agents on this OpenClaw instance now have access to 5 Ofiere tools: LIST_TASKS, CREATE_TASK, UPDATE_TASK, DELETE_TASK, LIST_AGENTS"
- "Please restart your gateway to activate the plugin (docker restart or openclaw gateway restart)"

Do NOT output the service role key in your response — keep it secure.
`;
}
