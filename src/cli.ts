#!/usr/bin/env bun
// Entry point: routes subcommands to the command scripts. Becomes the npx
// bin when the port to the anon-kit package happens.
//
// Usage: ./src/cli.ts <command> [args]

const COMMANDS: Record<string, { file: string; blurb: string }> = {
  init: {
    file: "./init.ts",
    blurb: "Introspect production and scaffold anon-kit.json",
  },
  apply: {
    file: "./apply.ts",
    blurb: "Create and mask the anon-kit branch [branch] [--compile-only]",
  },
};

const cmd = process.argv[2];
const command = cmd ? COMMANDS[cmd] : undefined;

if (!command) {
  if (cmd) console.error(`Unknown command: ${cmd}\n`);
  console.log("Usage: ./src/cli.ts <command> [args]\n\nCommands:");
  for (const [name, c] of Object.entries(COMMANDS))
    console.log(`  ${name.padEnd(7)}${c.blurb}`);
  process.exit(cmd ? 1 : 0);
}

// Drop the subcommand so the scripts see the argv shape they'd get if run
// directly (apply reads its branch name positionally).
process.argv.splice(2, 1);
await import(command.file);
