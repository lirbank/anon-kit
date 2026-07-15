#!/usr/bin/env node
// Entry point: routes subcommands to the command scripts.
//
// Usage: anon-kit <command> [flags]

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
    load: () => import("./init.ts"),
    blurb: "Introspect the database and scaffold anon-kit.json",
  },
  apply: {
    load: () => import("./apply.ts"),
    blurb: "Mask the database and run leak checks [--compile-only] [--yes]",
  },
};

const cmd = process.argv[2];
const command = cmd ? COMMANDS[cmd] : undefined;

if (!command) {
  if (cmd) console.error(`Unknown command: ${cmd}\n`);
  console.log("Usage: anon-kit <command> [flags]\n\nCommands:");
  for (const [name, c] of Object.entries(COMMANDS))
    console.log(`  ${name.padEnd(7)}${c.blurb}`);
  process.exit(cmd ? 1 : 0);
}

await command.load();
