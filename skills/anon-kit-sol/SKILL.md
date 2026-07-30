---
name: anon-kit
description: >-
  Builds a bespoke, project-owned Postgres masking solution and establishes a masked-baseline workflow for development, testing, previews, and analytics. Use when a user needs masked production-like data, mentions database masking, anonymization, de-identification, or PII, or wants to create, adapt, or review an Anon-kit solution for Databricks Lakebase, Neon Postgres, or another Postgres database.
---

# Anon-kit

Start by reading the current README at https://github.com/lirbank/anon-kit. It explains the proposed workflow and documented behavior.

## Gather the right context

- For a new solution, inspect the user's repository and database information, then study the relevant Anon-kit source code and tests before deciding what to build.
- For an existing bespoke solution, inspect the local implementation first. Consult the relevant Anon-kit source code and tests to understand inherited behavior or find useful patterns, but treat the local code as authoritative.
- For a workflow-only question, the README may be sufficient.

## Work with the user

Help the user build a bespoke, project-owned masking solution that fits their repository, database, and requirements.

Understand the user's system and how they currently make production copies. Explain the proposed workflow in terms of their platform and align on the direction before building.

Use what you learn from the user and the Anon-kit repository to build a useful base solution. Reuse, adapt, translate, or replace the reference implementation according to the user's stack and needs.

Treat the base solution as the first iteration. Propose decisions, explain assumptions and uncertainty, and use the user's domain knowledge and the results of running the solution to improve it. Continue until the user agrees that it works for their intended use.

The user creates and removes databases and database branches. Explain what they need to do and wait for them to do it.
