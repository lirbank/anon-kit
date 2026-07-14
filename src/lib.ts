// Shared pieces for the anon scripts: schema introspection, SQL quoting,
// and target-branch resolution via the Neon API.

import { createApiClient, EndpointType } from "@neondatabase/api-client";
import type postgres from "postgres";

export type Column = {
  schema: string;
  table: string;
  column: string;
  pgType: string;
  nullable: boolean;
};

export type Fk = {
  name: string;
  childSchema: string;
  childTable: string;
  childColumn: string;
  parentSchema: string;
  parentTable: string;
  parentColumn: string;
  deferrable: boolean;
};

export async function introspect(sql: postgres.Sql) {
  const columns = await sql<Column[]>`
    SELECT c.table_schema AS schema,
           c.table_name   AS table,
           c.column_name  AS column,
           c.data_type    AS "pgType",
           c.is_nullable = 'YES' AS nullable
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_type = 'BASE TABLE'
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema', 'anon_kit')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position`;

  const fks = await sql<Fk[]>`
    SELECT con.conname AS name,
           child_ns.nspname   AS "childSchema",
           child.relname      AS "childTable",
           child_col.attname  AS "childColumn",
           parent_ns.nspname  AS "parentSchema",
           parent.relname     AS "parentTable",
           parent_col.attname AS "parentColumn",
           con.condeferrable  AS deferrable
    FROM pg_constraint con
    JOIN pg_class child        ON child.oid = con.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent        ON parent.oid = con.confrelid
    JOIN pg_namespace parent_ns ON parent_ns.oid = parent.relnamespace
    JOIN unnest(con.conkey)  WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS cfk(attnum, ord) ON cfk.ord = ck.ord
    JOIN pg_attribute child_col  ON child_col.attrelid = child.oid  AND child_col.attnum = ck.attnum
    JOIN pg_attribute parent_col ON parent_col.attrelid = parent.oid AND parent_col.attnum = cfk.attnum
    WHERE con.contype = 'f'
      AND child_ns.nspname NOT IN ('pg_catalog', 'information_schema')`;

  return { columns: [...columns], fks: [...fks] };
}

export const quoteIdent = (s: string) => `"${s.replaceAll('"', '""')}"`;
export const quoteLiteral = (s: string) => `'${s.replaceAll("'", "''")}'`;
export const qualify = (table: string) =>
  table.split(".").map(quoteIdent).join(".");

// Creates a branch via the Neon API and returns its connection string, or
// returns TARGET_DATABASE_URL directly when set. Axios errors embed the API
// key in their config — callers must catch and use exitOnApiError.
export async function resolveTargetUrl(branchName: string): Promise<string> {
  if (process.env.TARGET_DATABASE_URL) {
    console.log("Using TARGET_DATABASE_URL as target branch");
    return process.env.TARGET_DATABASE_URL;
  }

  const apiKey = process.env.NEON_API_KEY;
  const sourceUrl = process.env.DATABASE_URL;
  if (!apiKey || !sourceUrl) {
    console.error(
      "Set TARGET_DATABASE_URL, or NEON_API_KEY + DATABASE_URL (see .env.example)",
    );
    process.exit(1);
  }

  const api = createApiClient({ apiKey });

  let projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) {
    // Works for personal/org keys; project-scoped keys can't list projects
    const projects = (await api.listProjects({})).data.projects;
    if (projects.length !== 1) {
      console.error(
        `Expected exactly one Neon project, found ${projects.length}. Set NEON_PROJECT_ID.`,
      );
      process.exit(1);
    }
    projectId = projects[0]!.id;
  }

  const source = new URL(sourceUrl);
  const database = source.pathname.slice(1);
  const role = decodeURIComponent(source.username);

  console.log(`Creating branch "${branchName}" in project ${projectId}...`);
  const created = await api.createProjectBranch(projectId, {
    branch: { name: branchName },
    endpoints: [{ type: EndpointType.ReadWrite }],
  });

  const uri = await api.getConnectionUri({
    projectId,
    branch_id: created.data.branch.id,
    database_name: database,
    role_name: role,
  });
  console.log(`Branch ${created.data.branch.id} created`);
  return uri.data.uri;
}

export function exitOnApiError(err: unknown): never {
  const e = err as {
    isAxiosError?: boolean;
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  if (e.isAxiosError) {
    console.error(
      `Neon API error ${e.response?.status}: ${e.response?.data?.message ?? e.message}`,
    );
    process.exit(1);
  }
  throw err;
}
