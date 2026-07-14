// Replaces every value with one sentinel, or NULL. The only strategy that
// leaves no per-row signal at all.

import { quoteLiteral } from "../lib";
import type { Strategy } from "./types";

export const redact: Strategy = {
  expr: (_, rule) =>
    rule.sentinel === null ? "NULL" : quoteLiteral(rule.sentinel!),
  checks: (c, ctx) => [
    {
      cond:
        ctx.rule.sentinel === null
          ? `${c} IS NOT NULL`
          : `${c} IS DISTINCT FROM ${quoteLiteral(ctx.rule.sentinel!)}`,
    },
  ],
  validate: (ctx) =>
    ctx.rule.sentinel === null && ctx.liveCol && !ctx.liveCol.nullable
      ? [
          `redact-to-null on NOT NULL column ${ctx.table}.${ctx.column} — set a "sentinel"`,
        ]
      : [],
  params: {
    sentinel: {
      type: ["string", "null"],
      description: "redact: replacement value (null needs a nullable column)",
    },
  },
};
