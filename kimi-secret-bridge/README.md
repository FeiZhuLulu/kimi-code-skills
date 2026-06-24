# kimi-secret-bridge

A [Kimi Code](https://github.com/MoonshotAI/kimi-code) skill that helps prevent accidental leakage of API keys, tokens, and other secrets into agent conversations, session logs, and debug exports.

## What It Does

| Layer | Role |
|-------|------|
| **Skill (SKILL.md)** | Teaches the agent the secret bridge workflow |
| **Local .env file** | Stores secrets locally, never in conversation |
| **Wrapper script** | Reads `.env`, injects secrets into child process env |
| **Hook scripts** | Intercepts accidental pastes and agent read attempts |
| **.gitignore** | Prevents committing secrets to version control |

## How It Works

```
Before (insecure):
  User: "Here's my key: sk-abc123..."
  Agent: [key enters conversation, session logs, debug export]

After (with secret bridge):
  User: "I need OPENAI_API_KEY"
  Agent: "Fill it in .kimi-code/secret-bridge/secrets.local.env"
  Agent: node run-with-secrets.mjs --require OPENAI_API_KEY -- npm run dev
  [key only exists in local .env and child process env]
```

## Install

Copy this directory to your Kimi Code skills folder:

```bash
# User-level (all projects)
cp -r kimi-secret-bridge ~/.kimi-code/skills/

# Or project-level
mkdir -p .kimi-code/skills
cp -r kimi-secret-bridge .kimi-code/skills/
```

Then invoke `/skill:kimi-secret-bridge` in Kimi Code to set up the project bridge.

## What Gets Generated

After setup, your project will have:

```
.kimi-code/
└── secret-bridge/
    ├── run-with-secrets.mjs      # Wrapper script
    ├── block-secret-leak.mjs     # Hook script
    ├── secrets.template.env      # Template (committed)
    └── secrets.local.env         # Your secrets (gitignored)
```

## Usage

```bash
# Run with all filled secrets
node .kimi-code/secret-bridge/run-with-secrets.mjs -- npm run dev

# Require specific keys
node .kimi-code/secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- node scripts/generate.js

# Multiple required keys
node .kimi-code/secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- npm run sync
```

## Security Model

- **Hooks are fail-open** — script errors/timeouts allow the action by default
- **Prevents accidents, not malicious agents** — best-effort guardrails, not a sandbox
- **Secrets enter child process env** — that is the intended behavior
- **Goal**: keep secrets out of conversation, command text, session logs, and debug exports

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition for Kimi Code agent |
| `run-with-secrets.mjs` | Wrapper: reads `.env`, injects env vars, spawns command |
| `block-secret-leak.mjs` | Hook: blocks secret pastes and env dump attempts |
| `secrets.template.env` | Template for `secrets.local.env` |
