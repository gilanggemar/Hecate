# Featherless AI with OpenClaw Agents

A practical guide for configuring Featherless AI models correctly inside OpenClaw.

This write-up is based on:

- local OpenClaw docs in the installed `openclaw` package
- OpenClaw documentation pages for models, model providers, config, and Control UI
- Featherless public site and live API surface
- Featherless live model catalog at `https://api.featherless.ai/v1/models`

---

## Executive summary

The correct way to use Featherless with OpenClaw is:

1. Treat Featherless as a **custom OpenAI-compatible provider**.
2. Register it under `models.providers.featherless`.
3. Point it at `https://api.featherless.ai/v1`.
4. Set `api: "openai-completions"`.
5. Supply your Featherless API key.
6. Curate a **small list of models** you actually want OpenClaw to use.
7. Reference those models as normal `provider/model` refs such as:
   - `featherless/Sao10K/L3.3-70B-Euryale-v2.3`
   - `featherless/deepseek-ai/DeepSeek-R1-Distill-Llama-70B`

This is the safest, most maintainable OpenClaw-native pattern.

---

## Why this is the right architecture

OpenClaw separates model selection into two layers:

### 1) Provider registry
This lives under:

```json5
models.providers
```

That is where custom/self-hosted/OpenAI-compatible providers are defined.

### 2) Agent model policy
This lives under:

```json5
agents.defaults.model
agents.defaults.models
```

That is where you decide:

- primary model
- fallback models
- aliases
- model allowlist/catalog visible to `/model`

So Featherless is not something you “sprinkle” directly into one random model field. It should be modeled as a provider first, then selected by agents second.

---

## Key OpenClaw rules that matter here

### Model references use `provider/model`
Examples:

- `openai/gpt-5.4`
- `anthropic/claude-opus-4-6`
- `featherless/Sao10K/L3.3-70B-Euryale-v2.3`

### `agents.defaults.models` becomes an allowlist
If you set this block, only listed models are selectable via:

- `/model`
- session overrides
- other model selection flows

If a model is not listed there, OpenClaw can reject it as:

> Model "provider/model" is not allowed.

### Fallback order
OpenClaw resolves models in this order:

1. `agents.defaults.model.primary`
2. `agents.defaults.model.fallbacks[]`
3. provider auth failover inside the same provider

### Custom providers belong in `models.providers`
OpenClaw’s docs show custom providers using fields like:

- `baseUrl`
- `apiKey`
- `api`
- `models`

And for OpenAI-compatible services, the API mode is:

```json5
api: "openai-completions"
```

---

## What we verified about Featherless

### Working base API surface
The Featherless API root responds at:

```text
https://api.featherless.ai
```

### Model catalog endpoint
Featherless exposes a live OpenAI-style model catalog at:

```text
https://api.featherless.ai/v1/models
```

That endpoint returns model IDs like:

- `Sao10K/Fimbulvetr-11B-v2`
- `vicgalle/Roleplay-Llama-3-8B`
- `SteelStorage/L3-Aethora-15B`
- many others

### Docs hostname issue
The hostname below did **not** resolve during testing:

```text
docs.featherless.ai
```

So the reliable sources were the live API and the main Featherless website, not that docs subdomain.

---

## Recommended OpenClaw config pattern

Here is the recommended baseline config:

