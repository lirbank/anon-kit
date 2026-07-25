---
name: anon-kit
description: "Mask sensitive data in a copy of a Postgres database so it can be handed to development, testing, or analytics. Use when a user wants to mask, anonymize, or de-identify a database, remove PII from a database copy, create safe dev/test data from production, or set up data masking on a Neon or Databricks Lakebase database branch. Also use for adjusting an existing anon-kit setup: editing the anon-kit.json map, adding or changing masking strategies, or reviewing leak checks."
---

# anon-kit

anon-kit masks a copy of a Postgres database in place: one masking strategy per column, compiled to SQL, verified by leak checks. It is a recipe — the source installs into this repository under `tools/anon-kit/` and is yours to adapt.

## Step 1: install the recipe

```sh
npx shadcn@latest add lirbank/anon-kit/anon-kit#recipe
```

This copies the source to `tools/anon-kit/` and adds `bun` and `postgres` as devDependencies. If `tools/anon-kit/` already exists, it has likely been adapted to this repository — do not reinstall over it without asking the user.

## Step 2: point at a copy of production

`apply` rewrites data in place. It must run against a disposable copy of production, never production itself.

Ask the user for the connection string of a copy — on Neon or Lakebase, a database branch of production; on plain Postgres, a restored dump. Set it as `ANON_KIT_DATABASE_URL` in the environment or in a `.env` file in the repository root.

## Step 3: generate the map

```sh
npx bun tools/anon-kit/cli.ts init
```

This introspects the database and writes `anon-kit.json` with every table and column listed.

## Step 4: draft the map, then stop for review

Set a masking strategy on each sensitive column in `anon-kit.json`. The available strategies are the files in `tools/anon-kit/strategies/` — each descriptor documents what it masks and how. A column left on `keep` ships its real values: keep is an explicit claim that the column is not sensitive.

Present the drafted map to the user for review before applying. Flag every judgment call — columns you are unsure about, free-text columns that may hold names, and anything left on `keep` that could be personal data.

## Step 5: apply

```sh
npx bun tools/anon-kit/cli.ts apply
```

This compiles the map to SQL, asks for confirmation of the target host, masks the database in place, and runs leak checks that must come back clean.

## Invariants

- Never weaken or remove a leak check to make `apply` pass — fix the strategy or the map instead.
- A new strategy must contribute a leak check that would catch its own failure.
- Any change to verification behavior (`verify`, leak checks, the compiler in `tools/anon-kit/`) must be flagged to the user explicitly.
- Do not claim the masked database is fully anonymized — shape-preserving strategies keep identifying structure.
