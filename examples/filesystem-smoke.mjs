#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentgateBin = join(repoRoot, "dist", "src", "index.js");

if (!existsSync(agentgateBin)) {
  console.error("Build AgentGate first: npm run build");
  process.exit(1);
}

const fixtureDir = mkdtempSync(join(tmpdir(), "agentgate-filesystem-"));
const notesPath = join(fixtureDir, "notes.txt");
const envPath = join(fixtureDir, ".env");

writeFileSync(notesPath, "hello from filesystem smoke", "utf8");
writeFileSync(envPath, "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890", "utf8");

const serverCommand =
  process.platform === "win32"
    ? ["cmd", "/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", fixtureDir]
    : ["npx", "-y", "@modelcontextprotocol/server-filesystem", fixtureDir];

const child = spawn(
  process.execPath,
  [
    agentgateBin,
    "wrap",
    "--config",
    join(repoRoot, "agentgate.example.yml"),
    "--",
    ...serverCommand
  ],
  {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  }
);

let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

child.stdin.end(
  [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "agentgate-filesystem-smoke", version: "0.1.0" }
      }
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: notesPath } }
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "read_file", arguments: { path: envPath } }
    }
  ]
    .map((message) => JSON.stringify(message))
    .join("\n") + "\n"
);

child.on("error", (error) => {
  cleanup();
  console.error(error.message);
  process.exit(1);
});

child.on("close", (code) => {
  cleanup();

  if (code !== 0) {
    fail(`AgentGate exited with code ${code}`);
  }

  const messages = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const safeRead = messages.find((message) => message.id === 2);
  const blockedEnv = messages.find((message) => message.id === 3);
  const safeText = JSON.stringify(safeRead ?? {});
  const blockedText = JSON.stringify(blockedEnv ?? {});

  if (!safeText.includes("hello from filesystem smoke")) {
    fail("Safe file read did not return expected content");
  }

  if (!blockedText.includes("Access to env and private-key files is blocked")) {
    fail(".env read was not blocked by AgentGate");
  }

  if (blockedText.includes("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890")) {
    fail("Secret value appeared in blocked response");
  }

  console.log("filesystem smoke passed");
  console.log(`safe read: ${notesPath}`);
  console.log(`blocked: ${envPath}`);
  console.log("audit log: .agentgate/audit.jsonl");
});

function cleanup() {
  rmSync(fixtureDir, { recursive: true, force: true });
}

function fail(message) {
  console.error(message);
  console.error("--- stdout ---");
  console.error(stdout.trim());
  console.error("--- stderr ---");
  console.error(stderr.trim());
  process.exit(1);
}
