$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend\frontend"

$PythonCandidates = @(
  (Join-Path $Root ".venv\Scripts\python.exe"),
  (Join-Path $BackendDir "venv\Scripts\python.exe"),
  "python"
)

$PythonExe = $null
foreach ($Candidate in $PythonCandidates) {
  if ($Candidate -ne "python" -and -not (Test-Path $Candidate)) {
    continue
  }

  & $Candidate -c "import django" *> $null
  if ($LASTEXITCODE -eq 0) {
    $PythonExe = $Candidate
    break
  }
}

if (-not $PythonExe) {
  throw "Could not find a Python environment with Django installed. Run: python -m pip install -r backend\requirements.txt"
}

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-Command",
  "Set-Location -LiteralPath '$BackendDir'; & '$PythonExe' manage.py runserver 127.0.0.1:8000 --noreload"
)

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-Command",
  "Set-Location -LiteralPath '$FrontendDir'; npm.cmd run dev -- --host 127.0.0.1 --port 5173"
)

Write-Host "Backend:  http://127.0.0.1:8000/"
Write-Host "Frontend: http://127.0.0.1:5173/"
