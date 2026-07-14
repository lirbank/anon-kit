CREATE OR REPLACE FUNCTION anon_kit.zip3(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT substr(v, 1, 3) || '00' $$;
