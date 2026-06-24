---
name: kimi-secret-bridge
description: 为 Kimi Code 项目建立本地 secret bridge，避免用户把 API key、token、private key 等敏感凭证粘贴进对话；通过本地 env 文件、wrapper 脚本和 hooks 安全注入子进程环境变量
type: prompt
whenToUse: 当任务需要 API key、access token、private key、cookie、session token、云服务凭证、GitHub token、OpenAI/Anthropic/HuggingFace token，或用户试图在对话中粘贴 secret 时
disableModelInvocation: false
---

# Kimi Secret Bridge

## Purpose

When a task requires API keys, tokens, or other secrets, this skill sets up a local secret bridge so that:

- Secrets live in a local `.env` file, never in the conversation
- The agent runs commands through a wrapper that injects secrets as environment variables
- Hooks intercept accidental secret pastes and agent attempts to read secret files
- Secrets never appear in Kimi session logs, command text, or debug exports

**Security goal**: Prevent secrets from entering the conversation, command text, session records, debug exports, and accidental tool output.

**This does NOT**: make secrets invisible to local processes. The wrapper injects them into the child process environment — that is the intended behavior.

## Hard Rules

These rules are non-negotiable:

1. **Never paste secrets into the conversation.** No API keys, tokens, private keys, cookies, or session tokens.
2. **Never read `secrets.local.env` directly.** Do not use `cat`, `Read`, `Grep`, or any other tool to read it.
3. **Never use `ENV_VAR=value command` for secrets.** The command text itself may be logged.
4. **Never print secret values.** No `echo $SECRET`, no `console.log(process.env)`, no `env`.
5. **Only inject secrets through the wrapper.** `node .kimi-code/secret-bridge/run-with-secrets.mjs -- <command>`
6. **If a secret is already in the conversation**, tell the user to rotate it immediately.

## First-Time Setup

When the project does not have `.kimi-code/secret-bridge/` yet, run this setup:

### 1. Create the bridge directory

```bash
mkdir -p .kimi-code/secret-bridge
```

### 2. Copy files from the skill directory

```bash
cp "${KIMI_SKILL_DIR}/run-with-secrets.mjs" .kimi-code/secret-bridge/
cp "${KIMI_SKILL_DIR}/block-secret-leak.mjs" .kimi-code/secret-bridge/
cp "${KIMI_SKILL_DIR}/secrets.template.env" .kimi-code/secret-bridge/
```

### 3. Create the local secrets file

```bash
cp .kimi-code/secret-bridge/secrets.template.env .kimi-code/secret-bridge/secrets.local.env
chmod 600 .kimi-code/secret-bridge/secrets.local.env
```

Then tell the user:

> Your secret file is ready at `.kimi-code/secret-bridge/secrets.local.env`.
> Open it in your editor and fill in the keys you need. Do NOT paste them here.

### 4. Update .gitignore

Check if `.gitignore` already contains the secret bridge entries. If not, append:

```bash
cat >> .gitignore << 'EOF'

# Kimi Secret Bridge
.kimi-code/secret-bridge/secrets.local.env
.kimi-code/secret-bridge/*.local.env
.kimi-code/secret-bridge/*.local.md
EOF
```

### 5. Suggest hooks configuration

Tell the user to add these hooks to their `~/.kimi-code/config.toml` (or project-level config), then run `/reload`:

```toml
[[hooks]]
event = "UserPromptSubmit"
command = "node .kimi-code/secret-bridge/block-secret-leak.mjs user-prompt"
timeout = 5

[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node .kimi-code/secret-bridge/block-secret-leak.mjs pre-tool-use"
timeout = 5
```

Also mention:

> These hooks are project-level. In projects without secret-bridge setup, they will fail-open (no block).
> Hooks prevent accidental leaks but are not a security sandbox — they are best-effort guardrails.

## Using the Bridge

Once setup is complete, when a task needs a secret:

### 1. Identify the required variable

Tell the user which variable is needed (name only, never the value):

> This task requires `OPENAI_API_KEY`.

### 2. Check if it's filled

