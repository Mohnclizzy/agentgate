import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { parse } from "yaml";
import type { AgentGatePolicy, PolicyAction, RiskPattern } from "./policy.js";

export type ApprovalMode = "prompt" | "deny" | "allow";

export interface AgentGateConfig {
  policy: AgentGatePolicy;
  audit: {
    path: string;
  };
  approval: {
    mode: ApprovalMode;
  };
}

export function defaultConfig(cwd: string): AgentGateConfig {
  return {
    policy: {
      defaultAction: "allow",
      tools: {
        approve: ["shell", "run_command", "execute_command", "terminal", "bash", "powershell"]
      },
      riskPatterns: [
        {
          action: "deny",
          pattern: "(?:^|[\\\\/])(?:\\.env(?:\\.[^\\\\/]*)?|id_rsa|id_ed25519|[^\\\\/]+\\.(?:pem|key))",
          reason: "Access to env and private-key files is blocked"
        },
        {
          action: "approve",
          pattern: "\\b(rm\\s+-rf|git\\s+push|kubectl\\s+delete|terraform\\s+apply|drop\\s+table|deploy)\\b",
          reason: "Destructive or external-impact actions require approval"
        }
      ]
    },
    audit: {
      path: resolve(cwd, ".agentgate", "audit.jsonl")
    },
    approval: {
      mode: "prompt"
    }
  };
}

export async function loadAgentGateConfig(
  configPath: string | undefined,
  cwd: string
): Promise<AgentGateConfig> {
  const fallback = defaultConfig(cwd);
  if (!configPath) {
    return fallback;
  }

  const absoluteConfigPath = resolve(cwd, configPath);
  const raw = await readFile(absoluteConfigPath, "utf8");
  const parsed = parse(raw) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Config file must contain a YAML object");
  }

  const policy = isRecord(parsed.policy) ? normalizePolicy(parsed.policy) : fallback.policy;
  const audit = isRecord(parsed.audit) ? parsed.audit : {};
  const approval = isRecord(parsed.approval) ? parsed.approval : {};
  const auditPath = typeof audit.path === "string" ? audit.path : fallback.audit.path;

  return {
    policy,
    audit: {
      path: isAbsolute(auditPath) ? auditPath : resolve(cwd, auditPath)
    },
    approval: {
      mode: normalizeApprovalMode(approval.mode, fallback.approval.mode)
    }
  };
}

function normalizePolicy(value: Record<string, unknown>): AgentGatePolicy {
  const policy: AgentGatePolicy = {};

  if (isPolicyAction(value.defaultAction)) {
    policy.defaultAction = value.defaultAction;
  }

  if (isRecord(value.tools)) {
    policy.tools = {
      allow: normalizeStringArray(value.tools.allow),
      deny: normalizeStringArray(value.tools.deny),
      approve: normalizeStringArray(value.tools.approve)
    };
    if (policy.tools.allow?.length === 0) {
      delete policy.tools.allow;
    }
    if (policy.tools.deny?.length === 0) {
      delete policy.tools.deny;
    }
    if (policy.tools.approve?.length === 0) {
      delete policy.tools.approve;
    }
  }

  if (Array.isArray(value.riskPatterns)) {
    const patterns = value.riskPatterns.map(normalizeRiskPattern).filter(isRiskPattern);
    if (patterns.length > 0) {
      policy.riskPatterns = patterns;
    }
  }

  return policy;
}

function normalizeRiskPattern(value: unknown): RiskPattern | undefined {
  if (!isRecord(value) || !isPolicyAction(value.action) || typeof value.pattern !== "string") {
    return undefined;
  }

  return {
    action: value.action,
    pattern: value.pattern,
    tool: typeof value.tool === "string" ? value.tool : undefined,
    reason: typeof value.reason === "string" ? value.reason : undefined
  };
}

function isRiskPattern(value: RiskPattern | undefined): value is RiskPattern {
  return Boolean(value);
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeApprovalMode(value: unknown, fallback: ApprovalMode): ApprovalMode {
  if (value === "prompt" || value === "deny" || value === "allow") {
    return value;
  }

  return fallback;
}

function isPolicyAction(value: unknown): value is PolicyAction {
  return value === "allow" || value === "deny" || value === "approve";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
