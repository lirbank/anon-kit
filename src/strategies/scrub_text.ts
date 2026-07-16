// Regex pass over free text replacing SSN, email, and phone patterns. The
// weakest strategy — names in prose survive. The checks verify the scrub
// ran, not that the text is clean: they must stay the exact regexes
// scrub_text.sql replaces, or a match the scrub can't reach (say, digits
// glued to a word, no \m boundary) fails verify with no fix possible.

import sql from "./scrub_text.sql" with { type: "text" };
import { TEXT_TYPES, type Strategy } from "./types";

export const scrub_text: Strategy = {
  types: TEXT_TYPES,
  expr: (c) => `anon_kit.scrub_text(${c})`,
  checks: (c) => [
    { suffix: " (ssn)", cond: `${c} ~ '\\m\\d{3}-\\d{2}-\\d{4}\\M'` },
    { suffix: " (email)", cond: `${c} ~ '\\m[\\w.+-]+@[\\w-]+\\.[\\w.-]+\\M'` },
    {
      suffix: " (phone)",
      cond: `${c} ~ '\\m\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\M'`,
    },
  ],
  sql,
};
