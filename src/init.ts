// Introspects ANON_KIT_DATABASE_URL and writes anon-kit.json: every column
// listed, defaulted to "keep". FK columns are prefilled with follow_fk (they
// inherit whatever the referenced column decides, so there's nothing to
// choose). Set masking strategies on the sensitive columns, then run
// anon-kit apply. I/O shell only — the scaffolding logic lives in core.ts.
//
// Usage: anon-kit init

import postgres from "postgres";
import { defaultMap } from "./core";
import { introspect } from "./lib";

const MAP_FILE = "anon-kit.json";
// The schema is a committed build artifact (bun run schema). Swap this for a
// public URL once the schema is hosted where editors can fetch it anonymously.
const SCHEMA_REF = "./anon-kit.schema.json";

const url = process.env.ANON_KIT_DATABASE_URL;
if (!url) {
  console.error("ANON_KIT_DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const existing = Bun.file(MAP_FILE);
if (await existing.exists()) {
  console.error(`${MAP_FILE} already exists — delete it to start over`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const { columns, fks } = await introspect(sql);
await sql.end();

const mapping = defaultMap(columns, fks);

await Bun.write(
  MAP_FILE,
  JSON.stringify({ $schema: SCHEMA_REF, ...mapping }, null, 2) + "\n",
);

const fkCount = Object.values(mapping)
  .flatMap(Object.values)
  .filter((r) => r.strategy === "follow_fk").length;
console.log(
  `Wrote ${MAP_FILE}: ${Object.keys(mapping).length} tables, ${columns.length} columns (${fkCount} follow_fk, the rest default to "keep").`,
);
console.log(
  `Review every column and set a masking strategy on the sensitive ones — "keep" means it ships unmasked. Then run anon-kit apply.`,
);
