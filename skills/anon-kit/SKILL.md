---
name: anon-kit
description: "Builds a bespoke, project-owned Postgres masking solution and establishes a masked-baseline workflow for development, testing, previews, and analytics. Use when a user needs masked production-like data, mentions database masking, anonymization, de-identification, or PII, or wants to create, adapt, or review an Anon-kit solution for Databricks Lakebase, Neon Postgres, or another Postgres database."
---

# Anon-kit

Start by reading the current README at https://github.com/lirbank/anon-kit. It explains the proposed workflow and documented behavior.

## Gather the right context

- For a new solution, inspect the user's repository and database information, then inspect the relevant parts of the Anon-kit repository before choosing how to seed the project-owned implementation.
- For an existing bespoke solution, inspect the local implementation first. Consult the relevant parts of the Anon-kit repository to understand inherited behavior or find useful patterns, but treat the local code as authoritative.
- For a workflow-only question, the README may be sufficient.

## Work with the user

Help the user build a bespoke, project-owned masking solution that fits their repository, database, and requirements.

Understand the user's system and how they make copies of the database they want to mask. Explain the proposed workflow in terms of their platform and align on the direction before building.

The user creates and removes databases and database branches. Explain what they need to do and wait for them to do it.

## Keep the database boundary

`ANON_KIT_DATABASE_URL` is the only database connection for this work. All introspection, compilation, masking, and verification must use it. Never use, copy, infer, or fall back to `DATABASE_URL` or any other application database connection.

Masking runs only on a copy of the database the user wants to mask, created specifically for this masking run. Never select or recommend an existing database as the target. Instruct the user to create the copy, set `ANON_KIT_DATABASE_URL`, and confirm that it may be overwritten, then wait for them to do it.

## Build and iterate

Use what you learn from the user and the Anon-kit repository to build a useful base solution. Reuse, adapt, translate, or replace the reference implementation according to the user's stack and needs.

Treat the base solution as the first iteration. Propose decisions, explain assumptions and uncertainty, and use the user's domain knowledge and the results of running the solution to improve it. Continue until the user agrees that it works for their intended use.
