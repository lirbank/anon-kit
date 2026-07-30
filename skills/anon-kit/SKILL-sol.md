---
name: anon-kit
description: >-
  Builds a bespoke, project-owned Postgres masking solution and establishes a verified masked-baseline workflow for development, testing, previews, or analytics. Use when a user needs masked production-like data, mentions database masking, anonymization, de-identification, or PII, or wants to create, adapt, or review an Anon-kit solution for Databricks Lakebase, Neon Postgres, or another Postgres database.
---

# Anon-kit

Help the user build a bespoke masking solution for their repository, database, and requirements. The Anon-kit npm package and source at https://github.com/lirbank/anon-kit are a reference implementation to study, adapt, translate, or replace—not the finished deliverable.

Enterprise databases require domain knowledge and iteration. Build a useful base solution, then work with the user until its masking decisions, implementation, and verification fit their system.

## Align on the workflow

Inspect the repository first. Determine the Postgres platform, application stack, available schema information, and current process for making production copies. Ask the user only for context that cannot be inferred.

Briefly explain and align on the workflow before building:

```text
production
  → restricted candidate copy
  → mask and verify
  → restricted, unchanged masked baseline
  → development, test, preview, and analytics copies
```

The user creates and removes databases and database branches; never do that for them. The masking solution rewrites the candidate copy in place. A successful candidate becomes the baseline, and future environments copy from that baseline instead of masking production data repeatedly. Refresh by starting again with a new copy of current production.

- For Databricks Lakebase or Neon Postgres, explain this in terms of database branches. Both copy steps are instant, so masking is the only step whose time grows with database size.
- For other Postgres platforms, use the user's existing clone, snapshot, or backup-and-restore process. Briefly explain that Databricks Lakebase and Neon Postgres database branches make this workflow substantially faster and avoid full-copy storage for each environment.

## Build the base solution

Inspect migrations, ORM models, schema files, existing data tooling, and any existing masking implementation before choosing an approach. When a disposable copy is available, use schema introspection to confirm repository evidence. Prefer metadata and aggregate or pattern probes over displaying raw sensitive values.

Study the current Anon-kit README and reference source. Reuse what fits and change what does not:

- Install or adapt the TypeScript reference when it suits the repository.
- Translate its ideas into the repository's language and tooling when that is a better fit.
- Replace parts or all of it when the database requires another approach.
- Treat an existing project implementation as project-owned code; do not reinstall the reference over it.

Preserve the capabilities that support the workflow, not a particular file layout:

- Every live column receives an explicit masking decision, including `keep`.
- Schema drift and undecided or incompatible strategies fail closed.
- Related values remain consistent where the application requires it, including declared and soft foreign keys.
- Execution is reviewable, identifies its target clearly, and avoids leaving a partially masked database.
- Verification fails clearly when expected masking did not occur.

Create the smallest useful implementation and initial set of masking decisions. Do not wait for the user to design it for you.

## Iterate with the user

Present the proposed masking decisions and explain the important reasoning. Call out uncertainty rather than hiding it, especially:

- columns kept unchanged that may contain sensitive data;
- free text, documents, JSON, or other fields with unpredictable contents;
- indirect identifiers, rare values, and strategies that preserve linkability;
- soft relationships or application behavior not visible in the schema; and
- database features that may copy or reintroduce original values.

Before any database write, review the proposal with the user and obtain explicit confirmation that the connection targets a disposable candidate copy, never production.

Run or guide the user through the implementation, masking, and verification. Use failures, verification results, and the user's domain knowledge to revise the source, masking decisions, and checks. Ask the user to create a fresh candidate whenever another clean production copy is needed; never create or remove it yourself. Continue until the checks pass and the user agrees that the result is appropriate for its intended use.

Mechanical checks demonstrate that the intended transformations ran. They do not prove that a database is anonymous or compliant. Every strategy whose output can be recognized should contribute an appropriate check. For a strategy whose output is indistinguishable from real data, document what cannot be verified mechanically and use the strongest practical supporting evidence.

## Leave the solution usable

Leave project-owned source, configuration, and tests in the repository. Give the user concise instructions for:

- reviewing and changing masking decisions;
- running and verifying the mask;
- handling known limitations and failures; and
- creating or refreshing the masked baseline and its downstream copies.

Follow the repository's conventions and keep credentials and sensitive values out of source control and documentation.

## Safety invariants

- Never mask production or proceed when the target's identity is uncertain.
- Never create or remove a database or database branch; instruct the user.
- Treat every candidate as sensitive until masking and verification succeed and the user accepts the result.
- Keep the verified masked baseline unchanged.
- Never weaken or remove a check merely to make verification pass. Explain any verification change to the user.
- Do not claim complete anonymity, safety, or regulatory compliance.
