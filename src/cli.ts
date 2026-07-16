#!/usr/bin/env node
// Entry point: routes subcommands to the command scripts.
//
// Usage: anon-kit <command> [flags]

import { version } from "../package.json";

// Bun loads .env on its own; this loads it when running under Node.
try {
  process.loadEnvFile();
} catch {
  // No .env file — the variables may come from the shell instead.
}

const COMMANDS: Record<
  string,
  { load: () => Promise<unknown>; blurb: string }
> = {
  init: {
    load: () => import("./init"),
    blurb: "Introspect the database and scaffold anon-kit.json",
  },
  apply: {
    load: () => import("./apply"),
    blurb: "Mask the database and run leak checks [--compile-only] [--yes]",
  },
};

const cmd = process.argv[2];

if (cmd === "--version" || cmd === "-v") {
  console.log(version);
  process.exit(0);
}

const command = cmd ? COMMANDS[cmd] : undefined;

if (!command) {
  if (cmd) console.error(`Unknown command: ${cmd}\n`);
  console.log(
    `anon-kit v${version}\n\nUsage: anon-kit <command> [flags]\n\nCommands:`,
  );
  for (const [name, c] of Object.entries(COMMANDS))
    console.log(`  ${name.padEnd(7)}${c.blurb}`);
  console.log("\nFlags:\n  --version, -v  Print the version");
  process.exit(cmd ? 1 : 0);
}

await command.load();
