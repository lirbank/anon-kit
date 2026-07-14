-- Shared infrastructure for the masking function pack. Pure SQL over
-- pgcrypto — installable anywhere the anon extension isn't (Lakebase, or
-- Neon without unstable extensions). All functions are deterministic given
-- the salt, so cross-table joins stay consistent within a run. The runner
-- generates a fresh salt per run (set as app.anon_salt on the session) and
-- discards it; salt() raises if it's missing.
--
-- Strategy functions live next to their descriptors (<strategy>.sql);
-- install.ts assembles this preamble plus all of them in registry order.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS anon_kit;

CREATE OR REPLACE FUNCTION anon_kit.salt() RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE s text;
BEGIN
  s := current_setting('app.anon_salt', true);
  IF s IS NULL OR s = '' THEN
    RAISE EXCEPTION 'app.anon_salt is not set — refusing to mask without a salt';
  END IF;
  RETURN s;
END $$;

-- Shared by first_name/last_name.
CREATE OR REPLACE FUNCTION anon_kit.fake_name(v text, prefix text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT prefix || '_' || substr(md5(v || anon_kit.salt()), 1, 8)
$$;
