import { createInterface } from "node:readline/promises";
import { stdin, stderr } from "node:process";
import type { ApprovalMode } from "./config.js";
import type { ApprovalHandler, ApprovalRequest } from "./proxy.js";

export interface CreateApprovalHandlerOptions {
  mode: ApprovalMode;
  question?: (prompt: string) => Promise<string>;
}

export function createApprovalHandler(options: CreateApprovalHandlerOptions): ApprovalHandler {
  if (options.mode === "allow") {
    return async () => true;
  }

  if (options.mode === "deny") {
    return async () => false;
  }

  return async (request) => {
    const answer = await ask(options.question, `${formatApprovalQuestion(request)}\nApprove? [y/N] `);
    return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
  };
}

export function formatApprovalQuestion(request: ApprovalRequest): string {
  return [
    "",
    "AgentGate approval required",
    `Session: ${request.sessionId}`,
    `Tool: ${request.toolName}`,
    `Reason: ${request.reason}`,
    "Arguments:",
    JSON.stringify(request.arguments, null, 2)
  ].join("\n");
}

async function ask(question: ((prompt: string) => Promise<string>) | undefined, prompt: string) {
  if (question) {
    return question(prompt);
  }

  const readline = createInterface({
    input: stdin,
    output: stderr
  });

  try {
    return await readline.question(prompt);
  } finally {
    readline.close();
  }
}
