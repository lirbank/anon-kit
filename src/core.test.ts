// Unit tests for the pure core: hard-coded schemas and maps in, SQL and
// errors out. No database, no mocks — introspection results are plain data.

import { describe, expect, test } from "bun:test";
import {
  compileMask,
  compileProbes,
  compileVerify,
  defaultMap,
  rewrittenFollowers,
  validate,
} from "./core";
import { type Column, type Fk } from "./lib";
import {
  STRATEGY_NAMES,
  type ColumnRule,
  type Mapping,
  type StrategyName,
} from "./strategies";

const col = (
  schema: string,
  table: string,
  column: string,
  pgType = "text",
  nullable = false,
): Column => ({ schema, table, column, pgType, nullable });

// Facts for the common case, matching col()'s defaults.
const txt = { _pgType: "text", _nullable: false };

const fkc = (
  child: string,
  parent: string,
  opts: { name?: string; deferrable?: boolean } = {},
): Fk => {
  const [cs, ct, cc] = child.split(".");
  const [ps, pt, pc] = parent.split(".");
  return {
    name: opts.name ?? `fk_${ct}_${cc}`,
    childSchema: cs!,
    childTable: ct!,
    childColumn: cc!,
    parentSchema: ps!,
    parentTable: pt!,
    parentColumn: pc!,
    deferrable: opts.deferrable ?? false,
  };
};

// A patients/encounters mini-schema exercising every strategy, with one
// declared FK constraint. Fresh objects per call so tests can mutate freely.
const fixture = () => {
  const columns = [
    col("public", "patients", "patient_id"),
    col("public", "patients", "first_name"),
    col("public", "patients", "email"),
    col("public", "patients", "ssn"),
    col("public", "patients", "dob", "date", true),
    col("public", "patients", "zip", "text", true),
    col("public", "encounters", "encounter_id"),
    col("public", "encounters", "patient_id"),
    col("public", "encounters", "notes", "text", true),
  ];
  const fks = [
    fkc("public.encounters.patient_id", "public.patients.patient_id"),
  ];
  const mapping: Mapping = {
    "public.patients": {
      patient_id: { strategy: "hash_id", ...txt },
      first_name: { strategy: "first_name", ...txt },
      email: { strategy: "email", ...txt },
      ssn: { strategy: "redact", sentinel: "XXX-XX-XXXX", ...txt },
      dob: {
        strategy: "date_shift",
        key: "patient_id",
        _pgType: "date",
        _nullable: true,
      },
      zip: { strategy: "zip3", _pgType: "text", _nullable: true },
    },
    "public.encounters": {
      encounter_id: { strategy: "keep", ...txt },
      patient_id: {
        strategy: "follow_fk",
        references: "public.patients.patient_id",
        ...txt,
      },
      notes: { strategy: "scrub_text", _pgType: "text", _nullable: true },
    },
  };
  return { columns, fks, mapping };
};

