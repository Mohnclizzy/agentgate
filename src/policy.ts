export type PolicyAction = "allow" | "deny" | "approve";

export interface AgentGatePolicy {
  defaultAction?: PolicyAction;
  tools?: {
    allow?: string[];
    deny?: string[];
    approve?: string[];
  };
  riskPatterns?: RiskPattern[];
}

export interface RiskPattern {
  action: PolicyAction;
  pattern: string;
  tool?: string;
  reason?: string;
}

export interface ToolCallInput {
  toolName: string;
  arguments?: unknown;
}

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
}

export function evaluateToolCall(policy: AgentGatePolicy, input: ToolCallInput): PolicyDecision {
  const toolName = input.toolName;
  const tools = policy.tools ?? {};

  if (matchesAny(toolName, tools.deny)) {
    return {
      action: "deny",
      reason: `Tool ${toolName} is denied by policy`
    };
  }

  const riskyDecision = evaluateRiskPatterns(policy, input);
  if (riskyDecision) {
    return riskyDecision;
  }

  if (matchesAny(toolName, tools.approve)) {
    return {
      action: "approve",
      reason: `Tool ${toolName} requires approval`
    };
  }

  if (policy.defaultAction === "deny" && !matchesAny(toolName, tools.allow)) {
    return {
      action: "deny",
      reason: `Tool ${toolName} is not in the allow list`
    };
  }

  if (policy.defaultAction === "approve" && !matchesAny(toolName, tools.allow)) {
    return {
      action: "approve",
      reason: `Tool ${toolName} requires approval by default`
    };
  }

  return {
    action: "allow",
    reason: `Tool ${toolName} is allowed`
  };
}

function evaluateRiskPatterns(
  policy: AgentGatePolicy,
  input: ToolCallInput
): PolicyDecision | undefined {
  const serializedArgs = JSON.stringify(input.arguments ?? {});

  for (const riskPattern of policy.riskPatterns ?? []) {
    if (riskPattern.tool && !matchesPattern(input.toolName, riskPattern.tool)) {
      continue;
    }

    const regex = new RegExp(riskPattern.pattern, "i");
    if (!regex.test(serializedArgs)) {
      continue;
    }

    return {
      action: riskPattern.action,
      reason: riskPattern.reason ?? `Arguments matched risk pattern ${riskPattern.pattern}`
    };
  }

  return undefined;
}

function matchesAny(value: string, patterns: string[] | undefined): boolean {
  return (patterns ?? []).some((pattern) => matchesPattern(value, pattern));
}

function matchesPattern(value: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}
