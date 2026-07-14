CREATE OR REPLACE FUNCTION anon_kit.first_name(v text) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT anon_kit.fake_name(v, 'Pat') $$;
