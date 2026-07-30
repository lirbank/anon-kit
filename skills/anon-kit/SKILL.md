---
name: anon-kit
description: "Guides an agent to build and iterate on a bespoke, project-owned solution for masking a copy of any Postgres database and using the verified masked copy as a baseline for development, testing, previews, or analytics. Use when a user mentions database masking, anonymization, de-identification, PII, or wants to create, adapt, or review an Anon-kit solution for Databricks Lakebase, Neon Postgres, or another Postgres platform."
---

# Anon-kit

Start by reading the current README at https://github.com/lirbank/anon-kit. It defines the workflow, commands, strategies, and limitations. The reference implementation is starting material for project-owned code, not the finished deliverable.

## Step 1: align on the workflow

Briefly explain the masked-baseline workflow from the README in terms of the user's system and confirm the direction before building. Learn which database they want to mask, how they make copies of it, and what development, testing, preview, or analytics environments will consume the baseline.

The user creates and removes databases and database branches. You explain what they need to do, provide exact instructions, and wait for them to do it.

## Step 2: create the base implementation

If a bespoke implementation already exists, inspect and continue adapting it. Do not reinstall the reference implementation over project-owned code.

For a TypeScript or JavaScript repository, vendor the reference source:

```sh
npx shadcn@latest add lirbank/anon-kit/anon-kit
```

Add a package script so the command is discoverable:

```json
"anon-kit": "npx bun tools/anon-kit/cli.ts"
```

For any other stack, inspect the reference implementation and port it into the repository's language and tooling. Preserve the `anon-kit.json` map, verification, and fail-closed schema validation. The remaining steps use the TypeScript commands; use the port's equivalents.

## Step 3: prepare the masking copy

Determine the database platform, recommend the applicable copy method described in the README, and give the user exact commands or console steps. Offer further guidance, but never create or remove the copy yourself.

Masking runs only on a copy of the database the user wants to mask, created specifically for this masking run. The user sets that copy's connection string as `ANON_KIT_DATABASE_URL` and confirms that it may be overwritten. Wait for both.

`ANON_KIT_DATABASE_URL` is the only database connection for this work. All introspection, compilation, masking, and verification must use it. Never use, copy, infer, or fall back to `DATABASE_URL` or any other application database connection. Do not proceed based only on a pre-existing value.

## Step 4: generate the map

```sh
npx bun tools/anon-kit/cli.ts init
```

## Step 5: draft the map and stop for review

Draft a masking decision for every column. Use the target repository, schema, README, and reference implementation as evidence. Present a concise summary to the user and flag every judgment call, especially uncertain columns, free text, and anything left on `keep` that could contain sensitive data. Do not apply until the user approves the decisions.

## Step 6: apply, verify, and iterate

Offer a compile-only review first:

```sh
npx bun tools/anon-kit/cli.ts apply --compile-only
```

After the user approves the masking decisions and confirms the target, apply and verify:

```sh
npx bun tools/anon-kit/cli.ts apply
```

Review the verification output and resulting application behavior with the user. Fix the map, change strategies, or extend the bespoke implementation wherever the result is incomplete or unsuitable. When another clean run is needed, instruct the user to create a fresh copy and update `ANON_KIT_DATABASE_URL`.

Repeat until verification passes and the user agrees that the masking coverage and retained data utility fit the intended use.

## Step 7: hand off

Document the bespoke solution's commands, masking decisions, limitations, and procedure for creating or refreshing the masked baseline. The user keeps the accepted baseline unchanged and creates downstream copies from it. Later schema changes, strategy changes, and refreshes re-enter the review and iteration loop.

## Invariants

- Every live column has an explicit masking decision, including `keep`. Any mismatch between the map and live schema fails closed.
- Treat the copy as sensitive until masking and verification succeed and the user accepts the result.
- Never weaken or remove verification merely to make a run pass. Explain verification changes to the user.
- Do not claim that the masked database is anonymous, safe, or compliant with any standard.
