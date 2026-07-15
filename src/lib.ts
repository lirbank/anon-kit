// Shared pieces for the commands: schema introspection and SQL quoting.

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
