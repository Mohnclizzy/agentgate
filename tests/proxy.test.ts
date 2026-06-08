import { describe, expect, test } from "vitest";
import { AgentGateProxy, type AuditSink } from "../src/proxy.js";
import type { AuditEvent } from "../src/audit.js";

class MemoryAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("AgentGateProxy", () => {
  test("blocks denied tool calls before they reach the server", async () => {
    const audit = new MemoryAuditSink();
    const proxy = new AgentGateProxy({
      sessionId: "s1",
      audit,
      policy: {
        defaultAction: "allow",
        tools: {
          deny: ["read_secret"]
        }
      }
    });

    const result = await proxy.handleClientMessage({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "read_secret",
        arguments: { path: ".env" }
      }
    });

    expect(result.toServer).toEqual([]);
    expect(result.toClient).toEqual([
      {
        jsonrpc: "2.0",
        id: 11,
        result: {
          content: [
            {
              type: "text",
              text: "AgentGate blocked this tool call: Tool read_secret is denied by policy"
            }
          ],
          isError: true
        }
      }
    ]);
    expect(audit.events).toEqual([
      {
        type: "tool_decision",
        sessionId: "s1",
        requestId: 11,
        toolName: "read_secret",
        decision: "deny",
        reason: "Tool read_secret is denied by policy"
      }
    ]);
  });

  test("requires approval for risky tool calls", async () => {
    const proxy = new AgentGateProxy({
      sessionId: "s1",
      approval: async () => false,
      policy: {
        defaultAction: "allow",
        tools: {
          approve: ["shell"]
        }
      }
    });

    const result = await proxy.handleClientMessage({
      jsonrpc: "2.0",
      id: "abc",
      method: "tools/call",
      params: {
        name: "shell",
        arguments: { command: "git push origin main" }
      }
    });

    expect(result.toServer).toEqual([]);
    expect(result.toClient?.[0]).toEqual({
      jsonrpc: "2.0",
      id: "abc",
      result: {
        content: [
          {
            type: "text",
            text: "AgentGate blocked this tool call: Approval rejected for shell"
          }
        ],
        isError: true
      }
    });
  });

  test("forwards allowed tool calls and redacts matching tool results", async () => {
    const audit = new MemoryAuditSink();
    const proxy = new AgentGateProxy({
      sessionId: "s1",
      audit,
      policy: {
        defaultAction: "allow"
      }
    });
    const request = {
      jsonrpc: "2.0" as const,
      id: 12,
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: { path: "notes.txt" }
      }
    };

    expect(await proxy.handleClientMessage(request)).toEqual({
      toServer: [request],
      toClient: []
    });

    const serverResult = await proxy.handleServerMessage({
      jsonrpc: "2.0",
      id: 12,
      result: {
        content: [
          {
            type: "text",
            text: "secret is sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
          }
        ]
      }
    });

    expect(serverResult.toClient).toEqual([
      {
        jsonrpc: "2.0",
        id: 12,
        result: {
          content: [
            {
              type: "text",
              text: "secret is [REDACTED:openai-key]"
            }
          ]
        }
      }
    ]);
    expect(audit.events.at(-1)).toEqual({
      type: "tool_result",
      sessionId: "s1",
      requestId: 12,
      toolName: "read_file",
      redacted: true
    });
  });

  test("filters denied tools from tools/list responses", async () => {
    const proxy = new AgentGateProxy({
      sessionId: "s1",
      policy: {
        defaultAction: "allow",
        tools: {
          deny: ["delete_file"]
        }
      }
    });

    await proxy.handleClientMessage({
      jsonrpc: "2.0",
      id: "list-1",
      method: "tools/list"
    });

    const result = await proxy.handleServerMessage({
      jsonrpc: "2.0",
      id: "list-1",
      result: {
        tools: [
          { name: "read_file", description: "Read a file" },
          { name: "delete_file", description: "Delete a file" }
        ]
      }
    });

    expect(result.toClient).toEqual([
      {
        jsonrpc: "2.0",
        id: "list-1",
        result: {
          tools: [{ name: "read_file", description: "Read a file" }]
        }
      }
    ]);
  });
});
