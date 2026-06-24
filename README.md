# Kimi Code Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Kimi Code](https://img.shields.io/badge/Kimi-Code-7c3aed.svg)](https://github.com/MoonshotAI/kimi-code)

A lightweight, zero-runtime skill pack for [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code). Provides 5 practical development workflow skills as pure SKILL.md files — no MCP servers, no code dependencies.

English | [中文](#简介)

## Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| **commit-craft** | Generate Conventional Commit messages from git changes | `/commit-craft` or say "commit", "提交" |
| **self-review** | Pre-commit review focusing on unintended edits and agent mistakes | `/self-review` or say "review", "自审" |
| **error-doctor** | Structured error diagnosis with hypotheses and minimal fixes | `/error-doctor` or paste an error log |
| **project-brief** | Task-focused code navigation for a specific module or feature | `/project-brief` or say "模块概览" |
| **safe-init** | Safely generate or update AGENTS.md without losing existing content | `/safe-init` or say "安全初始化" |

## Install

### As a Kimi Code Plugin (recommended)

```bash
# From GitHub
kimi /plugin install https://github.com/yourname/kimi-code-skills

# From local clone
git clone https://github.com/yourname/kimi-code-skills.git
kimi /plugin install ./kimi-code-skills
```

### Manual Install (skills only)

Copy the skill directories to your Kimi Code skills folder:

```bash
# User-level (available in all projects)
cp -r skills/* ~/.kimi-code/skills/

# Or project-level (available in this project only)
mkdir -p .kimi-code/skills
cp -r skills/* .kimi-code/skills/
```

## Usage

### commit-craft

Stage your changes, then invoke:

```
/commit-craft
```

The skill analyzes `git diff --cached`, infers commit type and scope, and generates 3 candidates (concise / standard / detailed). It does **not** execute `git commit` unless you explicitly ask.

### self-review

Before committing:

```
/self-review
```

Reviews your diff for: debug leftovers, unrelated changes, missing tests, type bypasses, swallowed errors, and other agent-introduced mistakes. Outputs a structured report with severity levels.

### error-doctor

When you hit an error:

```
/error-doctor
```

Or just paste the error. The skill diagnoses first, fixes second: extracts the key error, generates up to 3 root cause hypotheses, verifies the most likely one, then provides a minimal fix.

### project-brief

When exploring unfamiliar code:

```
/project-brief auth
```

Generates a task-focused brief for the specified module: key files, entry points, dependency graph, test coverage, modification risks, and recommended reading order. Does not generate `AGENTS.md` — that's what `/init` does.

### safe-init

When you want to update AGENTS.md without losing custom rules:

```
/safe-init
```

Checks for existing AGENTS.md, analyzes what's custom vs auto-generated, and lets you choose: merge (keep custom, update auto-generated), overwrite with backup, or cancel.

## Philosophy

- **Pure SKILL.md, zero code** — no MCP servers, no runtime dependencies, no build step
- **Diagnose before fixing** — error-doctor and self-review prioritize understanding over action
- **Generate, don't execute** — commit-craft produces messages; it commits only when asked
- **Complement, don't replace** — project-brief complements `/init`, safe-init guards `/init`
- **Conservative by default** — when in doubt, ask the user rather than assuming

## Contributing

1. Skills must be pure SKILL.md (Markdown + YAML frontmatter)
2. Skills should describe workflows, not bind to specific internal tool names
3. Follow the existing format: `name`, `description`, `type`, `whenToUse` in frontmatter
4. Test your skill with Kimi Code before submitting

### Adding a New Skill

1. Create `skills/<name>/SKILL.md` with proper YAML frontmatter
2. Add the skill path to `kimi.plugin.json` → `skills` array
3. Update this README's skill table
4. Submit a PR

## License

[MIT](LICENSE)
