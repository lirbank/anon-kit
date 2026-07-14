-- Join-preserving ID hash: same input + salt → same 64-char hex everywhere.
CREATE OR REPLACE FUNCTION anon_kit.hash_id(v text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT encode(digest(v || anon_kit.salt(), 'sha256'), 'hex')
$$;
