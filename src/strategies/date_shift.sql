-- Per-entity date shift: same key → same shift, so intervals between a
-- given entity's dates are preserved. Key on the ORIGINAL id value. The
-- shift is never zero (±1–364 days) — a zero shift would ship the entity's
-- real dates with no check able to notice.
CREATE OR REPLACE FUNCTION anon_kit.date_shift(d date, key text) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT (d + ((r + CASE WHEN r >= 0 THEN 1 ELSE -1 END) * interval '1 day'))::date
  FROM (SELECT ('x' || substr(md5(key || anon_kit.salt()), 1, 8))::bit(32)::int % 364 AS r) _
$$;
