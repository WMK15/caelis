#!/usr/bin/env node
import { flushLogger } from "@caelis/shared";

import { createProgram } from "./program.js";

const program = createProgram();

try {
  await program.parseAsync(process.argv);
} catch (cause) {
  const { debug } = program.opts<{ debug?: boolean }>();
  if (debug && cause instanceof Error && cause.stack) {
    console.error(cause.stack);
  } else {
    console.error(cause instanceof Error ? cause.message : String(cause));
  }
  process.exitCode = 1;
} finally {
  flushLogger();
}
