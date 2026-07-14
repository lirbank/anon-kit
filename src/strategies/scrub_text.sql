-- Regex scrub for SSN/email/phone patterns in free text. Won't catch names
-- or PHI in prose — that limitation goes in the disclaimer.
CREATE OR REPLACE FUNCTION anon_kit.scrub_text(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(v, '\m\d{3}-\d{2}-\d{4}\M', '[SSN]',   'g'),
      '\m[\w.+-]+@[\w-]+\.[\w.-]+\M',            '[EMAIL]', 'g'),
    '\m\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\M',   '[PHONE]', 'g')
$$;
