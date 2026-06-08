import { randomUUID } from "node:crypto";
import { Command } from "commander";
import { loadAgentGateConfig } from "./config.js";
import { runStdioProxy } from "./stdio.js";

export interface NormalizedServerCommand {
  command: string;
  args: string[];
}

export function normalizeServerCommand(parts: string[]): NormalizedServerCommand {
  const [command, ...args] = parts;
  if (!command) {
    throw new Error("Missing MCP server command. Usage: agentgate wrap -- <command> [args...]");
  }

  return { command, args };
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name("agentgate")
    .description("Policy-as-code firewall for AI agent tool calls.")
    .version("0.1.0");

  program
    .command("wrap")
    .description("Wrap a stdio MCP server command with AgentGate policy enforcement.")
    .option("-c, --config <path>", "Path to agentgate.yml")
    .option("--session <id>", "Audit session id")
    .argument("<serverCommand...>", "MCP server command and arguments after --")
    .allowUnknownOption(true)
    .action(async (serverCommand: string[], options: { config?: string; session?: string }) => {
      const normalized = normalizeServerCommand(serverCommand);
      const cwd = process.cwd();
      const config = await loadAgentGateConfig(options.config, cwd);
      const sessionId = options.session ?? randomUUID();
      const code = await runStdioProxy({
        ...normalized,
        cwd,
        config,
        sessionId
      });

      process.exitCode = code;
    });

  await program.parseAsync(argv);
}
