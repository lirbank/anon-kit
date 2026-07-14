// Assembles the masking function pack: shared infrastructure (pgcrypto,
// schema, salt) plus every registered strategy's functions, in registry
// order. Text imports keep each strategy's SQL co-located with its
// descriptor and ship it inside the package — nothing is read from disk.

import shared from "./strategies/shared.sql" with { type: "text" };
import { STRATEGIES } from "./strategies";

export function installSql(): string {
  const parts = [shared];
  for (const s of Object.values(STRATEGIES)) if (s.sql) parts.push(s.sql);
  return parts.join("\n");
}
