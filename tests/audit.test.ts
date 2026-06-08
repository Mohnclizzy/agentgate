import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { AuditLogger } from "../src/audit.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("AuditLogger", () => {
  test("appends one JSON object per line with a timestamp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentgate-audit-"));
    tempDirs.push(dir);
    const auditPath = join(dir, "nested", "audit.jsonl");
    const logger = new AuditLogger(auditPath, () => "2026-06-08T00:00:00.000Z");

    await logger.append({
      type: "tool_decision",
      sessionId: "s1",
      requestId: 1,
      toolName: "read_file",
      decision: "allow"
    });

    const lines = (await readFile(auditPath, "utf8")).trim().split("\n");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toEqual({
      timestamp: "2026-06-08T00:00:00.000Z",
      type: "tool_decision",
      sessionId: "s1",
      requestId: 1,
      toolName: "read_file",
      decision: "allow"
    });
  });
});
