---
name: anon-kit-alt
description: "Mask sensitive data in a copy of a Postgres database so it can be handed to development, testing, or analytics. Use when a user wants to mask, anonymize, or de-identify a database, remove PII from a database copy, create safe dev/test data from production, or set up data masking on a Neon Postgres or Databricks Lakebase database branch. Also use for adjusting an existing Anon-kit setup: editing the anon-kit.json map, adding or changing masking strategies, or reviewing leak checks."
---

# Anon-kit

Anon-kit masks a copy of a Postgres database in place: one masking strategy per column, compiled to SQL, verified by leak checks. It is a recipe — the source is a starting point that becomes part of this repository, yours to adapt.

## Step 1: pick the install path

Follow exactly one of these paths, based on this repository's stack.

### Option 1 - TypeScript or JavaScript codebase

```sh
npx shadcn@latest add lirbank/anon-kit/anon-kit
```

Add a script to package.json so the command is discoverable:

```json
"anon-kit": "npx bun tools/anon-kit/cli.ts"
```

If `tools/anon-kit/` already exists, it has likely been adapted to this repository — do not reinstall over it without asking the user.

### Option 2 - any other codebase

Translate the recipe. Read the reference implementation at https://github.com/lirbank/anon-kit (`src/`) and port it to this repository's stack — the masking logic is plain SQL, so it carries over. The contract to preserve: the `anon-kit.json` map (one strategy per column), the leak checks, and failing closed on any mismatch between map and live schema.

The steps below use the TypeScript commands; on a translated port, use its equivalents.

## Step 2: point at a copy of production

`apply` rewrites data in place. It must run against a disposable copy of production, never production itself — if it is not certain that a connection string points at a copy, confirm with the user before continuing.

Set the copy's connection string as `ANON_KIT_DATABASE_URL` in the environment or in a `.env` file in the repository root.

## Step 3: generate the map

```sh
npx bun tools/anon-kit/cli.ts init
```

## Step 4: draft the map, then stop for review

Set a masking strategy on each sensitive column in `anon-kit.json` — read the recipe (the README and the descriptors in `tools/anon-kit/strategies/`) for what each strategy does.

Present the drafted map to the user for review before applying. Flag every judgment call — columns you are unsure about, free-text columns that may hold names, and anything left on `keep` that could be personal data.

## Step 5: apply

```sh
npx bun tools/anon-kit/cli.ts apply
```

## Invariants

- Every live column must have an explicit masking decision, including `keep`. Any mismatch between the map and live schema must fail closed.
- Treat the copy as sensitive until masking and verification both succeed. Never use a failed or partially verified copy as the baseline or hand it to development, testing, or analytics.
- Never weaken or remove a leak check to make `apply` pass — fix the strategy or the map instead.
- A new strategy must contribute a leak check that would catch its own failure.
- Any change to verification behavior (`verify`, leak checks, the compiler in `tools/anon-kit/`) must be flagged to the user explicitly.
- Do not claim the masked database is fully anonymized — shape-preserving strategies keep identifying structure.
