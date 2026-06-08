import { describe, expect, test } from "vitest";
import { JsonLineBuffer, encodeJsonLine, isRequest, makeBlockedToolResult } from "../src/jsonrpc.js";

describe("JsonLineBuffer", () => {
  test("parses complete newline-delimited JSON messages across chunks", () => {
    const buffer = new JsonLineBuffer();

    expect(buffer.push('{"jsonrpc":"2.0",')).toEqual([]);
    expect(buffer.push('"id":1,"method":"ping"}\n\n{"jsonrpc":"2.0","id":2')).toEqual([
      { jsonrpc: "2.0", id: 1, method: "ping" }
    ]);
    expect(buffer.push(',"method":"tools/list"}\n')).toEqual([
      { jsonrpc: "2.0", id: 2, method: "tools/list" }
    ]);
  });

  test("encodes a message with a trailing newline", () => {
    expect(encodeJsonLine({ jsonrpc: "2.0", id: 1, result: {} })).toBe(
      '{"jsonrpc":"2.0","id":1,"result":{}}\n'
    );
  });
});

describe("JSON-RPC helpers", () => {
  test("detects requests and builds blocked tool results", () => {
    expect(isRequest({ jsonrpc: "2.0", id: "a", method: "tools/call" })).toBe(true);
    expect(isRequest({ jsonrpc: "2.0", id: "a", result: {} })).toBe(false);

    expect(makeBlockedToolResult(7, "Blocked by policy")).toEqual({
      jsonrpc: "2.0",
      id: 7,
      result: {
        content: [
          {
            type: "text",
            text: "AgentGate blocked this tool call: Blocked by policy"
          }
        ],
        isError: true
      }
    });
  });
});