```json5
{
  env: {
    FEATHERLESS_API_KEY: "sk-...",
  },

  agents: {
    defaults: {
      model: {
        primary: "featherless/Sao10K/L3.3-70B-Euryale-v2.3",
        fallbacks: [
          "featherless/deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
        ],
      },

      models: {
        "featherless/Sao10K/L3.3-70B-Euryale-v2.3": {
          alias: "euryale",
        },
        "featherless/deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
          alias: "backup",
        },
      },
    },
  },

  models: {
    mode: "merge",
    providers: {
      featherless: {
        baseUrl: "https://api.featherless.ai/v1",
        apiKey: "${FEATHERLESS_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "Sao10K/L3.3-70B-Euryale-v2.3",
            name: "L3.3 70B Euryale v2.3",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 32768,
            maxTokens: 8192,
          },
          {
            id: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
            name: "DeepSeek R1 Distill Llama 70B",
            reasoning: true,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 32768,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

---

## Field-by-field explanation

### `models.providers.featherless`
This defines Featherless as a custom provider.

#### `baseUrl`
Use:

```json5
baseUrl: "https://api.featherless.ai/v1"
```

That is the provider base URL OpenClaw should call.

#### `apiKey`
Use either:

```json5
apiKey: "${FEATHERLESS_API_KEY}"
```

or a different secret strategy if you manage secrets another way.

#### `api`
For Featherless, use:

```json5
api: "openai-completions"
```

This is the key that tells OpenClaw the provider behaves like an OpenAI-compatible chat/completions endpoint.

#### `models`
This is your curated provider catalog.

Important:

- `id` is the model ID **without** the `featherless/` prefix.
- OpenClaw will expose it as `featherless/<id>`.
- You do **not** need to dump the entire Featherless catalog here.

---

## Why you should not import the entire Featherless catalog

Featherless exposes a very large catalog.

That does **not** mean you want all of it inside OpenClaw.

If you register too many models:

- `/model` becomes noisy
- fallbacks become hard to reason about
- agents can drift into weird low-quality models
- debugging gets harder
- tool-use reliability becomes inconsistent

### Better strategy
For each agent role, keep:

- 1 primary model
- 1 fallback model
- optional 1 fast/cheap utility model

That is usually enough.

---

## Recommended setup strategy by use case

### General conversational agent
Pick a stable instruct/chat model with good writing quality.

### Reasoning-heavy agent
Pick a reasoning-capable model only if it is actually reliable under Featherless and not just labeled that way.

### Roleplay / style-heavy agent
Pick models specifically known for style, tone, and character consistency.

### Tool-heavy OpenClaw agent
Favor reliability over novelty.

Just because a model appears in `/v1/models` with some capability metadata does **not** mean it is a good operational choice for OpenClaw tool workflows.

---

## Step-by-step setup paths

This section gives you the setup flow three different ways:

1. terminal/manual config editing
2. Control UI / web UI
3. one-shot terminal commands

---

# Option A — Terminal setup by editing `openclaw.json`

## Step 1: locate the config file
Run:

```bash
openclaw config file
```

This prints the active config path.

Usually it is:

```text
~/.openclaw/openclaw.json
```

On Windows, this will resolve to your OpenClaw state/config location.

## Step 2: set your Featherless API key
Choose one of these patterns.

### Simple env-in-config pattern
Add this to your config:

```json5
env: {
  FEATHERLESS_API_KEY: "sk-...",
}
```

### Better operational pattern
Set the environment variable outside the config and reference it:

PowerShell:

```powershell
$env:FEATHERLESS_API_KEY = "sk-..."
```

Persistent user env on Windows:

```powershell
setx FEATHERLESS_API_KEY "sk-..."
```

Then in config use:

```json5
apiKey: "${FEATHERLESS_API_KEY}"
```

## Step 3: add the custom provider
Add a `models.providers.featherless` block:

```json5
models: {
  mode: "merge",
  providers: {
    featherless: {
      baseUrl: "https://api.featherless.ai/v1",
      apiKey: "${FEATHERLESS_API_KEY}",
      api: "openai-completions",
      models: [
        {
          id: "Sao10K/L3.3-70B-Euryale-v2.3",
          name: "L3.3 70B Euryale v2.3",
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 32768,
          maxTokens: 8192,
        }
      ],
    },
  },
}
```

## Step 4: set the default model and allowlist
Add:

```json5
agents: {
  defaults: {
    model: {
      primary: "featherless/Sao10K/L3.3-70B-Euryale-v2.3",
      fallbacks: [],
    },
    models: {
      "featherless/Sao10K/L3.3-70B-Euryale-v2.3": {
        alias: "euryale",
      },
    },
  },
}
```

## Step 5: validate config
Run:

```bash
openclaw config validate
```

If validation fails, OpenClaw will tell you which field is wrong.

## Step 6: inspect model resolution
Run:

```bash
openclaw models status
openclaw models list --provider featherless
```

You want to confirm:

- Featherless provider is visible
- the primary model resolves
- the model appears in the configured catalog

## Step 7: run doctor if needed
If something still feels off:

```bash
openclaw doctor
```

---

# Option B — Control UI / Web UI setup

The Control UI is served by the Gateway, usually at:

```text
http://127.0.0.1:18789/
```

If it is not running yet:

```bash
openclaw gateway
```

## Step 1: open the Control UI
Open in browser:

```text
http://127.0.0.1:18789/
```

## Step 2: connect/authenticate
If prompted, enter your gateway token.

The docs note that the dashboard stores the token for the current browser tab session and selected gateway URL.

## Step 3: open the Config section
Use the Config tab in the Control UI.

OpenClaw docs note that the Control UI supports:

- config viewing/editing
- schema/form rendering
- raw JSON editing
- config apply with validation and restart behavior

## Step 4: add the Featherless provider block
Under the config editor, add:

```json5
models: {
  mode: "merge",
  providers: {
    featherless: {
      baseUrl: "https://api.featherless.ai/v1",
      apiKey: "${FEATHERLESS_API_KEY}",
      api: "openai-completions",
      models: [
        {
          id: "Sao10K/L3.3-70B-Euryale-v2.3",
          name: "L3.3 70B Euryale v2.3",
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 32768,
          maxTokens: 8192,
        }
      ],
    },
  },
}
```

## Step 5: add the agent model block
Also add or update:

```json5
agents: {
  defaults: {
    model: {
      primary: "featherless/Sao10K/L3.3-70B-Euryale-v2.3",
      fallbacks: [],
    },
    models: {
      "featherless/Sao10K/L3.3-70B-Euryale-v2.3": {
        alias: "euryale",
      },
    },
  },
}
```

## Step 6: save/apply
Save the config through the Control UI.

OpenClaw should validate it before applying.

## Step 7: verify in sessions or models view
Check:

- model shows up in `/model`
- the default session resolves to the Featherless model
- no validation errors occur

---

# Option C — One-shot terminal command approach

This is best when you want quick non-interactive changes.

## Step 1: set the provider block
You can either edit the config manually or use `openclaw config set` path-by-path.

Because the Featherless provider block is nested and includes arrays/objects, the cleanest one-shot approach is usually one of these:

### Approach 1: use a temp JSON/JSON5 file and merge manually
Create a patch/config snippet file, then paste it into your config.

### Approach 2: use `openclaw config set` for targeted values
Examples:

```bash
openclaw config set models.mode merge
openclaw config set models.providers.featherless.baseUrl "https://api.featherless.ai/v1"
openclaw config set models.providers.featherless.api "openai-completions"
openclaw config set models.providers.featherless.apiKey '"${FEATHERLESS_API_KEY}"'
```

Then set the default model:

```bash
openclaw config set agents.defaults.model.primary "featherless/Sao10K/L3.3-70B-Euryale-v2.3"
```

And set a fallback array:

```bash
openclaw config set agents.defaults.model.fallbacks '["featherless/deepseek-ai/DeepSeek-R1-Distill-Llama-70B"]' --strict-json
```

And set model aliases:

```bash
openclaw config set agents.defaults.models."featherless/Sao10K/L3.3-70B-Euryale-v2.3" '{ alias: "euryale" }'
openclaw config set agents.defaults.models."featherless/deepseek-ai/DeepSeek-R1-Distill-Llama-70B" '{ alias: "backup" }'
```

## Important note about `models.providers.featherless.models`
Because this field is an array of objects, it is usually easiest to set it in one shot with strict JSON:

```bash
openclaw config set models.providers.featherless.models '[
  {
    "id": "Sao10K/L3.3-70B-Euryale-v2.3",
    "name": "L3.3 70B Euryale v2.3",
    "reasoning": false,
    "input": ["text"],
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
    "contextWindow": 32768,
    "maxTokens": 8192
  },
  {
    "id": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B",
    "name": "DeepSeek R1 Distill Llama 70B",
    "reasoning": true,
    "input": ["text"],
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
    "contextWindow": 32768,
    "maxTokens": 8192
  }
]' --strict-json
```

## Then validate
Run:

```bash
openclaw config validate
openclaw models status
openclaw models list --provider featherless
```

---

## Recommended one-shot command sequence

If you want the shortest realistic CLI path, use this sequence:

```bash
openclaw config set models.mode merge
openclaw config set models.providers.featherless.baseUrl "https://api.featherless.ai/v1"
openclaw config set models.providers.featherless.api "openai-completions"
openclaw config set models.providers.featherless.apiKey '"${FEATHERLESS_API_KEY}"'
openclaw config set models.providers.featherless.models '[
  {
    "id": "Sao10K/L3.3-70B-Euryale-v2.3",
    "name": "L3.3 70B Euryale v2.3",
    "reasoning": false,
    "input": ["text"],
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
    "contextWindow": 32768,
    "maxTokens": 8192
  }
]' --strict-json
openclaw config set agents.defaults.model.primary "featherless/Sao10K/L3.3-70B-Euryale-v2.3"
openclaw config set agents.defaults.models."featherless/Sao10K/L3.3-70B-Euryale-v2.3" '{ alias: "euryale" }'
openclaw config validate
openclaw models status
openclaw models list --provider featherless
```

---

## Best practices

### 1) Keep `models.mode: "merge"`
This preserves built-in providers and appends your custom Featherless provider cleanly.

### 2) Start with one model first
Do not start with five unknown models.

Begin with one model, validate, then add a fallback.

### 3) Use conservative metadata
If you are not 100% sure of:

- `contextWindow`
- `maxTokens`
- `reasoning`

then stay conservative instead of guessing massive numbers.

### 4) Treat live provider metadata as more trustworthy than marketing copy
Featherless’s live `/v1/models` endpoint is a more reliable operational source than scraped landing-page content.

### 5) Curate for agent role
OpenClaw agents need stable behavior more than novelty.

For tool-heavy agents, prioritize:

- instruction following
- consistency
- tool-use stability
- predictable output shape

---

## Common mistakes

### Mistake: using raw model IDs without provider prefix
Wrong:

```text
Sao10K/L3.3-70B-Euryale-v2.3
```

Right:

```text
featherless/Sao10K/L3.3-70B-Euryale-v2.3
```

### Mistake: forgetting to include the model in `agents.defaults.models`
If you define an allowlist, any model not listed there may be blocked.

### Mistake: registering dozens of Featherless models
This makes the OpenClaw model UX messy and reduces operational clarity.

### Mistake: assuming every listed model is good for tool workflows
Some models may be exposed by Featherless but still be poor fits for OpenClaw agents.

### Mistake: using the wrong API mode
For Featherless, the documented best fit here is:

```json5
api: "openai-completions"
```

---

## Troubleshooting checklist

If Featherless does not work after config:

### Check 1: config validity
```bash
openclaw config validate
```

### Check 2: provider visibility
```bash
openclaw models list --provider featherless
```

### Check 3: resolved primary model
```bash
openclaw models status
```

### Check 4: general diagnosis
```bash
openclaw doctor
```

### Check 5: model allowlist issue
If replies stop and you see a “model is not allowed” style error, make sure the exact `featherless/...` ref is present in `agents.defaults.models`.

### Check 6: API key issue
Make sure `FEATHERLESS_API_KEY` is actually set in the process environment if you reference it with `${FEATHERLESS_API_KEY}`.

---

## Minimal working config

If you only want the smallest practical starting point, use this:

```json5
{
  env: {
    FEATHERLESS_API_KEY: "sk-...",
  },
  agents: {
    defaults: {
      model: {
        primary: "featherless/Sao10K/L3.3-70B-Euryale-v2.3",
      },
      models: {
        "featherless/Sao10K/L3.3-70B-Euryale-v2.3": {
          alias: "euryale",
        },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      featherless: {
        baseUrl: "https://api.featherless.ai/v1",
        apiKey: "${FEATHERLESS_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "Sao10K/L3.3-70B-Euryale-v2.3",
            name: "L3.3 70B Euryale v2.3",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 32768,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

---

## Practical recommendation

Start with:

- one Featherless model
- one alias
- no fallback yet

Validate that first.

Then add:

- one fallback model
- optional role-specific tuning later

That gives you the fastest clean path with the lowest risk.

---

## Bottom line

Featherless works best in OpenClaw when treated like a properly registered custom provider, not a loose external endpoint.

The winning pattern is:

- `models.providers.featherless`
- `baseUrl: "https://api.featherless.ai/v1"`
- `api: "openai-completions"`
- `apiKey`
- curated provider `models[]`
- `agents.defaults.model.primary`
- optional `fallbacks`
- allowlist entries under `agents.defaults.models`

That keeps the config valid, the model picker sane, and agent behavior easier to reason about.
