---
name: commit-craft
description: Generate Conventional Commit messages from staged or unstaged git changes, with type and scope inference.
type: prompt
disableModelInvocation: false
arguments:
  - mode
whenToUse: When the user asks to generate a commit message, prepare a commit, says "commit", "提交", "提交信息", or wants to organize their changes into a well-formatted message before committing.
---

# Commit Craft — Conventional Commit Message Generator

## Purpose

Analyze git changes and generate well-structured [Conventional Commit](https://www.conventionalcommits.org/v1.0.0/) messages. This skill **generates messages only** — it does not execute `git commit` unless the user explicitly asks you to commit.

## Kimi Code Usage

Manual invocation:

```
/skill:commit-craft
/skill:commit-craft staged only
/skill:commit-craft unstaged diff
/skill:commit-craft split
```

**Requested mode**: `$mode`

Supported modes:
- `staged only` — only analyze staged changes
- `unstaged diff` — analyze unstaged changes
- `split` — suggest splitting into multiple commits
- (empty) — default behavior: prefer staged, fall back to unstaged

This skill may be automatically invoked when the user asks for a commit message, but it must not run `git commit` unless the user explicitly asks to create the commit now.

## Workflow

### 1. Check Repository State

```bash
git status --short
git rev-parse --is-inside-work-tree 2>/dev/null
```

If not inside a git repo, stop and tell the user.

### 2. Get the Diff

**Preferred**: staged changes (what will be committed):

```bash
git diff --cached --stat
git diff --cached
```

**If staging area is empty**, check unstaged changes:

```bash
git diff --stat
git diff
```

If both are empty, check for untracked files:

```bash
git ls-files --others --exclude-standard
```

If nothing at all, tell the user there's nothing to commit.

**If there are unstaged changes but nothing staged**:

- Show the user what changed
- Tell them: "These changes are not staged yet. Run `git add` first, or tell me to proceed with the unstaged diff."
- Do not assume they want to stage everything

### 2.1 Secret Safety Check

Before generating any commit message, scan the diff for secrets:

- `.env` files, `*.pem`, `*.key` files being added or modified
- Strings matching known token prefixes: `sk-`, `ghp_`, `hf_`, `AKIA`, `AIza`, `xoxb-`, `Bearer eyJ...`
- Strings matching `*_KEY=`, `*_TOKEN=`, `*_SECRET=`, `*_PASSWORD=` with non-empty values
- Private key blocks (`-----BEGIN PRIVATE KEY-----`)

If secrets are detected in the diff:

1. **Stop** normal commit-message generation.
2. Tell the user: "The diff contains what looks like a secret. Remove it from the diff before committing."
3. If the secret was already exposed, tell the user to rotate it.
4. Suggest using `/skill:kimi-secret-bridge` for secure credential handling.
5. Do not include any secret values in the generated commit message.

### 3. Infer Commit Type

Analyze the diff content and changed file paths to determine the commit type.

| Type | When | File path hints | Diff hints |
|------|------|-----------------|------------|
| `feat` | New user-facing functionality | new files in `src/`, `lib/`, `app/` | new exports, new components, new routes |
| `fix` | Bug fix | any source file | error handling, condition fix, null check |
| `refactor` | Code restructure, no behavior change | any source file | rename, move, extract, simplify |
| `perf` | Performance improvement | any source file | caching, lazy loading, algorithm change |
| `docs` | Documentation only | `*.md`, `docs/`, `README` | prose changes, no code logic |
| `test` | Test-only changes | `*.test.*`, `*.spec.*`, `__tests__/` | test cases, assertions |
| `build` | Build system changes | `webpack`, `vite`, `tsconfig`, `Makefile` | build config |
| `ci` | CI/CD changes | `.github/workflows/`, `Jenkinsfile` | pipeline config |
| `style` | Formatting, no logic change | any source file | whitespace, semicolons |
| `chore` | Maintenance | `package.json`, lockfile, config files | dependency bumps, tooling |

**Priority when multiple types apply**: `feat` > `fix` > `perf` > `refactor` > `test` > `docs` > `style` > `ci` > `build` > `chore`

Exception: changes exclusively in test files use `test`. Changes exclusively in docs use `docs`.

### 4. Infer Scope

Scope is optional but recommended. Infer conservatively from changed file paths.

**Monorepo patterns**:

```
packages/agent-core/*  → agent-core
apps/kimi-code/*       → cli
plugins/official/*     → plugin
```

**Single-package patterns**:

```
src/api/*       → api
src/components/* → components
src/utils/*     → utils
```

**Rules**:

- If all changes are in one logical area, use that as scope
- If changes span multiple unrelated areas, omit scope entirely
- If unsure, omit scope — a wrong scope is worse than no scope
- Scope: lowercase, kebab-case, max 2 words

### 5. Detect Breaking Changes

Look for evidence of breaking changes:

- Removed or renamed public exports
- Changed function signatures (parameters, return type)
- Changed config schema without migration
- Removed CLI commands or flags
- Changed API response format

Breaking changes require clear evidence. Do not guess. If detected, add `BREAKING CHANGE: <description>` in the footer.

### 6. Generate Candidates

Generate **2–3 candidates**:

**Candidate A — Concise** (always include):

```
<type>(<scope>): <subject>
```

- Imperative mood, lowercase, no period, max 50 chars
- Example: `fix(auth): handle expired refresh tokens`

**Candidate B — Standard** (include when explanation helps):

```
<type>(<scope>): <subject>

<what changed and why, wrapped at 72 chars>
```

- Example:
```
fix(auth): handle expired refresh tokens

The refresh token expiry was not checked before attempting renewal,
causing silent 401 errors for users with long sessions.
```

**Candidate C — Detailed** (include only when there is meaningful footer content):

```
<type>(<scope>): <subject>

<body>

BREAKING CHANGE: <description>
```

- Only include when there's a breaking change, issue reference, or other meaningful footer

### 7. Present to User

Show the candidates with a recommendation:

```
Recommended: Candidate A — concise and clear for this change

Alternatives:
1. fix(auth): handle expired refresh tokens
2. fix(auth): handle expired refresh tokens
   [body]

Reason:
- Most changes are under src/auth/
- This fixes a runtime failure, not a new feature
- No public API or breaking change detected

To commit with this message:
git commit -m "fix(auth): handle expired refresh tokens"
```

**Do not execute `git commit`** unless the user explicitly says "commit", "提交", "帮我提交", or similar.

If the user asks you to commit, execute:

```bash
# Single-line message
git commit -m "<chosen message>"

# Multi-line message
git commit -m "<subject>" -m "<body>

<footer>"
```

Confirm the result:

```
Committed abc1234: fix(auth): handle expired refresh tokens
```

## Rules

- **Default: generate only, do not commit.** Only execute `git commit` when the user explicitly requests it.
- **Prefer staged diff.** If nothing is staged, analyze unstaged diff but warn the user.
- **One logical change per commit.** If the diff covers multiple unrelated topics, suggest splitting into separate commits.
- **Inspect the actual diff, not only filenames.** Do not claim behavior that is not visible in the diff.
- **Do not exaggerate.** The commit message must not claim more than the diff actually did.
- **Use neutral placeholders.** For sensitive examples in the message body, use `example.com`, `YOUR_API_KEY`, not real values.
- **Breaking change needs evidence.** Do not add `BREAKING CHANGE` without clear proof from the diff.
- **Scope is conservative.** When in doubt, omit scope.
- **No unrelated changes.** If `git diff --cached` includes files that don't belong together, flag it.
- **Language.** Commit messages are always in English. If the user insists on another language, respect their choice.

## Kimi Code Safety

- Kimi Code may persist prompts, tool outputs, Bash commands, subagent results, and debug artifacts in local session data (`~/.kimi-code/sessions/`). Do not print or summarize secrets.
- If the diff contains secrets (API keys, tokens, private keys, credentials), stop and direct the user to `/skill:kimi-secret-bridge`.
- Do not include secret values, internal hostnames, account IDs, or real service identifiers in the commit message body or footer.

## Type Quick Reference

```
feat      New user-facing capability
fix       Bug fix
refactor  Internal restructure, no behavior change
perf      Performance improvement
docs      Documentation
test      Tests
build     Build system, dependencies, bundling
ci        CI/CD pipeline
chore     Maintenance tasks
style     Formatting, no logic change
```