```bash
node .kimi-code/secret-bridge/run-with-secrets.mjs --check OPENAI_API_KEY
```

This reports the status without printing secret values:
- `OK: OPENAI_API_KEY` — key is set
- `Missing: OPENAI_API_KEY` — key is empty or not set

If missing, tell the user:

> `OPENAI_API_KEY` is not set in `.kimi-code/secret-bridge/secrets.local.env`.
> Please fill it in, then tell me to proceed.

### 3. Run through the wrapper

```bash
node .kimi-code/secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- <your command>
```

Multiple required keys:

```bash
node .kimi-code/secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- <your command>
```

No specific requirement (load all filled keys):

```bash
node .kimi-code/secret-bridge/run-with-secrets.mjs -- <your command>
```

## Wrapper Reference

`run-with-secrets.mjs` lives at `.kimi-code/secret-bridge/run-with-secrets.mjs` in the project.

| Usage | Description |
|-------|-------------|
| `--check KEY` | Check if KEY is filled. Prints `OK: KEY` or `Missing: KEY`. No child process. |
| `--require KEY` | Validate that KEY exists and is non-empty before running the command. Multiple `--require` or comma-separated. |
| `-- <command>` | Everything after `--` is the command to run. |
| No `--require` | Load all filled keys from `secrets.local.env`, no validation. |

Behavior:
- Reads `.kimi-code/secret-bridge/secrets.local.env`
- Parses `KEY=VALUE` (skips `#` comments, empty lines, empty values)
- Merges into the child process environment
- Never prints secret values
- Missing required keys: prints `Missing: KEY` (name only), exits 1
- File not found: prints error with setup instructions, exits 1

## Hook Reference

`block-secret-leak.mjs` is a Kimi Code hook script with two modes:

### user-prompt mode (UserPromptSubmit)

Reads the user's input from stdin (JSON). Blocks if it detects high-confidence token prefixes:

- `sk-`, `sk-proj-`, `sk-svcacct-` (OpenAI)
- `ghp_`, `github_pat_` (GitHub)
- `hf_` (HuggingFace)
- `xoxb-`, `xoxp-` (Slack)
- `AKIA` (AWS)
- `AIza` (Google)
- `-----BEGIN PRIVATE KEY-----`
- `Bearer eyJ...` (JWT)

### pre-tool-use mode (PreToolUse Bash)

Reads the Bash command from stdin (JSON). Blocks:

- Reading `secrets.local.env` (cat, less, head, tail, grep, etc.)
- Dumping all env vars (`env`, `printenv`, piped variants)
- Printing specific secrets (`echo $OPENAI_API_KEY`, `printenv KEY`)
- Script-based env dump (`process.env`, `os.environ`)
- Known token prefixes appearing directly in command text
- `ENV=value command` where ENV is a sensitive name and value is a known token

Allowed normal operations (not blocked because they don't match any detection rule):

- `test -f secrets.local.env` (existence check)
- `cp secrets.template.env secrets.local.env` (setup)
- `touch secrets.local.env`, `chmod 600 secrets.local.env` (setup)
- `ls .kimi-code/secret-bridge` (directory listing)
- Safe wrapper usage, such as `--check` or normal commands that don't dump env

Does NOT block:

- `/usr/bin/env node ...`
- `NODE_ENV=production npm run build`
- `env PATH=... command`

## Security Model

- **Hooks are fail-open.** If the hook script errors or times out, Kimi Code allows the action by default. Hooks prevent accidents, not determined exfiltration.
- **This is not a sandbox.** A sufficiently creative agent could bypass hooks with unusual command patterns. The skill reduces risk, it does not eliminate it.
- **Secrets enter the child process env.** The target command can read `process.env.OPENAI_API_KEY` — that is expected, not a vulnerability.
- **Session persistence.** Kimi stores session data in `~/.kimi-code/sessions/` including `wire.jsonl` event streams. This skill prevents secrets from entering those logs, but if a secret was already shared before setup, it may be in existing session data.
- **Debug exports.** Kimi debug zips and markdown exports may contain conversation history, command output, and file paths. This skill prevents secrets from appearing in those artifacts going forward.
