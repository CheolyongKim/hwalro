[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$SourceDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RequiredCommit = '09c6c7feb3853347691363955f98f3bce0144686'
$EngineDirectory = $PSScriptRoot
$VirtualEnvironment = Join-Path $EngineDirectory '.venv'
$VirtualEnvironmentPython = Join-Path $VirtualEnvironment 'Scripts\python.exe'

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(Mandatory)] [string[]]$ArgumentList,
        [Parameter(Mandatory)] [string]$Description
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed (exit code: $LASTEXITCODE)"
    }
}

function Resolve-Python312 {
    $candidates = @()
    $launcher = Get-Command 'py.exe' -ErrorAction SilentlyContinue
    if ($null -ne $launcher) {
        $candidates += ,@($launcher.Source, '-3.12')
    }
    $python = Get-Command 'python.exe' -ErrorAction SilentlyContinue
    if ($null -ne $python) {
        $candidates += ,@($python.Source)
    }

    foreach ($candidate in $candidates) {
        $filePath = $candidate[0]
        $baseArguments = @($candidate | Select-Object -Skip 1)
        & $filePath @baseArguments -c "import struct,sys; raise SystemExit(0 if sys.version_info[:2] == (3,12) and struct.calcsize('P') == 8 else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) {
            return @{ FilePath = $filePath; BaseArguments = $baseArguments }
        }
    }

    throw '64-bit CPython 3.12 was not found.'
}

function Import-VisualStudioEnvironment {
    if ($null -ne (Get-Command 'cl.exe' -ErrorAction SilentlyContinue)) {
        return
    }

    $vsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vsWhere -PathType Leaf)) {
        throw 'Visual Studio 2022 C++ build tools were not found.'
    }

    $installationPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath |
        Select-Object -First 1
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($installationPath)) {
        throw 'Visual Studio 2022 C++ build tools were not found.'
    }

    $vsDevCmd = Join-Path $installationPath 'Common7\Tools\VsDevCmd.bat'
    $environmentLines = & $env:ComSpec /d /s /c "call `"$vsDevCmd`" -arch=x64 >nul && set"
    if ($LASTEXITCODE -ne 0) {
        throw 'Visual Studio C++ environment initialization failed.'
    }

    foreach ($line in $environmentLines) {
        $separator = $line.IndexOf('=')
        if ($separator -gt 0) {
            [Environment]::SetEnvironmentVariable(
                $line.Substring(0, $separator),
                $line.Substring($separator + 1),
                [EnvironmentVariableTarget]::Process
            )
        }
    }
}

$SourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).Path
$gitDirectory = Join-Path $SourceDirectory '.git'
if (-not (Test-Path -LiteralPath $gitDirectory -PathType Container)) {
    throw "Not a JuPedSim Git repository: $SourceDirectory"
}

$git = (Get-Command 'git.exe' -ErrorAction Stop).Source
& $git -c "safe.directory=$SourceDirectory" -C $SourceDirectory merge-base --is-ancestor $RequiredCommit HEAD
if ($LASTEXITCODE -ne 0) {
    throw "JuPedSim source must include Hwalro commit $RequiredCommit"
}

$python = Resolve-Python312
if (-not (Test-Path -LiteralPath $VirtualEnvironmentPython -PathType Leaf)) {
    Invoke-Checked $python.FilePath ($python.BaseArguments + @('-m', 'venv', $VirtualEnvironment)) 'Virtual environment creation'
}
Invoke-Checked $VirtualEnvironmentPython @('-c', "import struct,sys; raise SystemExit(0 if sys.version_info[:2] == (3,12) and struct.calcsize('P') == 8 else 1)") 'Virtual environment check'
Invoke-Checked $VirtualEnvironmentPython @('-m', 'pip', 'install', '--disable-pip-version-check', '--no-deps', '-r', (Join-Path $EngineDirectory 'requirements.txt')) 'Runtime dependency installation'
Invoke-Checked $VirtualEnvironmentPython @('-m', 'pip', 'install', '--disable-pip-version-check', 'setuptools', 'wheel', 'cmake', 'ninja') 'Build tool installation'

Import-VisualStudioEnvironment
Invoke-Checked $VirtualEnvironmentPython @('-m', 'pip', 'install', '--disable-pip-version-check', '--force-reinstall', '--no-build-isolation', '--no-deps', $SourceDirectory) 'Custom JuPedSim installation'
Invoke-Checked $VirtualEnvironmentPython @('-c', 'import jupedsim as jps; assert jps.Agent.position.fset is not None') 'Agent.position setter verification'
Invoke-Checked $VirtualEnvironmentPython @((Join-Path $EngineDirectory 'runner.py'), '--version') 'Runner verification'

Write-Host "Hwalro JuPedSim environment is ready: $VirtualEnvironmentPython" -ForegroundColor Green
