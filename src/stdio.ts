import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { stdin, stdout, stderr } from "node:process";
import { AuditLogger } from "./audit.js";
import { createApprovalHandler } from "./approval.js";
import type { AgentGateConfig } from "./config.js";
import { encodeJsonLine, JsonLineBuffer, type JsonRpcMessage } from "./jsonrpc.js";
import { AgentGateProxy, type ProxyResult } from "./proxy.js";

export interface RunStdioProxyOptions {
  command: string;
  args: string[];
  cwd: string;
  config: AgentGateConfig;
  sessionId: string;
  input?: Readable;
  output?: Writable;
  errorOutput?: Writable;
}

export async function runStdioProxy(options: RunStdioProxyOptions): Promise<number> {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const errorOutput = options.errorOutput ?? stderr;
  const child = spawn(options.command, options.args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true
  });

  const proxy = new AgentGateProxy({
    sessionId: options.sessionId,
    policy: options.config.policy,
    audit: new AuditLogger(options.config.audit.path),
    approval: createApprovalHandler({ mode: options.config.approval.mode })
  });
  const clientBuffer = new JsonLineBuffer();
  const serverBuffer = new JsonLineBuffer();
  let clientQueue = Promise.resolve();
  let serverQueue = Promise.resolve();

  child.stderr?.on("data", (chunk: Buffer) => {
    errorOutput.write(chunk);
  });

  input.on("data", (chunk: Buffer | string) => {
    clientQueue = clientQueue.then(async () => {
      const messages = clientBuffer.push(chunk.toString());
      for (const message of messages) {
        await writeProxyResult(await proxy.handleClientMessage(message), child.stdin, output);
      }
    }).catch((error: unknown) => {
      errorOutput.write(`agentgate: failed to process client message: ${formatError(error)}\n`);
    });
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    serverQueue = serverQueue.then(async () => {
      const messages = serverBuffer.push(chunk.toString());
      for (const message of messages) {
        await writeProxyResult(await proxy.handleServerMessage(message), child.stdin, output);
      }
    }).catch((error: unknown) => {
      errorOutput.write(`agentgate: failed to process server message: ${formatError(error)}\n`);
    });
  });

  input.on("end", () => {
    clientQueue = clientQueue
      .then(() => endWritable(child.stdin))
      .catch((error: unknown) => {
        errorOutput.write(`agentgate: failed to close server input: ${formatError(error)}\n`);
      });
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });
}

async function writeProxyResult(
  result: ProxyResult,
  serverInput: Writable,
  clientOutput: Writable
): Promise<void> {
  for (const message of result.toServer) {
    await writeMessage(serverInput, message);
  }

  for (const message of result.toClient) {
    await writeMessage(clientOutput, message);
  }
}

function writeMessage(stream: Writable, message: JsonRpcMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(encodeJsonLine(message), (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function endWritable(stream: Writable): Promise<void> {
  return new Promise((resolve) => {
    stream.end(resolve);
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
