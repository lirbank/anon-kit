// Fake surnames of the form Doe_a1b2c3d4 — see first_name.

import sql from "./last_name.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const last_name: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.last_name(${c})`,
  checks: (c) => [{ cond: `${c} !~ '^Doe_[0-9a-f]{8}$'` }],
  sql,
};
