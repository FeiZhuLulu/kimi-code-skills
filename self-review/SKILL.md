---
name: self-review
description: Review local git changes before commit, focusing on unintended edits, missing tests, bugs, and risky agent-generated changes.
type: prompt
disableModelInvocation: false
whenToUse: When the user wants to check their changes before committing, says "review", "self-review", "自审", "检查改动", "review diff", or wants to confirm that agent modifications are safe.
---

# Self Review — Pre-commit Change Review

## Purpose

Review your local git changes before committing. This skill focuses on catching unintended edits, missing tests, debug leftovers, and risky changes — especially those introduced by AI agents during a coding session.

This is **not** a full PR review or security audit. It is a quick, structured sanity check before you commit.

## Kimi Code Usage

Manual invocation:

```
/skill:self-review
```

This skill may be automatically invoked when the user asks to review their changes before committing.

## Workflow

### 1. Gather Changes

```bash
git status --short
git diff --stat
git diff --cached --stat
```

If there are both staged and unstaged changes, review staged changes for `Commit Readiness`. Report unstaged changes separately under `Working Tree Notes`.

If nothing is staged, report: `Not ready — nothing staged` unless the user explicitly asked to review unstaged work.

### 1.1 Determine Task Intent

Infer the intended task from the current Kimi conversation and recent user instructions.

- If the task goal is known, classify files against that goal.
- If the task goal is unknown, use `unclear` instead of pretending a file is intended or unrelated.
- Only label a file `unrelated` when there is clear evidence: logs, generated artifacts, unrelated config, lockfiles, secret files, or files outside the stated task area.

### 2. Classify Each Changed File

Read the full diff:

```bash
git diff --cached   # staged changes
git diff            # unstaged changes
```

For each changed file, classify it:

| Category | Meaning |
|----------|---------|
| **intended** | Clearly matches the stated user task |
| **suspicious** | Risky, surprising, or possibly accidental |
| **unrelated** | Clearly outside the stated task |
| **unclear** | Cannot determine intent from available context |

If a file is unrelated, flag it immediately — it may have been accidentally modified.

### 3. Check for Common Problems

Go through this checklist against the diff:

#### 3.1 Debug Leftovers

- `console.log` / `console.debug` / `console.warn` (in production code)
- `print()` statements that aren't part of the feature
- `debugger` statements
- `TODO` / `FIXME` / `HACK` comments added in this diff
- Commented-out code blocks

Use `Grep` to scan for these patterns in the changed files.

#### 3.2 Agent-Introduced Mistakes

These are specific to AI-assisted coding sessions:

- **Over-broad changes**: files modified that have nothing to do with the task
- **Logic removal**: code deleted without a replacement (check if `git diff` shows more `-` lines than `+` lines in a function)
- **Type bypasses**: `as any`, `as unknown as`, `@ts-ignore`, `# type: ignore`, `// eslint-disable`
- **Hardcoded values**: magic numbers, hardcoded URLs, test credentials, localhost references
- **Swallowed errors**: empty `catch {}`, `except: pass`, `catch (e) {}` without logging
- **Silent failures**: functions that return `null`/`undefined` on error instead of throwing

#### 3.3 Missing Tests

- If the diff adds or modifies a function/method, check if corresponding test files exist
- If the diff fixes a bug, check if there's a regression test
- Use `Glob` to look for test files near the changed source files

#### 3.4 Config and Lockfile Changes

- `package.json` / `pnpm-lock.yaml` / `yarn.lock` / `Cargo.lock` / `go.sum` changed unexpectedly
- `.env` or environment files modified (may contain secrets)
- Build config changed without clear reason

#### 3.5 Public API Changes

- Exported functions/types added, removed, or renamed
- Function signatures changed (parameters, return type)
- Config schema changed

#### 3.6 Secret Detection

- `.env`, `*.pem`, `*.key` files added or modified
- Strings matching known token prefixes in added lines
- Hardcoded credentials, API keys, or tokens

If secrets are detected: stop normal review, instruct the user to remove the secret, rotate it if exposed, and use `/skill:kimi-secret-bridge`.

### 4. Output Report

```markdown
## Commit Readiness

<Ready | Needs cleanup | Not ready>

## Change Summary (staged)

| File | Lines | Category | Notes |
|------|-------|----------|-------|
| src/auth.ts | +15 -3 | intended | Token refresh fix |
| src/utils.ts | +2 -0 | suspicious | Unrelated helper added? |
| debug.log | +50 -0 | unrelated | Debug output, should not commit |

## Working Tree Notes (unstaged)

<unstaged changes, if any, reported separately>

## Issues Found

### Critical

- <issues that must be fixed before commit>

### Warning

- <issues that should be fixed>

### Info

- <minor suggestions>

## Missing Tests

- <functions that changed but have no test coverage>

## Suggested Cleanup

- <specific cleanup actions with file:line references>

## Suggested Commit Split

If the changes should be split into multiple commits:

1. `<type>(<scope>): <subject>` — <which files>
2. `<type>(<scope>): <subject>` — <which files>

## Suggested Commit Message

<if changes are clean and ready>
```

## Severity Levels

Use text labels, not emoji:

| Level | Meaning |
|-------|---------|
| **Critical** | Will cause bugs, data loss, or security issues. Must fix before commit. |
| **Warning** | May cause issues in edge cases or degrade code quality. Should fix. |
| **Info** | Style or minor improvement suggestion. Not blocking. |

## Rules

- **Focus on the diff, not the entire codebase.** You are reviewing what changed, not doing a full audit.
- **Be specific.** Always point to the exact file, line, and code. Vague feedback is useless.
- **Be constructive.** Suggest fixes, not just problems.
- **Don't invent issues.** If the code looks fine, say so. Don't nitpick to seem thorough.
- **Flag unrelated changes early.** The most common accidental commit is including files that don't belong.
- **Agent changes deserve extra scrutiny.** AI-generated code tends to over-modify, add unnecessary type bypasses, and miss edge cases.
- **Output language matches user input language.** Code stays in its original language.

## Kimi Code Safety

- Kimi Code may persist prompts, tool outputs, Bash commands, subagent results, and debug artifacts in local session data (`~/.kimi-code/sessions/`). Do not print or summarize secrets.
- If a task needs API keys, access tokens, private keys, cookies, cloud credentials, or session tokens, use `/skill:kimi-secret-bridge`.
- Do not ask the user to paste secrets into the conversation.
- For broad read-only code exploration, prefer the `explore` subagent; for implementation planning without shell, prefer `plan`; for actual edits, use `coder` only when the user wants changes made.
