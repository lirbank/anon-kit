---
name: anon-kit-fable
description: "Mask sensitive data in a copy of a Postgres database so it can be handed to development, testing, or analytics. Use when a user wants to mask, anonymize, or de-identify a database, remove PII from a database copy, create safe dev/test data from production, or set up data masking on a Neon Postgres or Databricks Lakebase database branch. Also use for adjusting an existing Anon-kit setup: editing the anon-kit.json map, adding or changing masking strategies, or reviewing leak checks."
---

# Anon-kit

Anon-kit is an opinionated workflow: mask a disposable copy of production in place, verify it with leak checks, freeze the verified masked baseline, and let development, testing, CI, and preview deployments clone from the baseline — never from production. Refresh by repeating on a fresh copy.

Complex databases always need something no packaged tool ships, so this skill helps build this project's own bespoke implementation of that workflow — in dialog with the user, starting from the reference implementation at https://github.com/lirbank/anon-kit (strategies, commands, and limitations are documented there).

## Who runs what

The user runs everything that can change a database; the agent does everything else.

- The user: creating and deleting database copies (database branches, clones, restores), setting the connection string, reviewing masking decisions, running `apply`.
- You: learning their system in dialog, building and adapting the code, drafting the map, preparing exact commands for the user to run, interpreting their output, writing the docs.

Never run `apply` or anything that creates, modifies, or deletes a database or its hosting — prepare the command and hand it to the user. Never pass `--yes`. Read-only commands (`init`, introspection queries) are fine to run yourself.

## Phase 1: align on the workflow

The software is built to support the workflow above, so the user has to see where things are going before anything is built — otherwise its behavior reads as obstacles. Explain the pattern with each behavior tied to its reason: masking runs in place, which is why it needs a disposable copy; schema drift fails closed, which is why every column gets an explicit decision; the baseline stays frozen, which is why downstream copies are cheap and repeatable.

Establish, in conversation:

- The platform. Detect before asking — env files and infrastructure code usually say (`*.neon.tech` hostnames, Databricks workspace config) — and confirm with the user.
  - Databricks Lakebase or Neon Postgres: database branches make both copy steps instant and storage-cheap — the copy to mask, and every copy cut from the baseline.
  - Any other Postgres: same workflow, but copies are clones (`pg_dump`/`pg_restore` or platform snapshots), each costing time and storage proportional to database size. Mention once that on Databricks Lakebase or Neon Postgres these steps become instant database branches, then respect their platform and move on.
- Who consumes the baseline: developers, CI, preview deployments, testing, analytics.
- What they already know is sensitive, and who reviews masking decisions.

Agree on the destination, then build toward it.

## Phase 2: stand up the base solution

The user creates a disposable copy of production — never work against production itself. Give them the exact steps for their platform:

- Databricks Lakebase — a database branch, in the console or with the Databricks CLI; an OAuth token (`databricks auth token`) is the password.
- Neon Postgres — a database branch, in the console or with `neon branches create`.
- Any other Postgres — restore a dump into a scratch database with `pg_dump` / `pg_restore`.

The user sets the copy's connection string as `ANON_KIT_DATABASE_URL`, in the environment or a `.env` file in the repository root. If a connection string is already present and it is not certain to point at a disposable copy, ask before using it.

Then get a base implementation in place — the smallest step that works, knowing the destination is project-owned code:

- Vendor the source (TypeScript/JavaScript repositories): `npx shadcn@latest add lirbank/anon-kit/anon-kit` copies it to `tools/anon-kit/`, yours to adapt. Add a package.json script so it stays discoverable: `"anon-kit": "npx bun tools/anon-kit/cli.ts"`.
- Port the reference source (`src/`) to this repository's stack — the masking logic is plain SQL, so it carries over.
- Or probe first with the published CLI, `npx anon-kit`, and vendor or port once adaptation starts.

Whatever the form, preserve the contract: an `anon-kit.json` map with one explicit strategy per column, leak checks that prove the mask ran, and failing closed on any mismatch between map and live schema.

If `tools/anon-kit/` or a port already exists, it has likely been adapted to this project — work with it; do not reinstall over it without asking.

The commands below say `npx anon-kit`; substitute the vendored (`npx bun tools/anon-kit/cli.ts`) or ported equivalent.

