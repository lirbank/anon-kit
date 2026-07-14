# anon-kit

Mask sensitive data in any Postgres database.

Point anon-kit at a Postgres URL, choose a masking strategy per sensitive column, and it rewrites the data in place. Pairs well with copy-on-write branching platforms like [Neon](https://neon.com/) and [Databricks Lakebase](https://www.databricks.com/product/lakebase): mask a branch of production, then let devs branch from the masked copy — instant dev databases, no real data.

> **Status:** placeholder release. This package does not do anything yet — the implementation is being ported and will land shortly.
