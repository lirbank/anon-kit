// The strategy registry — the single source of truth for the masking
// vocabulary. One module per strategy; the record itself (registry.ts) is
// generated from this directory, so adding or removing a strategy is adding
// or deleting its file and rerunning bun run schema. STRATEGY_NAMES,
// apply-time validation, compilation, and the JSON schema all derive from
// the record, so a registered strategy answers for its mask expression,
// leak checks, validation, and params by construction — there is nowhere
// left to forget one.

import type { RuleParams } from "./types";
import { STRATEGIES } from "./registry";

export { STRATEGIES };

export type StrategyName = keyof typeof STRATEGIES;
export const STRATEGY_NAMES = Object.keys(STRATEGIES) as StrategyName[];

// A column entry in the map: the strategy plus whatever params it needs,
// and the live-schema facts init caches so the IDE can check compatibility.
// Underscore-prefixed = machine-written, not a setting; validate errors
// when they drift from the live schema.
export type ColumnRule = {
  strategy: StrategyName | null;
  _pgType: string;
  _nullable: boolean;
} & RuleParams;

// "schema.table" -> column -> rule
export type Mapping = Record<string, Record<string, ColumnRule>>;

export type {
  Check,
  CheckCtx,
  RuleParams,
  Strategy,
  ValidateCtx,
} from "./types";
