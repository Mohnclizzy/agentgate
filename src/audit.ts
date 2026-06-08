import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PolicyAction } from "./policy.js";

export interface ToolDecisionAuditEvent {
  type: "tool_decision";
  sessionId: string;
  requestId: string | number | null;
  toolName: string;
  decision: PolicyAction;
  reason?: string;
}

export interface ToolResultAuditEvent {
  type: "tool_result";
  sessionId: string;
  requestId: string | number | null;
  toolName?: string;
  redacted: boolean;
}

export type AuditEvent = ToolDecisionAuditEvent | ToolResultAuditEvent;

export class AuditLogger {
  constructor(
    private readonly filePath: string,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async append(event: AuditEvent): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const line = JSON.stringify({
      timestamp: this.now(),
      ...event
    });

    await appendFile(this.filePath, `${line}\n`, "utf8");
  }
}
