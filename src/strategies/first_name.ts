// Fake names of the form Pat_a1b2c3d4, hashed from the original — same name
// masks the same way within a run, and the result is obviously fake.

import sql from "./first_name.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const first_name: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.first_name(${c})`,
  checks: (c) => [{ cond: `${c} !~ '^Pat_[0-9a-f]{8}$'` }],
  sql,
};
