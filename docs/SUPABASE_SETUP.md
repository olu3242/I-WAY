# I-way Supabase connection — operator checklist

Target Supabase ref: `vnoxdinldneeczxibicp`.

1. Connect the Supabase account or organization containing this exact project to ChatGPT's Supabase integration. Confirm that project ref is visible before any schema write.
2. Inspect the existing schema, extensions, exposed schemas and roles before applying `migrations/001_early_access.sql`.
3. Keep registration data out of public Data API access. Prefer a dedicated private schema and least-privileged server database role; do not grant `anon` or `authenticated` access to raw early-access leads.
4. Store a server-only pooled Postgres connection string in deployment secrets as `DATABASE_URL`; never expose it in public JavaScript or commit it to git. Configure TLS and connection pool according to Supabase's current database connection documentation.
5. Deploy the Node server in a supported persistent runtime. Run migration, privilege checks, real database insert/read-back and restart persistence tests.
6. Add distributed rate limits, consent version, retention and deletion procedures, email confirmation policy, privacy/legal approval and abuse protection before public release.
7. Run browser registration E2E and negative tests; collect actual hosted evidence before marking PASS.

Status: **BLOCKED** pending project access and runtime credentials. No SQL executed against the supplied project.