describe("validate", () => {
  test("passes on a clean fixture", () => {
    const { columns, fks, mapping } = fixture();
    expect(validate(mapping, columns, fks)).toEqual([]);
  });

  test("flags a live column missing from the map", () => {
    const { columns, fks, mapping } = fixture();
    delete mapping["public.patients"]!.email;
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining(
        "live column not in mapping: public.patients.email",
      ),
    ]);
  });

  test("flags a mapped column that no longer exists", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.ghost = { strategy: "keep", ...txt };
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining(
        "mapped column no longer exists: public.patients.ghost",
      ),
    ]);
  });

  test("flags an undecided (null) strategy", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.email = { strategy: null, ...txt };
    expect(validate(mapping, columns, fks)).toEqual([
      "strategy not chosen: public.patients.email",
    ]);
  });

  test("flags an unknown strategy and lists the valid ones", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.email = {
      strategy: "rot13" as StrategyName,
      ...txt,
    };
    const errors = validate(mapping, columns, fks);
    expect(errors).toEqual([
      expect.stringContaining('unknown strategy "rot13"'),
    ]);
    expect(errors[0]).toContain(STRATEGY_NAMES.join(", "));
  });

  test("flags a strategy on an incompatible column type", () => {
    const columns = [col("public", "t", "id", "integer")];
    const mapping: Mapping = {
      "public.t": {
        id: { strategy: "hash_id", _pgType: "integer", _nullable: false },
      },
    };
    expect(validate(mapping, columns, [])).toEqual([
      "hash_id on public.t.id needs text or character varying, column is integer",
    ]);

    mapping["public.t"]!.id = {
      strategy: "date_shift",
      key: "id",
      _pgType: "integer",
      _nullable: false,
    };
    expect(validate(mapping, columns, [])).toEqual([
      expect.stringContaining("date_shift on public.t.id needs date"),
    ]);
  });

  test("flags stale or missing schema facts", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.email = {
      strategy: "email",
      _pgType: "integer",
      _nullable: true,
    };
    expect(validate(mapping, columns, fks)).toEqual([
      'stale schema facts on public.patients.email — set "_pgType": "text", "_nullable": false',
    ]);
    // A hand-added entry without facts reports the same way.
    mapping["public.patients"]!.email = { strategy: "email" } as ColumnRule;
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining("stale schema facts on public.patients.email"),
    ]);
  });

  test("flags date_shift without a key in the same table", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.dob = {
      strategy: "date_shift",
      _pgType: "date",
      _nullable: true,
    };
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining("date_shift on public.patients.dob"),
    ]);
    mapping["public.patients"]!.dob = {
      strategy: "date_shift",
      key: "no_such_column",
      _pgType: "date",
      _nullable: true,
    };
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining("date_shift on public.patients.dob"),
    ]);
  });

  test("flags redact-to-null on a NOT NULL column, accepts it on a nullable one", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.ssn = {
      strategy: "redact",
      sentinel: null,
      ...txt,
    };
    expect(validate(mapping, columns, fks)).toEqual([
      expect.stringContaining("redact-to-null on NOT NULL column"),
    ]);
    mapping["public.patients"]!.ssn = {
      strategy: "redact",
      sentinel: "X",
      ...txt,
    };
    mapping["public.patients"]!.zip = {
      strategy: "redact",
      sentinel: null,
      _pgType: "text",
      _nullable: true,
    };
    expect(validate(mapping, columns, fks)).toEqual([]);
  });

  test("flags params that belong to a different strategy", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.first_name = {
      strategy: "first_name",
      key: "patient_id",
      ...txt,
    };
    mapping["public.patients"]!.email = {
      strategy: "keep",
      sentinel: "XXX",
      ...txt,
    };
    const errors = validate(mapping, columns, fks);
    expect(errors).toEqual([
      '"key" on public.patients.first_name is not a first_name setting — remove it',
      '"sentinel" on public.patients.email is not a keep setting — remove it',
    ]);
  });

  test("flags follow_fk referencing an unknown column", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.encounters"]!.patient_id = {
      strategy: "follow_fk",
      references: "public.nowhere.id",
      ...txt,
    };
    const errors = validate(mapping, columns, fks);
    expect(errors).toContainEqual(
      expect.stringContaining("references unknown column public.nowhere.id"),
    );
  });

  test("flags follow_fk whose parent is neither hash_id nor keep", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.patients"]!.patient_id = {
      strategy: "first_name",
      ...txt,
    };
    const errors = validate(mapping, columns, fks);
    expect(errors).toContainEqual(
      expect.stringContaining("must be hash_id or keep, is first_name"),
    );
  });

  test("flags a declared FK constraint whose child is not follow_fk", () => {
    const { columns, fks, mapping } = fixture();
    mapping["public.encounters"]!.patient_id = { strategy: "keep", ...txt };
    const errors = validate(mapping, columns, fks);
    expect(errors).toContainEqual(
      expect.stringContaining("constraint fk_encounters_patient_id"),
    );
  });

  test("accepts a soft FK (follow_fk without a declared constraint)", () => {
    const { columns, mapping } = fixture();
    expect(validate(mapping, columns, [])).toEqual([]);
  });

  test("collects every error instead of stopping at the first", () => {
    const { columns, fks, mapping } = fixture();
    delete mapping["public.patients"]!.email;
    mapping["public.encounters"]!.notes = {
      strategy: null,
      _pgType: "text",
      _nullable: true,
    };
    expect(validate(mapping, columns, fks)).toHaveLength(2);
  });
});

