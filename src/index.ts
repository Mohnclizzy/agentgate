#!/usr/bin/env node

import { main } from "./cli.js";

main(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`agentgate: ${message}`);
  process.exitCode = 1;
});
