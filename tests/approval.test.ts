import { describe, expect, test } from "vitest";
import { createApprovalHandler, formatApprovalQuestion } from "../src/approval.js";

describe("formatApprovalQuestion", () => {
  test("includes tool name, reason, and arguments", () => {
    expect(
      formatApprovalQuestion({
        sessionId: "s1",
        toolName: "shell",
        reason: "Dangerous command",
        arguments: { command: "git push" }
      })
    ).toContain("shell");
    expect(
      formatApprovalQuestion({
        sessionId: "s1",
        toolName: "shell",
        reason: "Dangerous command",
        arguments: { command: "git push" }
      })
    ).toContain("Dangerous command");
  });
});

describe("createApprovalHandler", () => {
  test("allow mode approves without prompting", async () => {
    const handler = createApprovalHandler({ mode: "allow" });

    await expect(
      handler({
        sessionId: "s1",
        toolName: "shell",
        reason: "Needs approval",
        arguments: {}
      })
    ).resolves.toBe(true);
  });

  test("deny mode rejects without prompting", async () => {
    const handler = createApprovalHandler({ mode: "deny" });

    await expect(
      handler({
        sessionId: "s1",
        toolName: "shell",
        reason: "Needs approval",
        arguments: {}
      })
    ).resolves.toBe(false);
  });

  test("prompt mode accepts y or yes only", async () => {
    const yesHandler = createApprovalHandler({
      mode: "prompt",
      question: async () => "yes"
    });
    const noHandler = createApprovalHandler({
      mode: "prompt",
      question: async () => "no"
    });

    const request = {
      sessionId: "s1",
      toolName: "shell",
      reason: "Needs approval",
      arguments: {}
    };

    await expect(yesHandler(request)).resolves.toBe(true);
    await expect(noHandler(request)).resolves.toBe(false);
  });
});
