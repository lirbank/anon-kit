CREATE OR REPLACE FUNCTION anon_kit.last_name(v text) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT anon_kit.fake_name(v, 'Doe') $$;
