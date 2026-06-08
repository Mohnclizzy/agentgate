#!/usr/bin/env node

let pending = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  pending += chunk;
  const lines = pending.split(/\r?\n/);
  pending = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    handleMessage(JSON.parse(line));
  }
});

function handleMessage(message) {
  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "initialize") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "agentgate-demo",
          version: "0.1.0"
        }
      }
    });
    return;
  }

  if (message.method === "tools/list") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        tools: [
          {
            name: "safe_echo",
            description: "Echo text back to the caller.",
            inputSchema: {
              type: "object",
              properties: {
                text: { type: "string" }
              }
            }
          },
          {
            name: "read_secret",
            description: "Returns a fake API key for redaction tests.",
            inputSchema: {
              type: "object",
              properties: {
                path: { type: "string" }
              }
            }
          },
          {
            name: "shell",
            description: "Pretends to run a shell command.",
            inputSchema: {
              type: "object",
              properties: {
                command: { type: "string" }
              }
            }
          }
        ]
      }
    });
    return;
  }

  if (message.method === "tools/call") {
    const { name, arguments: args = {} } = message.params ?? {};
    if (name === "safe_echo") {
      toolResult(message.id, `echo: ${args.text ?? ""}`);
      return;
    }

    if (name === "read_secret") {
      toolResult(
        message.id,
        `Fake secret from ${args.path ?? "unknown"}: sk-proj-abcdefghijklmnopqrstuvwxyz1234567890`
      );
      return;
    }

    if (name === "shell") {
      toolResult(message.id, `would run: ${args.command ?? ""}`);
      return;
    }

    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      }
    });
  }
}

function toolResult(id, text) {
  write({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text }]
    }
  });
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
