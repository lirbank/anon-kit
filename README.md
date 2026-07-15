# anon-kit

Mask sensitive data in any Postgres database.

With anon-kit you can turn a database full of real names, emails, and identifiers into one you can safely hand to development, testing, or analytics.

Three properties keep this safe:

- **Every column gets a decision.** Columns default to `keep`, and choosing it is an explicit claim that the column is not sensitive. A column that appears in the live schema but not in the map fails `apply` — new columns can never slip through unmasked.
- **Leak checks prove the mask ran.** `apply` derives a verification query from the map; each strategy contributes a check that must return zero rows. Any leak exits non-zero.
- **Masked values stay consistent.** Hash-based strategies key off a single salt, so within one run the same input masks to the same output — duplicates stay duplicates, joins keep resolving. The salt is generated per run and discarded, so nothing links an entity across runs.

## Quick start

`init` writes `anon-kit.json` with every table and column listed. Choose a masking strategy for each sensitive column, then `apply` compiles the map to SQL, rewrites the data in place, and runs leak checks that must come back clean.

```sh
npx anon-kit init    # introspects the database, writes anon-kit.json
# edit anon-kit.json: set a strategy on each sensitive column
npx anon-kit apply   # masks the database in place, runs the leak checks
```

anon-kit connects to one database: `ANON_KIT_DATABASE_URL`, set in the environment or in a `.env` file in the working directory (see [.env.example](.env.example)).

## Configuration

`ANON_KIT_DATABASE_URL` is the database anon-kit introspects and masks. Point it at a copy of production, never at production itself — masking rewrites the data.

### Getting a copy to mask

