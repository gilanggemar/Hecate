### the core model (why plugins crash gateway)

openclaw plugins run **in-process** with gateway, so a broken plugin can crash or block startup.

plugin path has 3 strict layers:

1) discovery/load
2) manifest + config schema validation
3) runtime hook execution

if any of these are wrong (missing manifest, bad schema, unknown plugin id, uncaught runtime throw), server can fail. that’s exactly why we harden from day one.

---

### required file structure (minimum)

```txt
~/.openclaw/extensions/n-session-plugin/
openclaw.plugin.json
index.js
```

---

### mandatory manifest (copy-paste)

`~/.openclaw/extensions/n-session-plugin/openclaw.plugin.json`
```json
{
"id": "n-session-plugin",
"name": "N Session Plugin",
"version": "1.0.0",
"description": "Custom plugin active only for n* sessions",
"configSchema": {
"type": "object",
"additionalProperties": false,
"properties": {
"enabled": { "type": "boolean" },
"sessionPrefix": { "type": "string" },
"logActivations": { "type": "boolean" }
}
}
}
```

notes:
- `openclaw.plugin.json` is required.
- `id` must match config keys exactly.
- keep schema strict (`additionalProperties:false`) so config mistakes fail early.

---

### safe runtime starter (copy-paste)

`~/.openclaw/extensions/n-session-plugin/index.js`
```js
module.exports = function register(api) {
const cfg = api.pluginConfig || {};
const enabled = cfg.enabled !== false;
const sessionPrefix = typeof cfg.sessionPrefix === "string" ? cfg.sessionPrefix : "n";
const logActivations = cfg.logActivations !== false;

api.on("before_agent_start", (event, ctx) => {
try {
if (!enabled) return;

const sessionKey = String(ctx?.sessionKey || "");

// hard gate: ONLY n* sessions run plugin logic
if (!sessionKey.startsWith(sessionPrefix)) return;

if (logActivations) {
api.logger.info(`[n-session-plugin] active for sessionKey=${sessionKey}`);
}

// put your n-session-only behavior here
// e.g. handshake injection / scoped runtime config / etc.
} catch (err) {
// fail-open: never break reply path
api.logger.warn(`[n-session-plugin] hook error: ${String(err)}`);
}
});
};
```

---

### openclaw.json registration (required)

you need **both** allowlist + entry:

```json
{
"plugins": {
"allow": [
"n-session-plugin"
],
"entries": {
"n-session-plugin": {
"enabled": true,
"config": {
"enabled": true,
"sessionPrefix": "n",
"logActivations": true
}
}
}
}
}
```

then restart gateway (plugin/config changes require restart).

---

### what this guarantees

with `sessionPrefix: "n"`:

- `nchat-...` ✅ plugin active
- `nsummit-...` ✅ plugin active
- `nworkflow-...` ✅ plugin active
- normal webchat/direct session keys ❌ plugin inactive (returns immediately)

---

### safe rollout sequence (so it won’t kill server)

phase 1: manifest + empty register function
phase 2: add one hook + no-op return
phase 3: add n-prefix gate only
phase 4: add real logic (handshake/config)
phase 5: add state/persistence

don’t skip phases.

---

### common failure points and fixes

1) missing manifest
- fix: add `openclaw.plugin.json` in plugin root.

2) id mismatch
- fix: same id in manifest, `plugins.allow`, and `plugins.entries`.

3) invalid config shape
- fix: respect schema exactly.

4) uncaught exceptions in hook
- fix: try/catch every hook body.

5) global behavior leakage
- fix: first line after reading session key must gate by `startsWith("n")`.

6) blocking/heavy synchronous work
- fix: keep hooks fast; use timeouts for external calls.

7) changed config but forgot restart
- fix: restart gateway after plugin or config edits.

---

### production hardening pattern

when you add real behavior later:

- fail-open for chat flow (plugin errors must not block replies)
- fail-closed for sensitive features (if creds invalid, disable feature)
- never print secrets in logs
- add dedupe by `sessionKey::runId` to avoid double execution
- bound in-memory maps/queues to avoid leaks

---

### verification checklist (after each change)

```bash
openclaw status
openclaw gateway status
openclaw doctor
openclaw plugins list
openclaw plugins info n-session-plugin
openclaw logs --follow
```

success signs:
- gateway running
- doctor clean for plugin validation
- plugin listed/enabled
- logs show activation only for `n*` sessions

---

### quick “golden rule” snippet for your IDE

```js
const sessionKey = String(ctx?.sessionKey || "");
if (!sessionKey.startsWith("n")) return; // plugin OFF outside n-session traffic
```

that line is the enforcement anchor for everything you want.