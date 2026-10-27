# Disposable PostgreSQL 17 migration execution and authorization smoke checks.
# Run from the isolated I-WAY worktree. Never run against linked Supabase UAT.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker is required for disposable PostgreSQL 17 certification' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$container = 'iway-uat-cert-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$password = [guid]::NewGuid().ToString('N')
try {
  docker run -d --name $container -e "POSTGRES_PASSWORD=$password" -e POSTGRES_DB=iway_cert postgres:17 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to start disposable PostgreSQL' }
  $ready = $false
  for ($i=0; $i -lt 40; $i++) {
    docker exec $container pg_isready -U postgres -d iway_cert *> $null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'Disposable PostgreSQL did not become ready' }
  # Supabase initializes these API roles; vanilla postgres:17 does not.
  # Create inert placeholders ONLY inside this disposable Docker database.
  $bootstrap = "CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;"
  $bootstrap | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d iway_cert -f -
  if ($LASTEXITCODE -ne 0) { throw 'Disposable Supabase-role bootstrap failed' }
  $migrations = Get-ChildItem (Join-Path $root 'supabase/migrations') -Filter '*.sql' | Sort-Object Name
  foreach ($migration in $migrations) {
    Write-Host "MIGRATION: $($migration.Name)"
    Get-Content -Raw $migration.FullName | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d iway_cert -f -
    if ($LASTEXITCODE -ne 0) { throw "Migration failed: $($migration.Name)" }
  }
  $checks = @'
DO $$
BEGIN
 IF current_setting('server_version_num')::integer < 170000 OR current_setting('server_version_num')::integer >= 180000 THEN RAISE EXCEPTION 'Expected PostgreSQL 17'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='iway_dispatcher_provisioner' AND NOT rolcanlogin AND NOT rolbypassrls) THEN RAISE EXCEPTION 'Provisioner missing or unsafe'; END IF;
 IF has_table_privilege('iway_operations_runtime','operations_private.dispatcher_directory','INSERT') THEN RAISE EXCEPTION 'Runtime can write directory'; END IF;
 IF NOT has_table_privilege('iway_dispatcher_provisioner','operations_private.dispatcher_directory','INSERT,UPDATE') THEN RAISE EXCEPTION 'Provisioner missing write grants'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE oid='operations_private.dispatcher_directory'::regclass AND (NOT relrowsecurity OR NOT relforcerowsecurity)) THEN RAISE EXCEPTION 'Directory RLS not forced'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='operations_private' AND tablename='dispatcher_directory' AND policyname='dispatcher_directory_provision_insert') THEN RAISE EXCEPTION 'Insert policy missing'; END IF;
END $$;
'@
  $checks | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d iway_cert -f -
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL authorization smoke check failed' }
  $behavior = Join-Path $root 'scripts/uat-postgres17-behavior.sql'
  Get-Content -Raw $behavior | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d iway_cert -f -
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL behavioral authorization checks failed' }
  $tenantTests = Join-Path $root 'scripts/uat-postgres17-tenant-rls.sql'
  Get-Content -Raw $tenantTests | docker exec -i $container psql -X -v ON_ERROR_STOP=1 -U postgres -d iway_cert -f -
  if ($LASTEXITCODE -ne 0) { throw 'B841-B860 tenant RLS tests failed' }
  Write-Host 'POSTGRESQL MIGRATION + AUTHORIZATION + BEHAVIORAL + TENANT RLS PASS'
} finally {
  try { docker rm -f $container 2>$null | Out-Null } catch { Write-Warning 'Disposable container cleanup failed; inspect docker ps -a' }
}
