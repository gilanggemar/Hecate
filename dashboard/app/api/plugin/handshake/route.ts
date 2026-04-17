import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns the install prompt text with embedded credentials.
 * The CLIENT sends it through the existing browser WebSocket connection
 * (which can reach Tailscale/private URLs since the browser is on the user's network).
 *
 * This avoids the "Vercel can't reach Tailscale" problem.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Credentials to embed in the install prompt ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    const promptText = buildInstallPrompt({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        userId,
    });

    // Return the prompt to the client — the browser will send it via its own WebSocket
    return NextResponse.json({ success: true, prompt: promptText });
}

function buildInstallPrompt(creds: { supabaseUrl: string; serviceRoleKey: string; userId: string }): string {
    return `[SYSTEM DIRECTIVE: INSTALL OFIERE PM PLUGIN — AUTOMATED SETUP]

You are installing the Ofiere PM plugin to integrate this OpenClaw instance with the Ofiere dashboard.
This is a one-time setup. Follow EVERY step EXACTLY. Do NOT skip any step. Do NOT modify any content.

## IMPORTANT: Do NOT modify openclaw.json. Only write files and append to .env.

---

**Step 1: Detect your OpenClaw home directory**

Run this command to find your OpenClaw home:
\`\`\`bash
if [ -d "/data/.openclaw" ]; then echo "/data/.openclaw"; elif [ -d "$HOME/.openclaw" ]; then echo "$HOME/.openclaw"; else echo "$HOME/.openclaw"; fi
\`\`\`

Use the output as OPENCLAW_HOME for ALL remaining steps. Replace every occurrence of OPENCLAW_HOME below with the actual path from this step.

---

**Step 2: Download the Ofiere plugin files**

Replace OPENCLAW_HOME with the path from Step 1, then run:
\`\`\`bash
OPENCLAW_HOME="<path from step 1>" && mkdir -p "$OPENCLAW_HOME/extensions" && cd /tmp && rm -rf ofiere-plugin-tmp && git clone --depth 1 https://github.com/gilanggemar/Ofiere.git ofiere-plugin-tmp 2>/dev/null && rm -rf "$OPENCLAW_HOME/extensions/ofiere" && cp -r ofiere-plugin-tmp/ofiere-openclaw-plugin "$OPENCLAW_HOME/extensions/ofiere" && rm -rf ofiere-plugin-tmp && echo "Plugin files installed to $OPENCLAW_HOME/extensions/ofiere"
\`\`\`

If git is not available, use curl instead:
\`\`\`bash
OPENCLAW_HOME="<path from step 1>" && mkdir -p "$OPENCLAW_HOME/extensions" && cd /tmp && curl -sSL https://github.com/gilanggemar/Ofiere/archive/refs/heads/main.tar.gz | tar xz && rm -rf "$OPENCLAW_HOME/extensions/ofiere" && cp -r Ofiere-main/ofiere-openclaw-plugin "$OPENCLAW_HOME/extensions/ofiere" && rm -rf Ofiere-main && echo "Plugin files installed to $OPENCLAW_HOME/extensions/ofiere"
\`\`\`

---

**Step 3: Configure environment variables**

Append these EXACT lines to OPENCLAW_HOME/.env (create the file if it doesn't exist). 
If any of these variables already exist in the file, UPDATE their values instead of duplicating them.

\`\`\`
OFIERE_SUPABASE_URL=${creds.supabaseUrl}
OFIERE_SERVICE_ROLE_KEY=${creds.serviceRoleKey}
OFIERE_USER_ID=${creds.userId}
\`\`\`

---

**Step 4: Verify**

Confirm the following:
1. The directory OPENCLAW_HOME/extensions/ofiere/ exists and contains \`index.ts\` and \`src/\`
2. The file OPENCLAW_HOME/.env contains all three \`OFIERE_*\` variables

---

**Step 5: Report back**

Tell the user:
- "✅ Ofiere PM plugin installed successfully!"
- "All agents on this OpenClaw instance now have access to 5 Ofiere tools: LIST_TASKS, CREATE_TASK, UPDATE_TASK, DELETE_TASK, LIST_AGENTS"
- "Please restart your gateway to activate the plugin (docker restart or openclaw gateway restart)"

Do NOT output the service role key in your response — keep it secure.
`;
}
