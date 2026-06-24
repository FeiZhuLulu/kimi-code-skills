---
name: error-doctor
description: Diagnose terminal errors, build failures, test failures, runtime exceptions, dependency issues, and environment problems using a structured debugging loop.
type: prompt
disableModelInvocation: false
whenToUse: When the user pastes an error log, a Bash command fails, a build or test run produces errors, or the user says "what's wrong", "报错", "build failed", "fix this error", "出错了", "怎么解决", or describes a runtime crash.
---

# Error Doctor — Structured Error Diagnosis

## Purpose

Transform a confusing error message into: the key error, root cause hypotheses, verification steps, and a minimal fix. This skill **diagnoses first, fixes second** — it does not jump to editing code before understanding the problem.

## Kimi Code Usage

Manual invocation:

```
/skill:error-doctor
```

This skill may be automatically invoked when the agent detects a failed Bash command, build error, or test failure.

## Diagnosis Workflow

### 1. Locate the Error

Identify where the error came from:

| Source | How to get it |
|--------|--------------|
| User pasted text | Read directly from the conversation |
| Recent Bash output | The last `Bash` tool execution with non-zero exit |
| Build log | Look for the build command output in the conversation |
| Test output | Look for the test command output in the conversation |

If the output is long (> 50 lines), use `Grep` to find the key error:

```
Grep pattern: (?i)(error|fatal|panic|exception|traceback|failed|FAILED)
```

If the error comes from Kimi session or debug files (`wire.jsonl`, `tasks/`, exported debug zip), treat them as sensitive local data. Do not paste or summarize credential-like content. Redact paths, tokens, and command outputs that may contain secrets.

### 2. Extract the Key Error

From the error output, identify the **primary error**. Most tools emit a mix of warnings, info, and errors. Focus on:

- The **first** error in a chain (subsequent errors are often cascading)
- Lines with `error`, `Error`, `ERROR`, `fatal`, `FATAL`, `panic`
- Lines with `Exception`, `Traceback`, `FAILED`
- The exit code

**Ignore**:

- Warnings that are not errors
- Info lines
- Decorative borders or formatting
- Stack frames from `node_modules`, vendor directories, or standard libraries (focus on your own code)

### 3. Classify the Error

Route into one of these categories:

#### Syntax / Parse

Signals: `SyntaxError`, `Unexpected token`, `Parse error`, `error: expected`

Diagnosis: Read the source file at the error line. Check for missing brackets, commas, semicolons, wrong indentation (Python), unclosed strings.

#### Type / Compile

Signals: `TypeError`, `TS2xxx`, `error[E0xxx]`, `cannot find symbol`, `undefined reference`

Diagnosis: Read the source file. Check type annotations, imports, function signatures. For missing modules, use `Glob` to check if the file exists.

#### Runtime

Signals: `Cannot read properties of undefined`, `NullPointerException`, `IndexError`, `panic: runtime error`, `SIGSEGV`

Diagnosis: Read the crash location. Trace the data flow backward. Check for null/undefined values from async calls, API responses, or user input.

#### Dependency / Package

Signals: `MODULE_NOT_FOUND`, `No module named`, `peer dep`, `ERESOLVE`, `version conflict`, `Cargo.lock is out of date`

Diagnosis: Check `package.json` / `Cargo.toml` / `go.mod`. Verify lockfile. Check if the package exists. Run version checks:

```bash
node --version    # Node.js
pnpm --version    # pnpm
rustc --version   # Rust
go version        # Go
python --version  # Python
```

#### Environment / Permission

Signals: `ENOENT`, `EACCES`, `EPERM`, `command not found`, `permission denied`

Diagnosis: Verify paths exist (`ls -la`), check permissions (`stat`), verify tool installation (`which <cmd>`).

For environment variables, **never print values**. Do not use `echo $TOKEN`, `printenv`, or bare `env` — these may expose secrets into the Kimi session log.

Use presence-only checks:

```bash
test -n "${VAR:-}" && echo "VAR is set" || echo "VAR is missing"
```

For likely secret variables (`*_KEY`, `*_TOKEN`, `*_SECRET`, `*_PASSWORD`, `AUTHORIZATION`), use `/skill:kimi-secret-bridge` and its `--check` / `--require` flow.

#### Network / Connection

Signals: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `fetch failed`, `SSL`, `CERT_`, `401`, `403`, `429`, `500`, `502`, `503`

Diagnosis: Check if the URL is reachable (`curl -I`), check DNS, check proxy settings.

