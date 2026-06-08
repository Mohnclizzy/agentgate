# AgentGate

Control which MCP tools an agent can call.

AgentGate wraps a local stdio MCP server and checks every tool call before it reaches the server. It can hide denied tools, block risky calls, ask for approval, redact secrets from tool results, and write JSONL audit logs.

## How It Works

Most local MCP servers speak JSON-RPC over stdin/stdout. AgentGate starts the real server as a child process, forwards messages between the client and server, and applies policy around `tools/list` and `tools/call`.

## Install

```bash
npm install
npm run build
```

## Run The Demo

Start AgentGate around the demo MCP server:

```bash
npm run agentgate -- wrap --config agentgate.example.yml -- node examples/demo-mcp-server.mjs
```

Then send MCP JSON-RPC messages on stdin. For a quick smoke test:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_secret","arguments":{"path":".env"}}}\n' | npm run agentgate -- wrap --config agentgate.example.yml -- node examples/demo-mcp-server.mjs
```

You should see:

- `read_secret` is removed from `tools/list`.
- `tools/call` for `read_secret` returns an AgentGate blocked tool result.
- `.agentgate/audit.jsonl` records the decision.

## Real Filesystem Smoke Test

This runs AgentGate against the official filesystem MCP server from npm. It creates a temporary directory with `notes.txt` and `.env`, confirms the safe read works, and confirms the `.env` read is blocked.

```bash
npm run build
npm run smoke:filesystem
```

The script uses `npx -y @modelcontextprotocol/server-filesystem`.

## Config

```yaml
policy:
  defaultAction: allow
  tools:
    deny:
      - read_secret
    approve:
      - shell
  riskPatterns:
    - action: deny
      pattern: "(?:^|[\\\\/])(?:\\.env(?:\\.[^\\\\/]*)?|id_rsa|id_ed25519|[^\\\\/]+\\.(?:pem|key))"
      reason: "Access to env and private-key files is blocked"

audit:
  path: .agentgate/audit.jsonl

approval:
  mode: prompt
```

Approval modes:

- `prompt`: ask in the terminal.
- `deny`: reject approval-required calls without prompting.
- `allow`: approve approval-required calls without prompting.

## CLI

```bash
agentgate wrap --config agentgate.yml -- <mcp-server-command> [args...]
```

Examples:

```bash
agentgate wrap -- npx -y @modelcontextprotocol/server-filesystem .
agentgate wrap --config agentgate.yml -- node ./server.mjs
```

## Current Scope

- Supports stdio MCP servers only.
- Streamable HTTP is not implemented yet.
- Terminal approval is a simple yes/no prompt.
- Audit logs are local JSONL.
- Policies are deterministic. No LLM classifier is used.
