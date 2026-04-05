// Quick test: connect to OpenClaw gateway WS with proper handshake
import WebSocket from 'ws';
import crypto from 'crypto';

const WS_URL = 'wss://srv1335911.tailececae.ts.net';
const TOKEN = 'tHu1pVua4nosFlCTXREgDRbrBkGiyQqa';

const ws = new WebSocket(WS_URL);
let reqId = 0;

function sendFrame(frame) {
    const msg = JSON.stringify(frame);
    console.log(`\n>>> SEND: ${msg.substring(0, 200)}`);
    ws.send(msg);
}

function sendReq(method, params = {}) {
    const id = `test-${++reqId}`;
    sendFrame({ type: 'req', id, method, params });
    return id;
}

ws.on('open', () => {
    console.log('=== Connected ===');
});

let handshakeDone = false;

ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());

    // Handle connect.challenge
    if (msg.event === 'connect.challenge') {
        const nonce = msg.payload?.nonce;
        console.log('\n=== CHALLENGE received, nonce:', nonce);
        
        // Respond with connect frame (token-based auth)
        sendFrame({
            type: 'req',
            id: '__handshake__',
            method: 'connect',
            params: {
                token: TOKEN,
                nonce: nonce,
                clientId: 'nerv-test',
                clientVersion: '1.0.0',
                protocolVersion: '2025-03-26',
                capabilities: { scope: ['full-control'] },
            }
        });
        return;
    }

    // Handle handshake completion
    if (!handshakeDone && (msg.type === 'hello-ok' || msg.ok === true || msg.payload?.status === 'connected' || msg.payload?.greeting)) {
        handshakeDone = true;
        console.log('\n=== HANDSHAKE OK ===');
        console.log(JSON.stringify(msg, null, 2).substring(0, 500));

        // Now send usage queries
        console.log('\n\n========== SENDING USAGE QUERIES ==========');
        sendReq('usage.status', {});
        sendReq('usage.cost', {});
        sendReq('usage.status', { range: 'today' });
        sendReq('sessions.list', {});
        return;
    }

    // Print all other responses
    const data = JSON.stringify(msg, null, 2);
    console.log(`\n=== RESPONSE [id=${msg.id}] [type=${msg.type}] [event=${msg.event}] ===`);
    console.log(data.substring(0, 4000));
    if (data.length > 4000) console.log(`... (${data.length} total chars, truncated)`);
});

ws.on('error', (err) => {
    console.error('WS Error:', err.message);
});

setTimeout(() => {
    console.log('\n\nTimeout. Closing.');
    ws.close();
    process.exit(0);
}, 12000);