For 401/403/auth errors:
- Check which variable name is required.
- Do not ask the user to paste the token.
- Do not run `env`, `printenv`, or `echo $TOKEN`.
- Use `/skill:kimi-secret-bridge` to check and inject the token.

#### Git

Signals: `fatal: not a git repository`, `CONFLICT`, `merge conflict`, `detached HEAD`

Diagnosis: `git status`, `git remote -v`, `git branch -a`.

### 4. Generate Hypotheses

For the classified error, generate **at most 3 root cause hypotheses**, ranked by likelihood.

For each hypothesis:

```
Hypothesis 1 (most likely): <description>
Evidence: <what in the error output supports this>
Verify: <command or check to confirm/deny>
```

### 5. Verify — Command Safety Classification

Before running a verification command, classify it:

| Category | Examples | Action |
|----------|----------|--------|
| Read-only | `ls`, `git status`, `cat package.json`, version checks, reading non-secret source files | Run directly |
| Local execution | `pnpm test`, `npm run build`, targeted test commands | Run with caution |
| Mutating | `rm`, `git reset`, installs/upgrades, migrations, `chmod`, deleting lockfiles, rewriting config | Ask for confirmation first |
| Secret-related | Checking env vars, tokens, credentials | Use `/skill:kimi-secret-bridge`, never print values |

Execute the verification command for the most likely hypothesis. Based on the result:

- **Confirmed**: proceed to fix
- **Denied**: try the next hypothesis
- **Inconclusive**: ask the user for more context

### 6. Provide Minimal Fix

Once the root cause is confirmed, provide:

1. **One-line summary** of what went wrong
2. **Fix** — the minimal change to resolve it
3. **Verify** — command to confirm the fix works

The fix should be minimal. Don't refactor while debugging. Don't add features. Just fix the error.

## Output Format

```markdown
## Diagnosis

**Error type**: <category>
**Key error**: <the single most important error line>
**File**: <path:line> (if applicable)

## Root Cause

<what went wrong and why>

## Hypotheses

1. **<most likely>**
   - Evidence: ...
   - Verify: `<command>`

2. **<less likely>**
   - Evidence: ...
   - Verify: `<command>`

## Fix

<minimal fix — exact code change or command>

## Verify Fix

`<command to run after fixing>`

## If This Still Fails

<next steps if the fix doesn't work>
```

## Rules

- **Diagnose before fixing.** Do not edit code until you understand the problem. Read the error, form hypotheses, verify.
- **Find the root cause, not the symptom.** A `TypeError` downstream may be caused by a missing config value upstream.
- **One hypothesis at a time.** Verify the most likely cause first. Don't shotgun-debug.
- **Minimal fix.** Don't refactor, don't optimize, don't add features while fixing an error.
- **Don't assume external tools are available.** If you need to search the web, state what you want to search for. If WebSearch or FetchURL is not available, tell the user what to search for manually.
- **Respect the error chain order.** The first error is usually the root cause. Later errors are often cascading failures.
- **Check the obvious first.** Is the file path correct? Is the package installed? Is the server running? Is the env var set?
- **Never print secret values.** Do not use `echo $VAR`, `printenv`, or `env` to check credentials. Use presence-only checks or `/skill:kimi-secret-bridge`.
- **Language.** Respond in the user's input language. Error messages and code stay in their original language.

## Kimi Code Safety

- Kimi Code may persist prompts, tool outputs, Bash commands, subagent results, and debug artifacts in local session data (`~/.kimi-code/sessions/`). Do not print or summarize secrets.
- If a task needs API keys, access tokens, private keys, cookies, cloud credentials, or session tokens, use `/skill:kimi-secret-bridge`.
- Do not ask the user to paste secrets into the conversation.

## Common Error Patterns Quick Reference

| Pattern | Likely cause | First check |
|---------|-------------|-------------|
| `Cannot find module 'X'` | Missing install or wrong path | `ls node_modules/X` |
| `ERESOLVE` / `peer dep` | Version conflict | `pnpm ls` to see the tree |
| `EADDRINUSE` | Port in use | `lsof -i :PORT` or `netstat` |
| `ECONNREFUSED` | Service not running | Check if the server process is up |
| `TS2307: Cannot find module` | Missing @types or wrong path | `Glob` for the file |
| `SyntaxError: Unexpected token` | Missing bracket/comma or wrong parser | Read the file at the error line |
| `permission denied` | File permission or ownership | `ls -la <file>` |
| `command not found` | Not installed or not in PATH | `which <cmd>` |
| Works locally, fails in CI | Environment difference | Compare Node/OS/env versions |
| `401` / `403` | Auth failure | Check variable name, use `/skill:kimi-secret-bridge` |
