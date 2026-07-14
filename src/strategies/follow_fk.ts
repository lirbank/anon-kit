// For columns that reference an id: the column takes whatever the referenced
// column got. Declares intent rather than doing work — the ID pass rewrites
// the values, so a soft FK (no constraint) masks exactly like a declared one.

import { hashedCond } from "./hash_id";
import type { Strategy } from "./types";

export const follow_fk: Strategy = {
  expr: null, // rewritten in the ID pass, not pass 1
  checks: (c, ctx) =>
    ctx.referencedStrategy === "hash_id" ? [{ cond: hashedCond(c) }] : [],
  validate: (ctx) => {
    if (ctx.referencedStrategy === undefined)
      return [
        `follow_fk on ${ctx.table}.${ctx.column} references unknown column ${ctx.rule.references}`,
      ];
    if (
      ctx.referencedStrategy !== "hash_id" &&
      ctx.referencedStrategy !== "keep"
    )
      return [
        `follow_fk on ${ctx.table}.${ctx.column}: referenced ${ctx.rule.references} must be hash_id or keep, is ${ctx.referencedStrategy}`,
      ];
    return [];
  },
  params: {
    references: {
      type: "string",
      description: "follow_fk: schema.table.column",
    },
  },
};
