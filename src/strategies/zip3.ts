// Keeps the first three zip digits, zeros the rest: 94301 → 94300. Mirrors
// the HIPAA safe-harbor generalization (without the under-20k-population
// zeroing — not a compliance claim).

import sql from "./zip3.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const zip3: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.zip3(${c})`,
  checks: (c) => [{ cond: `${c} !~ '00$'` }],
  sql,
};