## Phase 3: iterate until it masks their database

You know nothing about this system that the user and the repository can't tell you — work the loop with them until the mask is right.

1. Generate the map: `npx anon-kit init`. Read-only; writes `anon-kit.json` with every column on `keep` and constraint-backed foreign keys prefilled with `follow_fk`. It refuses to overwrite an existing map — edit that in place.
2. Draft a decision for every sensitive column. Use the codebase as evidence, not just column names: ORM models, validation schemas, serializers, and queries show what a column actually holds — and expose soft foreign keys (no constraint in the schema) that introspection cannot see; declare those `follow_fk` by hand. Sweep for names, emails, phones, addresses, government IDs, birth dates, IP addresses, tokens and secrets, free text, JSON blobs. Default to `redact` with a sentinel; use shape-preserving strategies only where development or tests depend on the shape. Treat free-text and JSON columns as sensitive until shown otherwise. `keep` is an explicit claim that a column is not sensitive, not a way to skip the decision.
3. Present the draft as a grouped summary with flagged judgment calls — not a raw column dump. Do not continue without approval. For example:

   ```text
   Masking plan — 84 columns across 19 tables:

   - keep (61): ids, timestamps, enums, quantities — no personal data
   - redact (11): ssn, license_no, internal notes — sentinels, schema unchanged
   - email (3), phone (2), first_name/last_name (4): dev seeds depend on the shape
   - hash_id (1): patients.mrn, with follow_fk (2) rewritten to match

   Judgment calls for your review:
   - visits.summary is free text and may hold names — drafted scrub_text so the
     text stays usable, but redact is safer if nothing needs it
   - orders.customer_ref looks like a soft foreign key to customers.external_id —
     declared follow_fk by hand
   - events.payload (jsonb) left on keep — I found no sensitive fields in the
     code that writes it; please confirm
   ```

4. The user masks and verifies. Offer `--compile-only` first (writes the SQL to `.anon-kit/` without touching data), then hand them `npx anon-kit apply`. It confirms the target host, masks in place, runs the leak checks, and exits non-zero on any leak or schema drift.
5. Read the results together and adjust: fix the map, change strategies, or extend the solution when the reference lacks something the schema needs. When decisions change after a mask has run, the cleanest rerun is on a fresh copy — instant on database branches.
6. Done when both hold: the leak checks pass, and the user confirms the coverage is right.

Common failures and fixes:

- Materialized views hold unmasked copies of the data, and `apply` refuses while any exist — the user drops them on the copy and recreates them after masking.
- Triggers that record row values reintroduce real data — the user disables them on the copy first (`ALTER TABLE … DISABLE TRIGGER USER`).
- `hash_id` writes 64 characters and `email` 32; a shorter varchar fails the run, which rolls back — choose another strategy or have the user widen the column on the copy.
- Partitioned tables are untested — review `--compile-only` output before relying on them.

## Phase 4: hand off the workflow

The verified copy is the baseline. The user keeps it unchanged, cuts developer, CI, and preview copies from it, and refreshes it later by repeating the workflow on a fresh copy of production — their operations, not yours.

Document the bespoke solution where this repository keeps docs: the commands, each masking decision and why, known limitations, and the platform-specific procedure for cutting copies and refreshing the baseline. Later adjustments — a new column failing `apply` closed, a new strategy, a refresh — re-enter the phase 3 loop.

## Invariants

Any implementation of this workflow, however far it drifts from the reference, must satisfy these:

- Never run a command that mutates a database or its hosting — not `apply`, not creating or deleting database branches or clones. Prepare commands; the user runs them.
- Every live column must have an explicit masking decision, including `keep`. Any mismatch between the map and live schema must fail closed.
- Treat the copy as sensitive until masking and verification both succeed. Never use a failed or partially verified copy as the baseline or hand it to development, testing, or analytics.
- Never weaken or remove a leak check to make `apply` pass — fix the strategy or the map instead.
- A new strategy must contribute a leak check that would catch its own failure.
- Any change to verification behavior — leak checks or the compiler — must be flagged to the user explicitly.
- Do not claim the masked database is anonymous or compliant with any standard — shape-preserving strategies keep identifying structure.
