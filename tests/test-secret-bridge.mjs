#!/usr/bin/env node
/**
 * test-secret-bridge.mjs — Smoke tests for kimi-secret-bridge
 *
 * Run: node tests/test-secret-bridge.mjs
 *
 * Tests the wrapper (run-with-secrets.mjs) and hook (block-secret-leak.mjs)
 * scripts without modifying any project files.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BRIDGE = resolve(ROOT, "kimi-secret-bridge");
const WRAPPER = resolve(BRIDGE, "run-with-secrets.mjs");
const HOOK = resolve(BRIDGE, "block-secret-leak.mjs");
const SECRETS_FILE = resolve(BRIDGE, "secrets.local.env");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function runWrapper(args = [], opts = {}) {
  return spawnSync("node", [WRAPPER, ...args], {
    encoding: "utf-8",
    timeout: 5000,
    ...opts,
  });
}

function runHook(mode, payload) {
  return spawnSync("node", [HOOK, mode], {
    input: JSON.stringify(payload),
    encoding: "utf-8",
    timeout: 5000,
  });
}

// ── Setup ──────────────────────────────────────────────────────────

console.log("\n=== kimi-secret-bridge smoke tests ===\n");

// Create a temporary secrets file for testing
writeFileSync(SECRETS_FILE, "TEST_SECRET=abc123\nEMPTY_KEY=\n");

// ── Wrapper tests ──────────────────────────────────────────────────

console.log("--- run-with-secrets.mjs ---");

test("wrapper: no args shows usage", () => {
  const r = runWrapper([]);
  assert(r.status === 1, `expected exit 1, got ${r.status}`);
  assert(r.stderr.includes("Usage"), "expected usage message");
});

test("wrapper: missing -- shows usage", () => {
  const r = runWrapper(["--require", "KEY"]);
  assert(r.status === 1, `expected exit 1, got ${r.status}`);
});

test("wrapper: --require with present key", () => {
  const r = runWrapper([
    "--require", "TEST_SECRET",
    "--", "node", "-e", "console.log(process.env.TEST_SECRET ? 'OK' : 'BAD')",
  ]);
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
  assert(r.stdout.trim() === "OK", `expected OK, got ${r.stdout.trim()}`);
});

test("wrapper: --require with missing key", () => {
  const r = runWrapper([
    "--require", "MISSING_KEY",
    "--", "node", "-e", "console.log('should not run')",
  ]);
  assert(r.status === 1, `expected exit 1, got ${r.status}`);
  assert(r.stderr.includes("Missing"), "expected Missing message");
  assert(!r.stdout.includes("should not run"), "command should not have run");
});

test("wrapper: --require with empty key", () => {
  const r = runWrapper([
    "--require", "EMPTY_KEY",
    "--", "node", "-e", "console.log('should not run')",
  ]);
  assert(r.status === 1, `expected exit 1, got ${r.status}`);
});

test("wrapper: --check present key", () => {
  const r = runWrapper(["--check", "TEST_SECRET"]);
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
  assert(r.stdout.includes("OK: TEST_SECRET"), `expected OK, got ${r.stdout}`);
});

test("wrapper: --check missing key", () => {
  const r = runWrapper(["--check", "MISSING_KEY"]);
  assert(r.status === 1, `expected exit 1, got ${r.status}`);
  assert(r.stdout.includes("Missing: MISSING_KEY"), `expected Missing, got ${r.stdout}`);
});

test("wrapper: child process inherits secrets", () => {
  const r = runWrapper([
    "--", "node", "-e",
    "console.log(process.env.TEST_SECRET === 'abc123' ? 'INJECTED' : 'NOT_INJECTED')",
  ]);
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
  assert(r.stdout.trim() === "INJECTED", `expected INJECTED, got ${r.stdout.trim()}`);
});

test("wrapper: does not print secret values", () => {
  const r = runWrapper(["--check", "TEST_SECRET"]);
  assert(!r.stdout.includes("abc123"), "stdout should not contain secret value");
  assert(!r.stderr.includes("abc123"), "stderr should not contain secret value");
});

// ── Hook tests: user-prompt ────────────────────────────────────────

console.log("\n--- block-secret-leak.mjs (user-prompt) ---");

test("hook: user-prompt blocks sk- token", () => {
  const r = runHook("user-prompt", { prompt: "my key is sk-abcdefghijklmnopqrstuvwxyz" });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: user-prompt blocks ghp_ token", () => {
  const r = runHook("user-prompt", { prompt: "token ghp_abcdefghijklmnopqrstuvwxyz" });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: user-prompt blocks private key", () => {
  const r = runHook("user-prompt", { prompt: "-----BEGIN PRIVATE KEY-----" });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: user-prompt allows clean input", () => {
  const r = runHook("user-prompt", { prompt: "hello world" });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: user-prompt allows empty input", () => {
  const r = runHook("user-prompt", {});
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

// ── Hook tests: pre-tool-use block ─────────────────────────────────

console.log("\n--- block-secret-leak.mjs (pre-tool-use block) ---");

test("hook: blocks cat secrets.local.env", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "cat .kimi-code/secret-bridge/secrets.local.env" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks bare env", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "env" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks env; ls", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "env; ls .kimi-code/secret-bridge" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks echo $OPENAI_API_KEY", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "echo $OPENAI_API_KEY" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks process.env in node", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: 'node -e "console.log(process.env)"' } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks wrapper + env sub-command", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "node .kimi-code/secret-bridge/run-with-secrets.mjs -- env" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks wrapper + process.env sub-command", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: 'node .kimi-code/secret-bridge/run-with-secrets.mjs -- node -e "console.log(process.env)"' } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks ghp_ token in command", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: 'curl -H "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz" x' } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

test("hook: blocks cat + test chain", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "cat .kimi-code/secret-bridge/secrets.local.env; test -f x" } });
  assert(r.status === 2, `expected exit 2, got ${r.status}`);
});

// ── Hook tests: pre-tool-use allow ─────────────────────────────────

console.log("\n--- block-secret-leak.mjs (pre-tool-use allow) ---");

test("hook: allows test -f", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "test -f .kimi-code/secret-bridge/secrets.local.env" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows cp template", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "cp .kimi-code/secret-bridge/secrets.template.env .kimi-code/secret-bridge/secrets.local.env" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows touch", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "touch .kimi-code/secret-bridge/secrets.local.env" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows chmod", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "chmod 600 .kimi-code/secret-bridge/secrets.local.env" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows ls", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "ls .kimi-code/secret-bridge" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows npm run dev", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "npm run dev" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows NODE_ENV=production", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "NODE_ENV=production npm run build" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows /usr/bin/env node", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "/usr/bin/env node script.js" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows wrapper normal command", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "node .kimi-code/secret-bridge/run-with-secrets.mjs --require TEST_SECRET -- npm run dev" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

test("hook: allows wrapper --check", () => {
  const r = runHook("pre-tool-use", { tool_input: { command: "node .kimi-code/secret-bridge/run-with-secrets.mjs --check OPENAI_API_KEY" } });
  assert(r.status === 0, `expected exit 0, got ${r.status}`);
});

// ── Cleanup ────────────────────────────────────────────────────────

try { unlinkSync(SECRETS_FILE); } catch {}

// ── Summary ────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
