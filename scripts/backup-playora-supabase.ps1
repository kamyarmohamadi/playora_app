# Playora Free-plan Supabase logical backup
# Run from the repository root in PowerShell 7+.
# This exports roles, the public/auth schema and data to a private local folder.
# It does NOT modify the remote database and does NOT upload backup files to GitHub.

$ErrorActionPreference = "Stop"
$ProjectRef = "nnowvfewtrfurnluhflt"
$BackupRoot = if ($env:PLAYORA_BACKUP_ROOT) { $env:PLAYORA_BACKUP_ROOT } else { Join-Path $HOME "Playora-Backups" }
$Timestamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
$BackupDir = Join-Path $BackupRoot "$ProjectRef-$Timestamp"
$RepoRoot = Split-Path -Parent $PSScriptRoot

$Supabase = Get-Command "supabase" -ErrorAction SilentlyContinue
if (-not $Supabase) {
    throw "Supabase CLI not found. Install it using the official Supabase CLI guide, then sign in with 'supabase login'."
}
$Docker = Get-Command "docker" -ErrorAction SilentlyContinue
if (-not $Docker) {
    throw "Docker CLI not found. Supabase db dump uses a Docker container."
}

Push-Location $RepoRoot
try {
    if (-not (Test-Path (Join-Path $RepoRoot "supabase/config.toml"))) {
        throw "Run this script from a complete Playora repository checkout."
    }

    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    Write-Host "Supabase CLI:"
    & supabase --version
    if ($LASTEXITCODE -ne 0) { throw "Could not read Supabase CLI version." }

    Write-Host "Checking Docker engine..."
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker engine is not running." }

    # Each command targets this exact remote project. No connection string or
    # database password is printed, embedded in this script, or committed.
    Write-Host "Exporting custom roles..."
    & supabase db dump "--remote=$ProjectRef" --role-only --file (Join-Path $BackupDir "roles.sql")
    if ($LASTEXITCODE -ne 0) { throw "Role export failed." }

    Write-Host "Exporting auth and public schema..."
    & supabase db dump "--remote=$ProjectRef" --schema=auth,public --file (Join-Path $BackupDir "schema.sql")
    if ($LASTEXITCODE -ne 0) { throw "Schema export failed." }

    Write-Host "Exporting auth and public data..."
    & supabase db dump "--remote=$ProjectRef" --schema=auth,public --data-only --use-copy --file (Join-Path $BackupDir "data.sql")
    if ($LASTEXITCODE -ne 0) { throw "Data export failed." }

    foreach ($FileName in @("schema.sql", "data.sql")) {
        $FilePath = Join-Path $BackupDir $FileName
        if (-not (Test-Path $FilePath) -or (Get-Item $FilePath).Length -lt 100) {
            throw "$FileName is missing or unexpectedly small. Do not treat this as a verified backup."
        }
    }

    $Manifest = @(
        "Project: $ProjectRef",
        "Created UTC: $Timestamp",
        "Supabase CLI: $(& supabase --version)",
        "Included schemas: auth, public",
        "Included custom roles: yes",
        "Storage buckets/objects at audit time: 0 / 0",
        "Storage API objects are not part of this database dump.",
        "Do not commit this directory to Git."
    )
    $Manifest | Set-Content -Path (Join-Path $BackupDir "MANIFEST.txt") -Encoding utf8

    Get-ChildItem -Path $BackupDir -File |
        Where-Object { $_.Name -ne "SHA256SUMS.txt" } |
        ForEach-Object {
            $Hash = Get-FileHash -Path $_.FullName -Algorithm SHA256
            "$($Hash.Hash.ToLower())  $($_.Name)"
        } |
        Set-Content -Path (Join-Path $BackupDir "SHA256SUMS.txt") -Encoding ascii

    Write-Host ""
    Write-Host "Backup exports completed:"
    Write-Host $BackupDir
    Write-Host ""
    Write-Host "IMPORTANT: store this folder outside the repository, preferably on encrypted storage."
    Write-Host "A successful export is not a verified restore. A restore test is still required."
}
finally {
    Pop-Location
}
