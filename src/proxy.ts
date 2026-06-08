import type { AuditEvent } from "./audit.js";
import {
  getIdKey,
  isRecord,
  isRequest,
  isResponse,
  makeBlockedToolResult,
  makeProtocolError,
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcResponse
} from "./jsonrpc.js";
import { evaluateToolCall, type AgentGatePolicy, type PolicyDecision } from "./policy.js";
import { redactValue } from "./redaction.js";

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

export interface ApprovalRequest {
  sessionId: string;
  toolName: string;
  arguments: unknown;
  reason: string;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

export interface AgentGateProxyOptions {
  sessionId: string;
  policy: AgentGatePolicy;
  audit?: AuditSink;
  approval?: ApprovalHandler;
}

export interface ProxyResult {
  toServer: JsonRpcMessage[];
  toClient: JsonRpcMessage[];
}

interface PendingRequest {
  method: string;
  toolName?: string;
}

export class AgentGateProxy {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly audit?: AuditSink;
  private readonly approval?: ApprovalHandler;
  private readonly policy: AgentGatePolicy;
  private readonly sessionId: string;

  constructor(options: AgentGateProxyOptions) {
    this.sessionId = options.sessionId;
    this.policy = options.policy;
    this.audit = options.audit;
    this.approval = options.approval;
  }

  async handleClientMessage(message: JsonRpcMessage): Promise<ProxyResult> {
    if (!isRequest(message)) {
      return forwardToServer(message);
    }

    if (message.method === "tools/call") {
      return this.handleToolCallRequest(message);
    }

    this.pending.set(getIdKey(message.id), { method: message.method });
    return forwardToServer(message);
  }

  async handleServerMessage(message: JsonRpcMessage): Promise<ProxyResult> {
    if (!isResponse(message)) {
      return forwardToClient(message);
    }

    const key = getIdKey(message.id);
    const pending = this.pending.get(key);
    this.pending.delete(key);

    if (!pending) {
      return forwardToClient(message);
    }

    if (pending.method === "tools/list") {
      return forwardToClient(this.filterToolListResponse(message));
    }

    if (pending.method === "tools/call") {
      const redacted = redactValue(message);
      const changed = JSON.stringify(redacted) !== JSON.stringify(message);

      await this.audit?.append({
        type: "tool_result",
        sessionId: this.sessionId,
        requestId: message.id,
        toolName: pending.toolName,
        redacted: changed
      });

      return forwardToClient(redacted);
    }

    return forwardToClient(message);
  }

  private async handleToolCallRequest(message: JsonRpcRequest): Promise<ProxyResult> {
    const toolCall = extractToolCall(message);
    if (!toolCall) {
      return {
        toServer: [],
        toClient: [makeProtocolError("id" in message ? message.id : null, "Invalid tools/call params")]
      };
    }

    const decision = evaluateToolCall(this.policy, {
      toolName: toolCall.name,
      arguments: toolCall.arguments
    });

    if (decision.action === "deny") {
      await this.auditDecision(message, toolCall.name, decision);
      return {
        toServer: [],
        toClient: [makeBlockedToolResult(message.id, decision.reason)]
      };
    }

    if (decision.action === "approve") {
      const approved = await this.requestApproval(toolCall.name, toolCall.arguments, decision.reason);
      if (!approved) {
        const reason = `Approval rejected for ${toolCall.name}`;
        await this.auditDecision(message, toolCall.name, { action: "deny", reason });
        return {
          toServer: [],
          toClient: [makeBlockedToolResult(message.id, reason)]
        };
      }
    }

    await this.auditDecision(message, toolCall.name, decision);
    this.pending.set(getIdKey(message.id), { method: "tools/call", toolName: toolCall.name });
    return forwardToServer(message);
  }

  private filterToolListResponse(message: JsonRpcResponse): JsonRpcResponse {
    if (!isRecord(message.result) || !Array.isArray(message.result.tools)) {
      return message;
    }

    const tools = message.result.tools.filter((tool) => {
      if (!isRecord(tool) || typeof tool.name !== "string") {
        return true;
      }

      const decision = evaluateToolCall(this.policy, {
        toolName: tool.name,
        arguments: {}
      });
      return decision.action !== "deny";
    });

    return {
      ...message,
      result: {
        ...message.result,
        tools
      }
    };
  }

  private async auditDecision(
    message: JsonRpcMessage,
    toolName: string,
    decision: PolicyDecision
  ): Promise<void> {
    await this.audit?.append({
      type: "tool_decision",
      sessionId: this.sessionId,
      requestId: "id" in message ? message.id ?? null : null,
      toolName,
      decision: decision.action,
      reason: decision.reason
    });
  }

  private async requestApproval(
    toolName: string,
    args: unknown,
    reason: string
  ): Promise<boolean> {
    if (!this.approval) {
      return false;
    }

    return this.approval({
      sessionId: this.sessionId,
      toolName,
      arguments: args,
      reason
    });
  }
}

function extractToolCall(message: JsonRpcMessage): { name: string; arguments: unknown } | undefined {
  if (!isRequest(message) || !isRecord(message.params)) {
    return undefined;
  }

  const name = message.params.name;
  if (typeof name !== "string" || name.length === 0) {
    return undefined;
  }

  return {
    name,
    arguments: message.params.arguments ?? {}
  };
}

function forwardToServer(message: JsonRpcMessage): ProxyResult {
  return {
    toServer: [message],
    toClient: []
  };
}

function forwardToClient(message: JsonRpcMessage): ProxyResult {
  return {
    toServer: [],
    toClient: [message]
  };
}
