param([Parameter(Mandatory=$true)][string]$Version,[switch]$DisposableVM)
$ErrorActionPreference='Stop'
# Run exclusively on a disposable Windows VM, never on a user's active installation.
if (-not $DisposableVM) { throw 'Disposable Windows VM required; pass -DisposableVM only in a clean VM' }
$program=Join-Path $env:LOCALAPPDATA 'Programs\wset-editor'
$legacyProgram=Join-Path $env:LOCALAPPDATA 'Programs\WSET'
$bootstrap=Join-Path $env:APPDATA 'WSET'
if ((Test-Path $program) -or (Test-Path $legacyProgram) -or (Test-Path $bootstrap)) { throw 'Expected clean Windows runner' }
$installer=(Resolve-Path "dist/WSET-Setup-$Version.exe").Path
$workspace=Join-Path $env:TEMP ('WSET-workspace-fixture-'+[guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $workspace | Out-Null
foreach($dir in 'Projects','Templates','Modules','Backups','Exports','Archive','Settings','System') {
  New-Item -ItemType Directory -Path (Join-Path $workspace $dir) | Out-Null
  Set-Content -LiteralPath (Join-Path $workspace "$dir\sentinel.txt") -Value "Never replace $dir"
}
New-Item -ItemType Directory -Path $bootstrap | Out-Null
@{schema=1;root=$workspace} | ConvertTo-Json | Set-Content -Encoding utf8NoBOM (Join-Path $bootstrap 'wset-workspace-location.json')
function Snapshot {
  @(Get-ChildItem -LiteralPath $workspace -File -Recurse | Sort-Object FullName | ForEach-Object { "$($_.FullName):$((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)" }) -join "`n"
}
$before=Snapshot
$pointerHash=(Get-FileHash (Join-Path $bootstrap 'wset-workspace-location.json')).Hash
function Run-Checked($file,$argsList,$wantFailure=$false) {
  $p=Start-Process -FilePath $file -ArgumentList $argsList -PassThru
  if (-not $p.WaitForExit(180000)) { $p.Kill(); throw "Timed out: $file" }
  if ($wantFailure) { if ($p.ExitCode -eq 0) { throw 'Expected installer rejection' } }
  elseif ($p.ExitCode -ne 0) { throw "Failed: $file ($($p.ExitCode))" }
}
# An explicit /D must not be able to point the installer at the workspace.
Run-Checked $installer @('/S',"/D=$workspace") $true
if ((Snapshot) -ne $before) { throw 'Rejected install changed workspace' }
# An unowned legacy directory must not be accepted as an alternate target.
Run-Checked $installer @('/S',"/D=$legacyProgram") $true
if ((Snapshot) -ne $before) { throw 'Rejected legacy install changed workspace' }
Run-Checked $installer @('/S')
$exe=Join-Path $program 'WSET.exe'
if (-not (Test-Path $exe)) { throw 'Installed executable missing' }
Run-Checked $exe @('--wset-packaging-smoke')
# Reinstall exactly the same build to exercise the NSIS replacement path, not the future updater.
Run-Checked $installer @('/S')
Run-Checked $exe @('--wset-packaging-smoke')
if ((Snapshot) -ne $before) { throw 'Installer changed workspace' }
if ((Get-FileHash (Join-Path $bootstrap 'wset-workspace-location.json')).Hash -ne $pointerHash) { throw 'Installer changed workspace pointer' }
Write-Host 'Windows installer and reinstall smoke passed, workspace file hashes preserved.'
