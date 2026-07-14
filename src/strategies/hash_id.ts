// Replaces an identifier with a salted SHA-256 hex string (64 chars),
// join-preserving. The ID pass in compileMask rewrites the column and every
// follow_fk pointing at it from one old→new map. Text columns only in v1.

import sql from "./hash_id.sql" with { type: "text" };
import type { Strategy } from "./types";

// Shared with follow_fk: followers of a hashed column inherit this shape.
export const hashedCond = (c: string) => `${c} !~ '^[0-9a-f]{64}$'`;

export const hash_id: Strategy = {
  // No "character": the 64-char hex won't fit fixed-length columns.
  types: ["text", "character varying"],
  expr: null, // rewritten in the ID pass, not pass 1
  checks: (c) => [{ cond: hashedCond(c) }],
  sql,
};
