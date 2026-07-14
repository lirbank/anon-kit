// Fake number of the form 555-NNN-NNNN, digits hashed from the original.
// North-American shape only.

import sql from "./phone.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const phone: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.phone(${c})`,
  checks: (c) => [{ cond: `${c} !~ '^555-\\d{3}-\\d{4}$'` }],
  sql,
};
