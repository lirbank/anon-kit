// Ships the real value untouched. Choosing it is an explicit claim that the
// column is not sensitive. No leak check is possible — keep is trust.

import type { Strategy } from "./types.ts";

export const keep: Strategy = {
  expr: null,
  checks: () => [],
};
