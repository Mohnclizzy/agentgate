import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, test } from "vitest";
import { runStdioProxy } from "../src/stdio.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("runStdioProxy", () => {
  test("processes a final client message before closing child stdin", async () => {
    const cwd = process.cwd();
    const dir = await mkdtemp(join(tmpdir(), "agentgate-stdio-"));
    tempDirs.push(dir);
    const input = new PassThrough();
    const output = new PassThrough();
    const errorOutput = new PassThrough();
    let stdoutText = "";
    let stderrText = "";
    output.on("data", (chunk) => {
      stdoutText += chunk.toString();
    });
    errorOutput.on("data", (chunk) => {
      stderrText += chunk.toString();
    });

    const run = runStdioProxy({
      command: process.execPath,
      args: ["examples/demo-mcp-server.mjs"],
      cwd,
      sessionId: "s1",
      input,
      output,
      errorOutput,
      config: {
        policy: {
          defaultAction: "allow"
        },
        audit: {
          path: join(dir, "audit.jsonl")
        },
        approval: {
          mode: "deny"
        }
      }
    });

    input.end(
      '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"safe_echo","arguments":{"text":"hi sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"}}}\n'
    );

    await expect(run).resolves.toBe(0);
    expect(stderrText).toBe("");
    expect(stdoutText).toContain("[REDACTED:openai-key]");
  });
});
