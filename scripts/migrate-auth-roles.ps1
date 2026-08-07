$ErrorActionPreference = 'Stop'
$authDbPassword = if ([string]::IsNullOrEmpty($env:AUTH_DB_PASSWORD)) { 'hwalro_auth' } else { $env:AUTH_DB_PASSWORD }
$dmlPath = Join-Path $PSScriptRoot '..\apps\auth-service\src\main\resources\db\dml.sql'

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content -Raw -Encoding utf8 $dmlPath | docker exec -i hwalro-mysql mysql -uhwalro_auth "-p$authDbPassword" hwalro_auth
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Output 'roles DML applied to existing hwalro_auth volume'
