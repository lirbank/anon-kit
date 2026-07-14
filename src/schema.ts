// JSON schema for anon-kit.json, a committed build artifact (bun run schema)
// so IDEs autocomplete strategies and flag typos while the human fills it in.
// Derived entirely from the strategy registry: the enum from the names, the
// param properties and required-when-chosen rules from each entry's params,
// and the _pgType compatibility rules from each entry's types.

import { STRATEGIES, STRATEGY_NAMES } from "./strategies";

export function buildMapSchema() {
  const params = Object.fromEntries(
    Object.values(STRATEGIES).flatMap((s) => Object.entries(s.params ?? {})),
  );
  const allOf = Object.entries(STRATEGIES)
    .filter(([, s]) => s.params || s.types)
    .map(([name, s]) => ({
      if: { properties: { strategy: { const: name } } },
      then: {
        ...(s.params ? { required: Object.keys(s.params) } : {}),
        ...(s.types ? { properties: { _pgType: { enum: s.types } } } : {}),
      },
    }));
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Anonymization mapping",
    description: "column → masking strategy, compiled to SQL by anon-kit apply",
    type: "object",
    properties: { $schema: { type: "string" } },
    patternProperties: {
      "^[^.]+\\.[^.]+$": {
        type: "object",
        additionalProperties: {
          type: "object",
          properties: {
            strategy: { enum: [...STRATEGY_NAMES, null] },
            ...params,
            _pgType: {
              type: "string",
              description: "live column type — written by init, not a setting",
            },
            _nullable: {
              type: "boolean",
              description:
                "live column nullability — written by init, not a setting",
            },
          },
          required: ["strategy", "_pgType", "_nullable"],
          additionalProperties: false,
          allOf,
        },
      },
    },
    additionalProperties: false,
  };
}
