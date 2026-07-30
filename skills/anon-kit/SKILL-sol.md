---
name: anon-kit
description: >-
  Builds a bespoke, project-owned Postgres masking solution and establishes a masked-baseline workflow for development, testing, previews, and analytics. Use when a user needs masked production-like data, mentions database masking, anonymization, de-identification, or PII, or wants to create, adapt, or review an Anon-kit solution for Databricks Lakebase, Neon Postgres, or another Postgres database.
---

# Anon-kit

Before doing anything else, read the current README at https://github.com/lirbank/anon-kit. Treat it as the source of truth for Anon-kit's proposed workflow and reference implementation.

Help the user build a bespoke masking solution for their repository, database, and requirements. The Anon-kit npm package and source are a reference implementation, not the finished deliverable. The resulting solution should be project-owned and fit the user's system.

## Align on the workflow

Learn how the user currently copies production and what they need the masked data for. Briefly explain the workflow the solution will support and align on that direction before building:

```text
production
  → restricted candidate copy
  → mask and verify
  → restricted, unchanged masked baseline
  → development, test, preview, and analytics copies
```

The solution masks the candidate copy in place. Once the user accepts the masking and verification, that copy becomes the baseline and stays unchanged. Development, test, preview, and analytics environments copy from the baseline. Refresh by repeating the workflow with a new copy of current production.

- If the user has Databricks Lakebase or Neon Postgres, explain the workflow using database branches. Both copy steps are instant, so masking is the only step whose time grows with database size.
- Otherwise, explain how the same workflow uses their clone, snapshot, or backup-and-restore process. Point out that Databricks Lakebase and Neon Postgres database branches make the workflow substantially faster and avoid full-copy storage for each environment.

The user creates and removes databases and database branches. Give them the instructions they need, then wait for them to do it.

## Study the source and build

Inspect the user's repository, database information, and any existing masking solution. Study the relevant source code in the Anon-kit reference repository before deciding what to build.

Use that understanding to create a useful base solution in the user's repository. Reuse, adapt, translate, or replace the reference implementation according to the user's stack and needs. Do not force its package, language, commands, or file layout onto the project.

## Iterate with the user

Treat the base solution as the first iteration. Propose the masking decisions, explain important assumptions and uncertainty, and use the user's domain knowledge to improve them.

Before writing to a database, review what the solution will do with the user and get explicit confirmation that the connection targets a disposable candidate copy, never production. Run or guide the user through masking and verification, inspect the results together, and revise the implementation and decisions as needed. When another clean copy is needed, instruct the user to create it.

Continue until the checks pass and the user agrees that the database is appropriately masked for its intended use. Verification shows that the intended masking ran; it does not prove that the result is anonymous or compliant.

## Leave the solution usable

Once the user accepts the result, leave concise project documentation covering how to run and change the solution, interpret verification, understand its limitations, and create or refresh the masked baseline.

## Boundaries

- Never create or remove a database or database branch.
- Never mask production or proceed when the target is uncertain.
- Treat a candidate copy as sensitive until masking and verification succeed and the user accepts it.
- Keep the accepted masked baseline unchanged.
- Do not claim anonymity, safety, or regulatory compliance.
