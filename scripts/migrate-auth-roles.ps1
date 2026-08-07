$ErrorActionPreference = 'Stop'
$authDbPassword = if ([string]::IsNullOrEmpty($env:AUTH_DB_PASSWORD)) { 'hwalro_auth' } else { $env:AUTH_DB_PASSWORD }
$dmlPath = Join-Path $PSScriptRoot '..\apps\auth-service\src\main\resources\db\dml.sql'

$processInfo = [System.Diagnostics.ProcessStartInfo]::new()
$processInfo.FileName = 'docker'
$processInfo.Arguments = "exec -i hwalro-mysql mysql --default-character-set=utf8mb4 -uhwalro_auth `"-p$authDbPassword`" hwalro_auth"
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardInput = $true

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $processInfo
$null = $process.Start()

try {
  $input = [System.IO.File]::OpenRead($dmlPath)
  try {
    $input.CopyTo($process.StandardInput.BaseStream)
  } finally {
    $input.Dispose()
  }

  $process.StandardInput.Close()
  $process.WaitForExit()
  $exitCode = $process.ExitCode
} finally {
  $process.Dispose()
}

if ($exitCode -ne 0) {
  exit $exitCode
}

Write-Output 'roles DML applied to existing hwalro_auth volume'
