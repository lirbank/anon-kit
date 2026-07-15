#!/usr/bin/env bun
// Entry point: routes subcommands to the command scripts.
//
// Usage: anon-kit <command> [flags]

const COMMANDS: Record<string, { file: string; blurb: string }> = {
  init: {
    file: "./init.ts",
    blurb: "Introspect the database and scaffold anon-kit.json",
  },
  apply: {
    file: "./apply.ts",
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

await import(command.file);
