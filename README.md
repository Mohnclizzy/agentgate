# AgentGate

Policy-as-code firewall for AI agent actions.

AgentGate wraps a local stdio MCP server and enforces policy at the tool-call boundary. It can hide denied tools, block risky calls before they reach the server, require human approval, redact secrets from tool results, and write JSONL audit logs.

## Why This Shape

Current agent frameworks are converging on tools/MCP as the action boundary. OpenAI Agents supports hosted, HTTP, and stdio MCP servers plus approval callbacks. Vercel AI SDK exposes `createMCPClient()`. LangChain/LangGraph and Mastra both treat human approval for sensitive tools as a first-class pattern.

AgentGate stays outside those frameworks and controls the common boundary instead: MCP JSON-RPC messages.

## Install

```bash
npm install
npm run build
```

## Run The Demo

Start AgentGate around the unsafe demo MCP server:

```bash
npm run agentgate -- wrap --config agentgate.example.yml -- node examples/unsafe-mcp-server.mjs
```

Then send MCP JSON-RPC messages on stdin. For a quick smoke test:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"read_secret","arguments":{"path":".env"}}}\n' | npm run agentgate -- wrap --config agentgate.example.yml -- node examples/unsafe-mcp-server.mjs
```

Expected behavior:

- `read_secret` is removed from `tools/list`.
- `tools/call` for `read_secret` returns an AgentGate blocked tool result.
- `.agentgate/audit.jsonl` records the decision.

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
      reason: "Environment and private-key files are not exposed to agents"

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

## MVP Limits

- Supports stdio MCP servers only.
- Does not implement Streamable HTTP yet.
- Terminal approval is intentionally simple.
- Audit logs are local JSONL, not centralized or signed yet.
- Policies are deterministic. No LLM classifier is used.
