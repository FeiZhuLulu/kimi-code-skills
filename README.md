# Kimi Code Skills

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Kimi Code](https://img.shields.io/badge/Kimi-Code-7c3aed.svg)](https://github.com/MoonshotAI/kimi-code)

面向 [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code) 的实用技能集合。每个 skill 都是独立目录，按需复制到 skills 文件夹即可使用。

[English](#english) | 中文

## 技能列表

| 技能 | 用途 | 触发方式 |
|------|------|----------|
| [**commit-craft**](./commit-craft) | 从 git diff 生成 Conventional Commit 规范的提交信息 | `/skill:commit-craft` 或说 "提交" |
| [**self-review**](./self-review) | 提交前自审：检查 agent 误改、debug 残留、缺失测试 | `/skill:self-review` 或说 "自审" |
| [**error-doctor**](./error-doctor) | 结构化错误诊断：提取关键错误、生成假设、最小修复 | `/skill:error-doctor` 或粘贴报错 |
| [**project-brief**](./project-brief) | 任务级代码导航：针对特定模块生成架构速览 | `/skill:project-brief auth` |
| [**kimi-secret-bridge**](./kimi-secret-bridge) | 防止 API key/token 泄露进对话和会话日志 | `/skill:kimi-secret-bridge` |

前 4 个是纯 SKILL.md，零代码零依赖。`kimi-secret-bridge` 附带 wrapper 脚本和 hook 脚本。

## 安装

### 一键安装全部 skills

```bash
git clone https://github.com/FeiZhuLulu/kimi-code-skills.git
cd kimi-code-skills

# 用户级（所有项目可用）
mkdir -p ~/.kimi-code/skills
cp -r commit-craft self-review error-doctor project-brief kimi-secret-bridge ~/.kimi-code/skills/
```

### 按需安装

```bash
# 只装你想要的
cp -r commit-craft ~/.kimi-code/skills/
cp -r error-doctor ~/.kimi-code/skills/
```

### 项目级安装

```bash
# 仅当前项目可用
mkdir -p .kimi-code/skills
cp -r commit-craft self-review error-doctor project-brief kimi-secret-bridge .kimi-code/skills/
```

然后在 Kimi Code 中调用：

```
/skill:commit-craft
/skill:self-review
/skill:error-doctor
/skill:project-brief auth
/skill:kimi-secret-bridge
```

## 快速说明

### commit-craft

暂存改动后调用 `/skill:commit-craft`。分析 `git diff --cached`，推断 type 和 scope，生成 2-3 个候选（简洁/标准/详细）。**默认只生成 message，不执行 git commit**，除非你明确要求。支持参数：`/skill:commit-craft staged only`。

### self-review

提交前调用 `/skill:self-review`。检查 diff 中的 debug 残留、无关改动、缺失测试、类型绕过、吞掉的错误，以及 agent 引入的其他问题。输出结构化报告（Critical / Warning / Info）。支持参数：`/skill:self-review security focus`。

### error-doctor

遇到报错时调用 `/skill:error-doctor`，或直接粘贴错误日志。先诊断后修复：提取关键错误，生成最多 3 个根因假设，验证最可能的那个，然后给出最小修复方案。不会打印 secret 值，认证错误会转 secret-bridge。

### project-brief

探索陌生代码时调用 `/skill:project-brief <目标>`。生成任务级速览：关键文件、入口点、依赖图、测试覆盖、修改风险、推荐阅读顺序。不生成 `AGENTS.md`——那是 `/init` 做的事。**只读，不编辑任何文件。**

### kimi-secret-bridge

任务需要 API key 或 token 时调用 `/skill:kimi-secret-bridge`。建立本地 secret bridge：secret 存在 `.env` 文件里，命令通过 wrapper 执行，hook 拦截误粘贴和误读取。详见 [skill README](./kimi-secret-bridge/README.md)。

**注意**：hook 使用项目相对路径。切换到未 setup 的项目时，hook 会因脚本不存在而 fail-open（放行）。

## 测试

```bash
node tests/test-secret-bridge.mjs
```

验证 kimi-secret-bridge 的 wrapper 和 hook 脚本是否正常工作。

## 设计原则

- **独立 skill** — 每个 skill 是独立目录，不需要 plugin manifest
- **SKILL.md 优先** — 大多数 skill 是纯 Markdown，无代码依赖
- **先诊断再修复** — error-doctor 和 self-review 优先理解问题
- **只生成不执行** — commit-craft 只输出 message，提交需用户明确要求
- **互补不替代** — project-brief 补充 `/init`，不重复它
- **Kimi Code 专项适配** — 所有 skill 都包含 session 安全规则和 secret-bridge 联动

## 贡献

1. 每个 skill 是一个目录，包含 `SKILL.md`（必需）和可选的附带文件
2. frontmatter 必须包含 `name`、`description`、`type`、`whenToUse`
3. 提交前用 Kimi Code 测试你的 skill

## 许可证

[MIT](LICENSE)

---

## English

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Kimi Code](https://img.shields.io/badge/Kimi-Code-7c3aed.svg)](https://github.com/MoonshotAI/kimi-code)

A collection of independent, practical skills for [Kimi Code CLI](https://github.com/MoonshotAI/kimi-code). Each skill is a standalone directory — copy the ones you need to your skills folder and go.

### Skills

| Skill | Purpose | Trigger |
|-------|---------|---------|
| [**commit-craft**](./commit-craft) | Generate Conventional Commit messages from git changes | `/skill:commit-craft` |
| [**self-review**](./self-review) | Pre-commit review: catch debug leftovers, agent mistakes, missing tests | `/skill:self-review` |
| [**error-doctor**](./error-doctor) | Structured error diagnosis with hypotheses and minimal fixes | `/skill:error-doctor` |
| [**project-brief**](./project-brief) | Task-focused code navigation for a specific module or feature | `/skill:project-brief <target>` |
| [**kimi-secret-bridge**](./kimi-secret-bridge) | Prevent API keys/tokens from leaking into conversations and logs | `/skill:kimi-secret-bridge` |

### Quick Install

```bash
git clone https://github.com/FeiZhuLulu/kimi-code-skills.git
cd kimi-code-skills
mkdir -p ~/.kimi-code/skills
cp -r commit-craft self-review error-doctor project-brief kimi-secret-bridge ~/.kimi-code/skills/
```

Then invoke in Kimi Code: `/skill:commit-craft`, `/skill:self-review`, etc.

### Key Design Decisions

- **Pure SKILL.md first** — most skills are Markdown-only, zero code dependencies
- **Diagnose before fixing** — error-doctor and self-review prioritize understanding over action
- **Generate, don't execute** — commit-craft produces messages; commits only when explicitly asked
- **Complement, don't replace** — project-brief complements `/init`, doesn't duplicate it
- **Kimi Code adapted** — all skills include session safety rules and secret-bridge integration
- **kimi-secret-bridge** is the flagship skill — wrapper + hooks + env injection, 24/24 tests passing

### Testing

```bash
node tests/test-secret-bridge.mjs
```

[MIT](LICENSE)
