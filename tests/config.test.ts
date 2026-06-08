import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { defaultConfig, loadAgentGateConfig } from "../src/config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("loadAgentGateConfig", () => {
  test("loads policy, audit, and approval settings from YAML", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentgate-config-"));
    tempDirs.push(dir);
    const configPath = join(dir, "agentgate.yml");

    await writeFile(
      configPath,
      [
        "policy:",
        "  defaultAction: deny",
        "  tools:",
        "    allow:",
        "      - search_*",
        "audit:",
        "  path: logs/agentgate.jsonl",
        "approval:",
        "  mode: deny"
      ].join("\n")
    );

    await expect(loadAgentGateConfig(configPath, dir)).resolves.toEqual({
      policy: {
        defaultAction: "deny",
        tools: {
          allow: ["search_*"]
        }
      },
      audit: {
        path: join(dir, "logs/agentgate.jsonl")
      },
      approval: {
        mode: "deny"
      }
    });
  });

  test("returns safe defaults when no config path is provided", async () => {
    const config = await loadAgentGateConfig(undefined, "C:\\repo");

    expect(config.policy.riskPatterns?.map((pattern) => pattern.reason)).toContain(
      "Environment and private-key files are not exposed to agents"
    );
    expect(config.audit.path).toBe(join("C:\\repo", ".agentgate", "audit.jsonl"));
    expect(config.approval.mode).toBe("prompt");
  });
});

describe("defaultConfig", () => {
  test("approves common shell-like tool names by default", () => {
    expect(defaultConfig("C:\\repo").policy.tools?.approve).toEqual(
      expect.arrayContaining(["shell", "run_command", "execute_command"])
    );
  });
});
