// Shifts all of an entity's dates by the same hashed offset, so intervals
// between an entity's events hold. Keys on the original id value — masking
// runs before the ID rewrite. No check possible: shifted dates match real
// dates by pattern.

import sql from "./date_shift.sql" with { type: "text" };
import { quoteIdent } from "../lib";
import type { Strategy } from "./types";

export const date_shift: Strategy = {
  // Matches anon_kit.date_shift(d date, ...) — timestamps are not supported.
  types: ["date"],
  expr: (c, rule) =>
    `anon_kit.date_shift(${c}, ${quoteIdent(rule.key!)}::text)`,
  checks: () => [],
  validate: (ctx) =>
    !ctx.rule.key || !ctx.siblingColumns.includes(ctx.rule.key)
      ? [
          `date_shift on ${ctx.table}.${ctx.column} needs "key" naming a column in the same table`,
        ]
      : [],
  params: {
    key: {
      type: "string",
      description: "date_shift: key column in the same table",
    },
  },
  sql,
};
