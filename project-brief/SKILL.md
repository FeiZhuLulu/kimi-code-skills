---
name: project-brief
description: Build a task-focused project brief for a specific feature, module, bug, or directory. A lightweight complement to /init — not a full project initialization.
type: prompt
disableModelInvocation: false
whenToUse: When the user wants to understand a specific module, prepare to modify a feature, enter unfamiliar code territory, or needs a quick task-level architecture overview. Triggered by "project brief", "模块概览", "这个模块怎么工作的", "帮我看看这个目录", "brief on auth", or similar.
---

# Project Brief — Task-Focused Code Navigation

## Purpose

Generate a **task-focused** project brief for a specific module, feature, bug, or directory. This is a lightweight complement to `/init`:

| | `/init` | `project-brief` |
|---|---------|-----------------|
| Scope | Whole project | Specific module / feature / directory |
| Output | `AGENTS.md` (persistent) | In-conversation brief (temporary) |
| Purpose | Help AI understand project conventions | Help you navigate unfamiliar code for a task |
| When | First time onboarding a project | Before modifying a specific area |

This skill does **not** generate `AGENTS.md` or any persistent files. It produces a focused, in-conversation brief that helps you understand the code around your current task.

## Kimi Code Usage

Manual invocation:

```
/skill:project-brief
/skill:project-brief auth
/skill:project-brief src/api/routes.ts
```

This skill may be automatically invoked when the user asks to understand a module or navigate unfamiliar code.

## Kimi Code Behavior

This skill is **read-only**.

- Do not edit, create, delete, format, or initialize files.
- Do not run `/init`.
- Do not generate or modify `AGENTS.md`.

## Input

The user provides a **target** — one of:

- A module or package name: `auth`, `user-service`, `payment`
- A file path: `src/api/routes.ts`
- A feature name: `login flow`, `search functionality`
- A bug or error reference: `the null pointer in user.ts`
- A directory: `src/components/`
- A concept: `how caching works`

If the user doesn't specify a target, ask them what they want to understand.

## Workflow

### 1. Identify the Target

Parse the user's input to determine:

- **What**: module name, file, feature, or concept
- **Scope**: narrow (single file) or broad (entire module)

### 2. Locate Relevant Files

Prefer tracked files first to avoid scanning generated/vendor directories:

```bash
git ls-files | grep -i '<target>'
```

If the project is not a git repo, fall back to `Glob`:

```
Glob pattern: **/*{target}*
```

Exclude common generated/vendor directories from results:

- `node_modules/`, `dist/`, `build/`, `coverage/`, `.next/`, `.turbo/`
- `vendor/`, `target/`, `.git/`, `.kimi-code/secret-bridge/`

Also check for:

- Test files: `**/*{target}*.test.*`, `**/*{target}*.spec.*`
- Config references: `Grep` for `{target}` in config files (`*.json`, `*.toml`, `*.yaml`)
- Documentation: `**/*{target}*.md`

If the first search returns more than 50 files, stop broad reading and narrow by:
1. Exact directory
2. Import graph
3. Exported symbol
4. Nearest tests
5. User-confirmed subtarget

### 3. Read Key Files

For each relevant file found, read enough to understand its role:

- Entry points: read the full file (or first 100 lines)
- Types/interfaces: read the full file
- Utilities: read exports and function signatures
- Tests: read test names and structure (don't read every assertion)
- Config: read the relevant section

Use `Read` with line limits for large files.

### 4. Trace Dependencies

Find what the target depends on and what depends on it:

**Inbound** (who uses this module):

```
Grep pattern: (import|from|require).*/{target}
```

**Outbound** (what does this module use):

```
Grep pattern: (import|from|require) inside the target files
```

### 5. Generate the Brief

```markdown
## Project Brief: <target>

### What It Does

<1-2 sentence description of the module's purpose>

### Key Files

| File | Role | Lines |
|------|------|-------|
| `src/auth/index.ts` | Entry point, exports public API | 45 |
| `src/auth/service.ts` | Core auth logic | 180 |
| `src/auth/types.ts` | Type definitions | 30 |
| `src/auth/__tests__/service.test.ts` | Unit tests | 120 |

### Entry Points

- `src/auth/index.ts` — public API surface
- `src/auth/middleware.ts` — Express/Koa middleware (if applicable)

### How It Works

<brief description of the main flow — what happens when this module is invoked>

### Dependencies

**Uses** (imports from):
- `src/config/` — reads auth configuration
- `src/db/` — database access for user records
- `jsonwebtoken` — JWT token handling

**Used by** (imported by):
- `src/api/routes.ts` — mounts auth routes
- `src/middleware/` — auth middleware

### Tests

| Test file | Covers |
|-----------|--------|
| `src/auth/__tests__/service.test.ts` | Token generation, validation, expiry |
| `src/auth/__tests__/middleware.test.ts` | Auth middleware request flow |

Run tests: `pnpm test -- auth` (or the project's test command)

### Modification Risks

- Changing `src/auth/service.ts` token logic may break all authenticated routes
- `src/auth/types.ts` changes may cascade to `src/api/` and `src/middleware/`
- Config changes in `src/config/auth.ts` affect all environments

### Recommended Reading Order

1. `src/auth/types.ts` — understand the data structures
2. `src/auth/index.ts` — see the public API
3. `src/auth/service.ts` — core implementation
4. `src/auth/__tests__/service.test.ts` — understand expected behavior
5. `src/api/routes.ts` — see how auth is used in the API layer

### Kimi Context Notes

- Relevant project instructions found in `AGENTS.md` / `.kimi-code/AGENTS.md`: <summary or "not checked">
- Relevant project-level skills under `.kimi-code/skills/` or `.agents/skills/`: <summary or "none found">
- This brief is temporary and should not be written to AGENTS.md unless the user explicitly asks.
```

## Rules

- **Stay focused on the target.** Don't scan the entire project. Only look at files related to the specified module/feature/directory.
- **This skill is read-only.** Do not edit, create, or delete files. Do not run `/init`. Do not generate or modify `AGENTS.md`.
- **Don't read every file.** Read enough to understand the structure and relationships. Focus on entry points, types, and key logic.
- **Be honest about limits.** If a file is too large to read fully, say so. If you can't determine the purpose of a module, say so.
- **Show modification risks.** The most valuable part of this brief is telling the user what might break if they change things.
- **Suggest a reading order.** Help the user (and future agent sessions) understand where to start.
- **Output language matches user input.** File names and code stay in their original language.

## Kimi Code Safety

- Kimi Code may persist prompts, tool outputs, Bash commands, subagent results, and debug artifacts in local session data (`~/.kimi-code/sessions/`). Do not print or summarize secrets.
- If a task needs API keys, access tokens, private keys, cookies, cloud credentials, or session tokens, use `/skill:kimi-secret-bridge`.
- Do not ask the user to paste secrets into the conversation.
- For broad read-only code exploration, prefer the `explore` subagent; for implementation planning without shell, prefer `plan`; for actual edits, use `coder` only when the user wants changes made.
