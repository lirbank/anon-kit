// Compiles anon-kit.json into mask/verify SQL and runs it on the database.
// I/O shell only — validation and compilation live in core.ts.
//
// 1. Introspects the live schema and diffs it against the mapping — any
//    live column missing from the mapping (or still strategy: null) is an
//    error. New columns can't silently sail through unmasked.
// 2. Compiles .anon-kit/mask.sql + verify.sql from the mapping.
// 3. Confirms the target host, installs the function pack, masks, verifies,
//    reports. Exits non-zero on leaks.
//
// Usage: anon-kit apply [--compile-only] [--yes]

import { createInterface } from "node:readline/promises";
import postgres from "postgres";
import {
  compileMask,
  compileVerify,
  rewrittenFollowers,
  validate,
} from "./core";
import { installSql } from "./install";
import { introspect, qualify, quoteIdent } from "./lib";
import type { Mapping } from "./strategies";

const MAP_FILE = "anon-kit.json";
const GENERATED_DIR = ".anon-kit";

const compileOnly = process.argv.includes("--compile-only");
const skipConfirm = process.argv.includes("--yes");

const url = process.env.ANON_KIT_DATABASE_URL;
if (!url) {
  console.error("ANON_KIT_DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const { $schema: _, ...mapping }: Mapping & { $schema?: string } =
  await Bun.file(MAP_FILE)
    .json()
    .catch(() => {
      console.error(`Cannot read ${MAP_FILE} — run anon-kit init first`);
      process.exit(1);
    });

const sql = postgres(url, { max: 1, onnotice: () => {} });
const { columns, fks } = await introspect(sql);

const errors = validate(mapping, columns, fks);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}

const mask = compileMask(mapping, fks);
const { sql: verify, checkCount } = compileVerify(mapping);

// The folder ignores itself, so running apply never dirties the user's
// gitignore. The map at the repo root is the only file meant to be committed.
await Bun.write(`${GENERATED_DIR}/.gitignore`, "*\n");
await Bun.write(`${GENERATED_DIR}/mask.sql`, mask);
await Bun.write(`${GENERATED_DIR}/verify.sql`, verify);
console.log(
  `Compiled ${GENERATED_DIR}/mask.sql and verify.sql (${checkCount} leak checks)`,
);

if (compileOnly) process.exit(0);

// --------------------------------------------------------------------- run

// Masking rewrites data in place — make the human look at the host before
// anything is written. --yes is for CI, where the URL is machine-placed.
if (!skipConfirm) {
  const host = new URL(url).hostname;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Mask ${host} in place? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log("Aborted — nothing written.");
    process.exit(1);
  }
}

// Per-run salt, generated fresh and discarded: masks are consistent within a
// run (joins, FKs, date intervals) but nothing links an entity across runs.
const salt = crypto.randomUUID();

// The function pack ships inside the package via text imports — only the
// map and the generated SQL live in the user's repo.
await sql.unsafe(installSql());
await sql`SELECT set_config('app.anon_salt', ${salt}, false)`;

console.log("Masking...");
const started = performance.now();
await sql.file(`${GENERATED_DIR}/mask.sql`);
console.log(`Masked in ${((performance.now() - started) / 1000).toFixed(2)}s`);

const results = await sql.file(`${GENERATED_DIR}/verify.sql`);
const leaks = results.filter((r) => r.leaks > 0);
for (const r of results)
  console.log(`${r.leaks > 0 ? "LEAK" : "  ok"}  ${r.check_}: ${r.leaks}`);

for (const table of Object.keys(mapping)) {
  const [row] = await sql.unsafe(
    `SELECT count(*)::int AS count FROM ${qualify(table)}`,
  );
  console.log(`rows  ${table}: ${row!.count}`);
}
for (const f of rewrittenFollowers(mapping)) {
  const [ps, pt, pc] = f.references.split(".");
  const [join] = await sql.unsafe(`
    SELECT count(*)::int AS total, count(p.*)::int AS joined
    FROM ${qualify(f.table)} c
    LEFT JOIN ${quoteIdent(ps!)}.${quoteIdent(pt!)} p
      ON p.${quoteIdent(pc!)} = c.${quoteIdent(f.column)}
    WHERE c.${quoteIdent(f.column)} IS NOT NULL`);
  console.log(
    `join  ${f.table}.${f.column} → ${pt}: ${join!.joined}/${join!.total}`,
  );
}

await sql.end();

if (leaks.length > 0) {
  console.error("Leak checks failed — do not grant access to this database.");
  process.exit(1);
}
console.log("All leak checks passed.");
