export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

export class JsonLineBuffer {
  private pending = "";

  push(chunk: string): JsonRpcMessage[] {
    this.pending += chunk;
    const lines = this.pending.split(/\r?\n/);
    this.pending = lines.pop() ?? "";

    return lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as JsonRpcMessage);
  }
}

export function encodeJsonLine(message: JsonRpcMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function isRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return (
    isRecord(message) &&
    message.jsonrpc === "2.0" &&
    typeof message.method === "string" &&
    Object.prototype.hasOwnProperty.call(message, "id")
  );
}

export function isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
  return (
    isRecord(message) &&
    message.jsonrpc === "2.0" &&
    Object.prototype.hasOwnProperty.call(message, "id") &&
    (Object.prototype.hasOwnProperty.call(message, "result") ||
      Object.prototype.hasOwnProperty.call(message, "error"))
  );
}

export function makeBlockedToolResult(id: JsonRpcId | undefined, reason: string): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result: {
      content: [
        {
          type: "text",
          text: `AgentGate blocked this tool call: ${reason}`
        }
      ],
      isError: true
    }
  };
}

export function makeProtocolError(id: JsonRpcId | undefined, message: string): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code: -32602,
      message
    }
  };
}

export function getIdKey(id: JsonRpcId | undefined): string {
  return JSON.stringify(id ?? null);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
