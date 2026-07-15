- Use sentence case instead of title case
- Never mutate git without the users confirmation
- Propose commit messages when ready to commit
- Max three words for new Git branch names
- Max four words for Git commit messages

## Terminology

- A branch is a database branch, never a git branch. Write "database branch" wherever git could be read into it
- Mask is the only verb for overwriting sensitive values. Never anonymize, obfuscate, or scrub as verbs (scrub_text and redact are strategy names only)
- apply masks the database at ANON_KIT_DATABASE_URL in place — a copy of production the user creates
- The map is anon-kit.json: one masking strategy per column
- Don't claim masked output is fully anonymized — shape-preserving strategies keep identifying structure
