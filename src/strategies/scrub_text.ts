// Regex pass over free text replacing SSN, email, and phone patterns. The
// weakest strategy — names in prose survive. The checks verify the scrub
// ran, not that the text is clean.

import sql from "./scrub_text.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const scrub_text: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.scrub_text(${c})`,
  checks: (c) => [
    { suffix: " (ssn)", cond: `${c} ~ '\\d{3}-\\d{2}-\\d{4}'` },
    { suffix: " (email)", cond: `${c} ~* '[\\w.+-]+@[\\w-]+\\.[\\w.-]+'` },
    {
      suffix: " (phone)",
      cond: `${c} ~ '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}'`,
    },
  ],
  sql,
};
