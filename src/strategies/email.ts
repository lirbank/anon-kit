// Fake address at example.invalid, local part hashed from the original.
// Shape-valid so app-level validation keeps passing; .invalid never routes.

import sql from "./email.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const email: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.email(${c})`,
  checks: (c) => [{ cond: `${c} !~ '@example\\.invalid$'` }],
  sql,
};