- **[Neon](https://neon.com/)** — create a branch of production in the console or with `neon branches create`, and use the branch's connection string.
- **[Databricks Lakebase](https://www.databricks.com/product/lakebase)** — create a branch of the database in the console or with the Databricks CLI, and use the branch's connection string with an OAuth token (`databricks auth token`) as the password.
- **Any Postgres** — restore a dump into a scratch database (`pg_dump` production, `pg_restore` into the copy).

Branches make this instant at any database size: the branch is born with production's schema and data, and a fresh copy is one command away. To refresh a masked copy, recreate the branch and run `apply` again.

## Commands

### init

```
npx anon-kit init
```

Introspects `ANON_KIT_DATABASE_URL` and writes `anon-kit.json`. Every column starts as `keep`; foreign keys are prefilled with `follow_fk`. The file's `$schema` reference gives editor autocomplete and typo-flagging while you edit. Refuses to overwrite an existing map.

### apply

```
npx anon-kit apply [--compile-only] [--yes]
```

Validates the map against the live schema, compiles it to `.anon-kit/mask.sql` and `verify.sql`, prints the target host for confirmation, masks the database, and runs the leak checks. Exits non-zero on any leak or on schema drift, so a bad copy never gets handed out.

`--compile-only` writes the generated SQL and stops, so you can review exactly what would run. `--yes` skips the confirmation prompt.

## Masking strategies

One masking strategy per column, in the map (`anon-kit.json`). `init` writes it, you edit it, `apply` compiles it to SQL.

```json
{
  "public.patients": {
    "email": { "strategy": "email", "_pgType": "text", "_nullable": false },
    "ssn": {
      "strategy": "redact",
      "sentinel": "XXX-XX-XXXX",
      "_pgType": "text",
      "_nullable": false
    },
    "dob": {
      "strategy": "date_shift",
      "key": "patient_id",
      "_pgType": "date",
      "_nullable": false
    }
  }
}
```

A column entry is the strategy, whatever fields that strategy needs, and two machine-written schema facts (`_pgType`, `_nullable`) that `init` caches from the live schema. The underscore fields are not settings — `apply` errors when they go stale — but they let the editor flag an incompatible strategy (say, `email` on a date column) as you edit. `"strategy": null` means not decided yet; `apply` refuses to run while any column is null, unknown, or incompatible with its column type.

### keep

Ships the real value untouched.

```json
{ "strategy": "keep" }
```

- The default `init` writes for every column. Choosing it is an explicit claim that the column is not sensitive.
- Drift protection is what makes keep-by-default safe: a new live column missing from the map fails `apply`, so every column gets a decision.
- Leak check: none possible — keep is trust.

### hash_id

Replaces an identifier with a salted SHA-256 hex string (64 chars). Every column that declares `follow_fk` against it is rewritten from an old→new map in the same transaction, with constraints deferred, so joins keep resolving.

```json
{ "strategy": "hash_id" }
```

- Goes on the referenced side (usually the PK). Columns pointing at it use `follow_fk`.
- Text and varchar columns only — integer ids can't hold 64 hex chars.
- Use it when the id itself is sensitive (MRNs, SSN-derived ids, external ids). A meaningless serial int can stay `keep`.
- Leak check: every value matches `^[0-9a-f]{64}$`.

### follow_fk

For columns that reference an id: the column takes whatever the referenced column got.

```json
{ "strategy": "follow_fk", "references": "public.patients.patient_id" }
```

- `references` (required) — `schema.table.column` of the id column this one points at. `init` prefills it for constraint-backed FKs; add it by hand for soft FKs (no constraint in the schema), which introspection can't see.
- The referenced column must be `hash_id` or `keep`. The rewrite is driven by these entries, so a soft FK masks exactly like a declared one.
- Declared constraints can't be missed: `apply` fails if an FK constraint points at a `hash_id` column and the child column isn't `follow_fk` against it.
- Leak check: inherits the `hash_id` pattern when the referenced column is `hash_id`.

### first_name / last_name

Fake names of the form `Pat_a1b2c3d4` / `Doe_a1b2c3d4`, derived by hashing the original.

```json
{ "strategy": "first_name" }
```

- Deliberately obviously fake — masked data can never be mistaken for real.
- Same original name → same fake within a run, so name frequency survives. A rare surname's rarity is still a signal; use `redact` where that matters.
- Leak check: every value matches `^Pat_[0-9a-f]{8}$` / `^Doe_[0-9a-f]{8}$`.

### email

Fake address at `example.invalid`; the local part is 10 hex chars hashed from the original.

```json
{ "strategy": "email" }
```

- Shape-valid so app-level validation keeps passing; `.invalid` is a reserved TLD, so nothing can ever route there.
- Leak check: every value ends in `@example.invalid`.

### phone

Fake number of the form `555-NNN-NNNN`, digits hashed from the original.

```json
{ "strategy": "phone" }
```

- North-American shape only; real formats vary per row (extensions, country codes) and are not preserved.
- Leak check: every value matches `^555-\d{3}-\d{4}$`.

### redact

Replaces every value with one sentinel, or NULL. The only strategy that leaves no per-row signal at all.

```json
{ "strategy": "redact", "sentinel": "XXX-XX-XXXX" }
```

- `sentinel` (required) — the replacement string, or `null` to null the column. `null` needs a nullable column; a sentinel keeps the schema identical to production, which is why it's the default recommendation on NOT NULL columns.
- The right default for anything devs don't actually need realistic values for. Reach for shape-preserving strategies only when something depends on the shape.
- Leak check: every value equals the sentinel (or IS NULL).

### date_shift

Shifts all of an entity's dates by the same hashed offset, up to ±364 days, so intervals between an entity's events hold.

```json
{ "strategy": "date_shift", "key": "patient_id" }
```

- `key` (required) — a column in the same table holding the entity id. The shift is derived from the original key value (masking runs before the id rewrite), so all rows keying on the same entity shift identically — even across tables.
- Preserves durations (admit → discharge) and rough seasonality. Does not hide the year reliably, and an attacker who knows one real date for an entity recovers the shift and with it every other date.
- Leak check: none — shifted dates are indistinguishable from real ones by pattern.

### zip3

Keeps the first three zip digits, zeros the rest: `94301` → `94300`.

```json
{ "strategy": "zip3" }
```

- Mirrors the HIPAA safe-harbor generalization, with one gap: safe harbor also requires fully zeroing zip3 areas with population under 20k, which this does not do. Not a compliance claim.
- Nine-digit zips are truncated to the 5-char form.
- Leak check: every value ends in `00`.

### scrub_text

Regex pass over free text replacing SSN, email, and phone patterns with `[SSN]`, `[EMAIL]`, `[PHONE]`.

```json
{ "strategy": "scrub_text" }
```

- The weakest strategy: names and any other sensitive prose survive ("Patient Alice Garcia presented..." stays intact). Use it only when devs genuinely need the text; otherwise `redact`.
- Leak check: the same three patterns return zero matches — it verifies the scrub ran, not that the text is clean.

## Contributing

### Setup

```sh
bun install
cp .env.example .env   # set ANON_KIT_DATABASE_URL to a throwaway Postgres database
bun run seed           # create and fill the demo tables
```

### Dev loop

- `bun test` — no database needed
- `bun src/cli.ts init` — introspect the database and scaffold anon-kit.json
- `bun src/cli.ts apply --compile-only` — validate the map and write `.anon-kit/mask.sql` + `verify.sql`
- `bun src/cli.ts apply` — mask the database and run the leak checks
- `bunx tsc --noEmit` and `bun run format` before committing

### How a strategy is built

A strategy is two files in [src/strategies/](src/strategies/). Take zip3 from the strategy list above as an example. [zip3.ts](src/strategies/zip3.ts) is the descriptor: which column types the strategy accepts, how to build the masking SQL, and which leak check proves the mask ran. [zip3.sql](src/strategies/zip3.sql) holds the Postgres function the masking SQL calls. Every descriptor field is documented in [types.ts](src/strategies/types.ts), and a strategy that doesn't need its own Postgres function, like redact, skips the second file.

### Adding masking strategies

Create the two files, run `bun run schema` to regenerate the registry and the JSON schema, and add a fixture in [core.test.ts](src/core.test.ts) — the typecheck fails until the fixture exists.

The anon extension's [masking functions](https://postgresql-anonymizer.readthedocs.io/en/stable/masking_functions/) are a good source of ideas for new strategies.

### Removing masking strategies

Delete the files, rerun `bun run schema`, and take it out of the tests and any map that uses it.

### Cutting a release

Bump `version` in [package.json](package.json), commit, and push. Then publish a GitHub release whose tag is `v` plus that version:

```sh
gh release create v0.2.0 --title "v0.2.0" --notes "What changed"
```

Publishing the release triggers the [release workflow](.github/workflows/release.yml): it verifies the tag matches package.json's version, runs the tests and typecheck, builds `dist/`, and publishes to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) — no npm tokens anywhere, and every release carries a provenance attestation. When the run goes green, verify with `npx anon-kit@latest` from an empty directory.