describe("compileMask", () => {
  test("wraps everything in one transaction", () => {
    const { fks, mapping } = fixture();
    const mask = compileMask(mapping, fks);
    expect(mask).toContain("BEGIN;");
    expect(mask).toEndWith("COMMIT;\n");
  });

  test("masks values before rewriting ids, so expressions see original rows", () => {
    const { fks, mapping } = fixture();
    const mask = compileMask(mapping, fks);
    expect(mask.indexOf('anon_kit.email("email")')).toBeLessThan(
      mask.indexOf("CREATE TEMP TABLE"),
    );
  });

  test("compiles every value strategy and never assigns keep columns", () => {
    const { fks, mapping } = fixture();
    const mask = compileMask(mapping, fks);
    expect(mask).toContain('"first_name" = anon_kit.first_name("first_name")');
    expect(mask).toContain('"email" = anon_kit.email("email")');
    expect(mask).toContain("\"ssn\" = 'XXX-XX-XXXX'");
    expect(mask).toContain(
      '"dob" = anon_kit.date_shift("dob", "patient_id"::text)',
    );
    expect(mask).toContain('"zip" = anon_kit.zip3("zip")');
    expect(mask).toContain('"notes" = anon_kit.scrub_text("notes")');
    expect(mask).not.toContain('"encounter_id" =');
  });

  test("rewrites the hashed id and its followers from one old→new map", () => {
    const { fks, mapping } = fixture();
    const mask = compileMask(mapping, fks);
    expect(mask).toContain(
      'SELECT "patient_id" AS old_id, anon_kit.hash_id("patient_id"::text) AS new_id FROM "public"."patients";',
    );
    expect(mask).toContain(
      'UPDATE "public"."patients" t SET "patient_id" = m.new_id',
    );
    expect(mask).toContain(
      'UPDATE "public"."encounters" t SET "patient_id" = m.new_id',
    );
  });

  test("defers a non-deferrable constraint around the rewrite and restores it", () => {
    const { fks, mapping } = fixture();
    const mask = compileMask(mapping, fks);
    const defer = mask.indexOf("DEFERRABLE INITIALLY DEFERRED");
    const deferred = mask.indexOf("SET CONSTRAINTS ALL DEFERRED;");
    const rewrite = mask.indexOf("CREATE TEMP TABLE");
    const immediate = mask.indexOf("SET CONSTRAINTS ALL IMMEDIATE;");
    const restore = mask.indexOf("NOT DEFERRABLE;");
    expect(defer).toBeGreaterThan(-1);
    expect(defer).toBeLessThan(deferred);
    expect(deferred).toBeLessThan(rewrite);
    expect(rewrite).toBeLessThan(immediate);
    expect(immediate).toBeLessThan(restore);
  });

  test("leaves an already-deferrable constraint alone", () => {
    const { fks, mapping } = fixture();
    fks[0]!.deferrable = true;
    const mask = compileMask(mapping, fks);
    expect(mask).not.toContain("ALTER CONSTRAINT");
    expect(mask).toContain("SET CONSTRAINTS ALL DEFERRED;");
    expect(mask).not.toContain("SET CONSTRAINTS ALL IMMEDIATE;");
  });

  test("rewrites a soft FK with no constraint bookkeeping at all", () => {
    const { mapping } = fixture();
    const mask = compileMask(mapping, []);
    expect(mask).not.toContain("SET CONSTRAINTS");
    expect(mask).toContain(
      'UPDATE "public"."encounters" t SET "patient_id" = m.new_id',
    );
  });

  test("does not rewrite followers of a keep parent", () => {
    const { mapping } = fixture();
    mapping["public.patients"]!.patient_id = { strategy: "keep", ...txt };
    const mask = compileMask(mapping, []);
    expect(mask).not.toContain("CREATE TEMP TABLE");
    expect(mask).not.toContain('"patient_id" = m.new_id');
  });

  test("emits no UPDATE for a keep-only table", () => {
    const columns = [col("public", "lookup", "code")];
    const mapping: Mapping = {
      "public.lookup": { code: { strategy: "keep", ...txt } },
    };
    expect(validate(mapping, columns, [])).toEqual([]);
    expect(compileMask(mapping, [])).not.toContain("UPDATE");
  });

  test("quotes hostile identifiers and sentinels", () => {
    const mapping: Mapping = {
      "public.t": {
        'we"ird': { strategy: "email", ...txt },
        note: { strategy: "redact", sentinel: "O'Brien", ...txt },
      },
    };
    const mask = compileMask(mapping, []);
    expect(mask).toContain('"we""ird" = anon_kit.email("we""ird")');
    expect(mask).toContain("\"note\" = 'O''Brien'");
  });
});

describe("compileVerify", () => {
  test("every checkable strategy contributes; keep and date_shift add nothing", () => {
    const { mapping } = fixture();
    // hash_id, follow_fk, first_name, email, redact, zip3 = 1 each; scrub_text = 3
    expect(compileVerify(mapping).checkCount).toBe(9);

    const trustOnly: Mapping = {
      "public.t": {
        id: { strategy: "keep", ...txt },
        seen_at: {
          strategy: "date_shift",
          key: "id",
          _pgType: "date",
          _nullable: false,
        },
      },
    };
    expect(compileVerify(trustOnly).checkCount).toBe(0);
  });

  test("hash_id and its followers share the hex pattern check", () => {
    const { mapping } = fixture();
    const { sql } = compileVerify(mapping);
    expect(sql.split("'^[0-9a-f]{64}$'")).toHaveLength(3);
  });

  test("redact checks the sentinel, or IS NOT NULL when nulling", () => {
    const { mapping } = fixture();
    expect(compileVerify(mapping).sql).toContain(
      "IS DISTINCT FROM 'XXX-XX-XXXX'",
    );
    mapping["public.patients"]!.ssn = {
      strategy: "redact",
      sentinel: null,
      ...txt,
    };
    expect(compileVerify(mapping).sql).toContain('"ssn" IS NOT NULL');
  });

  test("follow_fk of a keep parent gets no check", () => {
    const { mapping } = fixture();
    mapping["public.patients"]!.patient_id = { strategy: "keep", ...txt };
    const { sql, checkCount } = compileVerify(mapping);
    expect(checkCount).toBe(7);
    expect(sql).not.toContain("follow_fk");
  });

  test("scrub_text verifies all three scrubbed patterns", () => {
    const { mapping } = fixture();
    const { sql } = compileVerify(mapping);
    expect(sql).toContain("'\\m\\d{3}-\\d{2}-\\d{4}\\M'");
    expect(sql).toContain("(email)");
    expect(sql).toContain("(phone)");
  });
});

