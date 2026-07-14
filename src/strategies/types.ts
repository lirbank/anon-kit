// The Strategy descriptor: everything one masking strategy must answer for.
// Descriptors are pure and map-blind — core.ts resolves schema and map facts
// into the ctx objects, so a strategy module never sees the whole map.

// Params a column entry may carry beyond "strategy". Structural (no
// StrategyName) so descriptor modules don't import the registry they form.
export type RuleParams = {
  references?: string; // follow_fk: "schema.table.column"
  sentinel?: string | null; // redact
  key?: string; // date_shift: key column in the same table
};

// Live-schema facts about the column, from introspection — never the map.
export type LiveColumn = { pgType: string; nullable: boolean };

export type ValidateCtx = {
  table: string; // "schema.table"
  column: string;
  rule: RuleParams;
  liveCol: LiveColumn | undefined;
  // Mapped column names in the same table (date_shift key lookup)
  siblingColumns: string[];
  // Strategy of the column rule.references points at; undefined = references
  // missing or target not in the map, null = target mapped but undecided
  referencedStrategy: string | null | undefined;
};

export type CheckCtx = {
  rule: RuleParams;
  referencedStrategy: string | null | undefined;
};

// One leak check: cond must match zero rows after masking. suffix
// distinguishes multiple checks on one column (scrub_text).
export type Check = { suffix?: string; cond: string };

// The text-ish data_types the value strategies accept.
export const TEXT_TYPES = ["text", "character varying", "character"];

export type Strategy = {
  // data_type values (information_schema) the strategy can mask; absent
  // means any. Enforced in core validate against the live type and compiled
  // into the JSON schema's per-strategy _pgType rules for the IDE.
  types?: string[];
  // Pass-1 mask expression over the quoted column, or null when the strategy
  // has no per-column expression (keep ships the value; hash_id and follow_fk
  // are rewritten in the ID pass).
  expr: ((c: string, rule: RuleParams) => string) | null;
  // Leak checks on the quoted column. An empty list is a deliberate
  // "no check possible" — every strategy answers, none forgets.
  checks: (c: string, ctx: CheckCtx) => Check[];
  // Strategy-specific validation against the live schema and resolved map
  // facts. Returns error strings; empty means valid.
  validate?: (ctx: ValidateCtx) => string[];
  // JSON-schema property fragments for this strategy's params. Every listed
  // param becomes required when the strategy is chosen.
  params?: Record<string, { type: string | string[]; description: string }>;
  // The strategy's anon_kit functions, installed with the function pack
  // (install.ts). Omit when the strategy compiles to plain SQL.
  sql?: string;
};
