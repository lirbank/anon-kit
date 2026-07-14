CREATE OR REPLACE FUNCTION anon_kit.phone(v text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT '555-' ||
         lpad(((('x' || substr(md5(v || anon_kit.salt()), 1, 4))::bit(16)::int % 1000))::text, 3, '0') || '-' ||
         lpad(((('x' || substr(md5(v || anon_kit.salt()), 5, 4))::bit(16)::int % 10000))::text, 4, '0')
$$;
