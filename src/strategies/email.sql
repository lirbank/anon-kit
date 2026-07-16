-- Shape-preserving fake so app-level validation keeps passing.
CREATE OR REPLACE FUNCTION anon_kit.email(v text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT substr(md5(v || anon_kit.salt()), 1, 16) || '@example.invalid'
$$;
