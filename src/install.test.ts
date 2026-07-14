// The assembled function pack: shared preamble first, then each sql-bearing
// strategy's functions verbatim, in registry order.

import { describe, expect, test } from "bun:test";
import { installSql } from "./install";
import { STRATEGIES } from "./strategies";

describe("installSql", () => {
  test("installs shared infrastructure before any strategy function", () => {
    const out = installSql();
    expect(out).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    expect(out).toContain("CREATE SCHEMA IF NOT EXISTS anon_kit;");
    expect(out.indexOf("FUNCTION anon_kit.salt()")).toBeLessThan(
      out.indexOf("FUNCTION anon_kit.hash_id"),
    );
  });

  test("exactly the function-backed strategies ship SQL", () => {
    const withSql = Object.entries(STRATEGIES)
      .filter(([, s]) => s.sql)
      .map(([name]) => name);
    expect(withSql).toEqual([
      "date_shift",
      "email",
      "first_name",
      "hash_id",
      "last_name",
      "phone",
      "scrub_text",
      "zip3",
    ]);
  });

  test("each strategy's SQL defines its own anon_kit function, shipped verbatim", () => {
    const out = installSql();
    for (const [name, s] of Object.entries(STRATEGIES)) {
      if (!s.sql) continue;
      expect(s.sql).toContain(`FUNCTION anon_kit.${name}(`);
      expect(out).toContain(s.sql);
    }
  });
});
