import { describe, expect, test } from "vitest";
import { evaluateToolCall, type AgentGatePolicy } from "../src/policy.js";

describe("evaluateToolCall", () => {
  test("denies tools listed in tools.deny", () => {
    const policy: AgentGatePolicy = {
      defaultAction: "allow",
      tools: {
        deny: ["read_secret"]
      }
    };

    const decision = evaluateToolCall(policy, {
      toolName: "read_secret",
      arguments: { path: ".env" }
    });

    expect(decision).toEqual({
      action: "deny",
      reason: "Tool read_secret is denied by policy"
    });
  });

  test("requires approval for tools listed in tools.approve", () => {
    const policy: AgentGatePolicy = {
      defaultAction: "allow",
      tools: {
        approve: ["shell"]
      }
    };

    const decision = evaluateToolCall(policy, {
      toolName: "shell",
      arguments: { command: "git status" }
    });

    expect(decision).toEqual({
      action: "approve",
      reason: "Tool shell requires approval"
    });
  });

  test("matches risky argument patterns before default allow", () => {
    const policy: AgentGatePolicy = {
      defaultAction: "allow",
      riskPatterns: [
        {
          action: "deny",
          pattern: "\\.env",
          reason: "Environment files are not exposed to agents"
        }
      ]
    };

    const decision = evaluateToolCall(policy, {
      toolName: "read_file",
      arguments: { path: "/repo/.env" }
    });

    expect(decision).toEqual({
      action: "deny",
      reason: "Environment files are not exposed to agents"
    });
  });

  test("supports deny by default with explicit allow list", () => {
    const policy: AgentGatePolicy = {
      defaultAction: "deny",
      tools: {
        allow: ["search_*"]
      }
    };

    expect(
      evaluateToolCall(policy, {
        toolName: "search_files",
        arguments: { query: "agentgate" }
      }).action
    ).toBe("allow");

    expect(
      evaluateToolCall(policy, {
        toolName: "delete_file",
        arguments: { path: "README.md" }
      })
    ).toEqual({
      action: "deny",
      reason: "Tool delete_file is not in the allow list"
    });
  });
});
