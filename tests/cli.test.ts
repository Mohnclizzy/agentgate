import { describe, expect, test } from "vitest";
import { normalizeServerCommand } from "../src/cli.js";

describe("normalizeServerCommand", () => {
  test("splits the executable from child arguments", () => {
    expect(normalizeServerCommand(["node", "server.mjs", "--flag"])).toEqual({
      command: "node",
      args: ["server.mjs", "--flag"]
    });
  });

  test("rejects missing child commands", () => {
    expect(() => normalizeServerCommand([])).toThrow("Missing MCP server command");
  });
});
