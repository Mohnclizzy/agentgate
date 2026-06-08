# AgentGate MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI that wraps a local stdio MCP server, enforces policy before `tools/call`, redacts tool results, and writes audit logs.

**Architecture:** AgentGate runs as a transparent JSON-RPC line proxy between an MCP client and a child MCP server. Core logic is framework-neutral: policy evaluation, redaction, approval, audit logging, and transport forwarding are separate modules.

**Tech Stack:** Node.js 24, TypeScript, Vitest, Commander, YAML.

---

### Task 1: Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`

- [ ] Add package scripts for `test`, `build`, and `agentgate`.
- [ ] Configure TypeScript for ESM output.
- [ ] Verify `npm test` can run Vitest.

### Task 2: Core Policy, Redaction, Audit

**Files:**
- Create: `src/policy.ts`
- Create: `src/redaction.ts`
- Create: `src/audit.ts`
- Test: `tests/policy.test.ts`
- Test: `tests/redaction.test.ts`
- Test: `tests/audit.test.ts`

- [ ] Write failing tests for allow/deny/approval policy decisions.
- [ ] Write failing tests for secret redaction in strings and nested JSON.
- [ ] Write failing tests for JSONL audit append format.
- [ ] Implement minimal core modules until tests pass.

### Task 3: MCP Proxy

**Files:**
- Create: `src/jsonrpc.ts`
- Create: `src/proxy.ts`
- Test: `tests/jsonrpc.test.ts`
- Test: `tests/proxy.test.ts`

- [ ] Write failing tests for newline-delimited JSON-RPC parsing/encoding.
- [ ] Write failing tests for blocking denied `tools/call` requests.
- [ ] Write failing tests for forwarding allowed requests and redacting responses.
- [ ] Implement minimal proxy logic until tests pass.

### Task 4: CLI And Demo

**Files:**
- Create: `src/cli.ts`
- Create: `agentgate.example.yml`
- Create: `examples/unsafe-mcp-server.mjs`
- Create: `README.md`

- [ ] Implement `agentgate wrap --config agentgate.yml -- <command>`.
- [ ] Add a demo server with safe, secret-reading, and shell-like tools.
- [ ] Document install, config, demo, and limitations.
- [ ] Run `npm test`, `npm run build`, and a smoke demo.

### Self-Review

- Scope is intentionally limited to stdio MCP because local agent tools commonly use it and the official TypeScript SDK documents it as the simplest local transport.
- Streamable HTTP, enterprise dashboard, OAuth, centralized policy, and hosted tracing are out of scope for the MVP.
- Human approval is terminal-based for now; non-interactive deny-by-default is required in CI.
