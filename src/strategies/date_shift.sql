-- Per-entity date shift: same key → same shift, so intervals between a
-- given entity's dates are preserved. Key on the ORIGINAL id value.
CREATE OR REPLACE FUNCTION anon_kit.date_shift(d date, key text) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT (d + ((('x' || substr(md5(key || anon_kit.salt()), 1, 8))::bit(32)::int % 365) * interval '1 day'))::date
$$;