describe("compileProbes", () => {
  test("probes redact sentinels and nothing else", () => {
    const { mapping } = fixture();
    expect(compileProbes(mapping)).toEqual([
      {
        table: "public.patients",
        column: "ssn",
        sql: `UPDATE "public"."patients" SET "ssn" = 'XXX-XX-XXXX' WHERE false`,
      },
    ]);
  });

  test("skips redact-to-null", () => {
    const { mapping } = fixture();
    mapping["public.patients"]!.ssn = {
      strategy: "redact",
      sentinel: null,
      _pgType: "text",
      _nullable: true,
    };
    expect(compileProbes(mapping)).toEqual([]);
  });

  test("quotes hostile identifiers and sentinels", () => {
    const mapping: Mapping = {
      "public.t": {
        'we"ird': { strategy: "redact", sentinel: "O'Brien", ...txt },
      },
    };
    expect(compileProbes(mapping)[0]!.sql).toBe(
      `UPDATE "public"."t" SET "we""ird" = 'O''Brien' WHERE false`,
    );
  });
});

// Forces a fixture per strategy: a name added to STRATEGY_NAMES fails this
// file's typecheck (and the suite) until it's covered here.
describe("strategy coverage", () => {
  const RULES: Record<StrategyName, ColumnRule> = {
    keep: { strategy: "keep", ...txt },
    hash_id: { strategy: "hash_id", ...txt },
    follow_fk: { strategy: "follow_fk", references: "public.t.id", ...txt },
    first_name: { strategy: "first_name", ...txt },
    last_name: { strategy: "last_name", ...txt },
    email: { strategy: "email", ...txt },
    phone: { strategy: "phone", ...txt },
    redact: { strategy: "redact", sentinel: "X", ...txt },
    date_shift: {
      strategy: "date_shift",
      key: "id",
      _pgType: "date",
      _nullable: false,
    },
    zip3: { strategy: "zip3", ...txt },
    scrub_text: { strategy: "scrub_text", ...txt },
  };

  for (const name of STRATEGY_NAMES) {
    test(`${name} validates and compiles`, () => {
      // The live column is built from the rule's own facts, so each
      // strategy is exercised on a type it accepts.
      const rule = RULES[name];
      const columns = [
        col("public", "t", "id"),
        col("public", "t", "v", rule._pgType, rule._nullable),
      ];
      const mapping: Mapping = {
        "public.t": { id: { strategy: "hash_id", ...txt }, v: rule },
      };
      expect(validate(mapping, columns, [])).toEqual([]);
      expect(() => compileMask(mapping, [])).not.toThrow();
      expect(() => compileVerify(mapping)).not.toThrow();
    });
  }
});

describe("defaultMap", () => {
  test("prefills FK columns with follow_fk and everything else with keep", () => {
    const { columns, fks } = fixture();
    const mapping = defaultMap(columns, fks);
    expect(mapping["public.encounters"]!.patient_id).toEqual({
      strategy: "follow_fk",
      references: "public.patients.patient_id",
      _pgType: "text",
      _nullable: false,
    });
    expect(mapping["public.patients"]!.email).toEqual({
      strategy: "keep",
      _pgType: "text",
      _nullable: false,
    });
    expect(Object.keys(mapping)).toEqual([
      "public.patients",
      "public.encounters",
    ]);
  });

  test("scaffolds a map that validates against its own schema", () => {
    const { columns, fks } = fixture();
    expect(validate(defaultMap(columns, fks), columns, fks)).toEqual([]);
  });
});

describe("rewrittenFollowers", () => {
  test("lists followers of hashed parents only", () => {
    const { mapping } = fixture();
    expect(rewrittenFollowers(mapping)).toEqual([
      {
        table: "public.encounters",
        column: "patient_id",
        references: "public.patients.patient_id",
      },
    ]);
    mapping["public.patients"]!.patient_id = { strategy: "keep", ...txt };
    expect(rewrittenFollowers(mapping)).toEqual([]);
  });
});
