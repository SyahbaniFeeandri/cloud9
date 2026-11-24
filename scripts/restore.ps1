#Requires -Version 5.1
<#
.SYNOPSIS
    Restore FinCloud dari backup yang dibuat oleh backup.ps1.

.DESCRIPTION
    Fitur keamanan:
      * Wajib -Force untuk restore yang menimpa data.
      * Otomatis membuat snapshot pra-restore (kecuali -SkipPreBackup).
      * Menyetop container backend agar tidak ada write selama restore.
      * Rollback otomatis ke snapshot bila restore gagal.
      * -VerifyOnly untuk menguji dump ke database scratch tanpa menyentuh
        database produksi.

.PARAMETER BackupPath
    Folder backup (mis. backups/20261107-020000). Gunakan -Latest untuk
    memilih backup terbaru.

.PARAMETER VerifyOnly
    Restore dump ke database scratch (default fincloud_restore_test), bandingkan
    row count dengan manifest, lalu hapus database scratch. Tidak menyentuh
    data produksi dan tidak butuh -Force.

.EXAMPLE
    .\scripts\restore.ps1 -Latest -Force

.EXAMPLE
    .\scripts\restore.ps1 -BackupPath .\backups\20261107-020000 -DatabaseOnly -Force

.EXAMPLE
    .\scripts\restore.ps1 -Latest -VerifyOnly
#>
[CmdletBinding()]
param(
    [string]$BackupPath,
    [switch]$Latest,
    [string]$OutputRoot,
    [string]$Database = 'fincloud_db',
    [string]$DbContainer = 'fincloud-mariadb',
    [string]$StorageContainer = 'fincloud-minio',
    [string]$Bucket = 'fincloud-receipts',
    [switch]$DatabaseOnly,
    [switch]$StorageOnly,
    [switch]$Force,
    [switch]$SkipPreBackup,
    [switch]$VerifyOnly,
    [string]$TargetDatabase = 'fincloud_restore_test'
)

$ErrorActionPreference = 'Stop'
$script:TempDb = '/tmp/fincloud_restore.sql.gz'
$script:TempStorage = '/tmp/fincloud_restore_receipts.tar.gz'
$script:ClientTool = $null

function Write-Step {
    param([string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR', 'OK')][string]$Level = 'INFO')
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
}

function Get-DockerOutput {
    param([string[]]$DockerArgs)
    $output = & docker @DockerArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah gagal (exit $LASTEXITCODE): docker $($DockerArgs -join ' ')`n$output"
    }
    return (($output | Out-String).Trim())
}

function Invoke-Docker {
    param([string[]]$DockerArgs)
    & docker @DockerArgs | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah gagal (exit $LASTEXITCODE): docker $($DockerArgs -join ' ')"
    }
}

function Test-ContainerRunning {
    param([string]$Name)
    $state = & docker inspect -f '{{.State.Running}}' $Name 2>$null
    return ($LASTEXITCODE -eq 0 -and "$state".Trim() -eq 'true')
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-Sql {
    param(
        [string]$Client,
        [string]$Sql,
        [string]$Db = ''
    )

    $remote = if ($Db) {
        "MYSQL_PWD=`$MARIADB_ROOT_PASSWORD $Client -uroot -N $Db"
    } else {
        "MYSQL_PWD=`$MARIADB_ROOT_PASSWORD $Client -uroot -N"
    }

    $output = $Sql | & docker exec -i $DbContainer sh -c $remote 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Query gagal (exit $LASTEXITCODE): $output"
    }
    return (($output | Out-String).Trim())
}

function Assert-Checksums {
    param([string]$Path)

    $sumFile = Join-Path $Path 'SHA256SUMS.txt'
    if (-not (Test-Path $sumFile)) {
        Write-Step 'SHA256SUMS.txt tidak ditemukan; verifikasi checksum dilewati.' 'WARN'
        return
    }

    foreach ($line in Get-Content -Path $sumFile) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split '\s+', 2
        if ($parts.Count -ne 2) { continue }
        $expected = $parts[0].Trim().ToLowerInvariant()
        $fileName = $parts[1].Trim()
        $filePath = Join-Path $Path $fileName
        if (-not (Test-Path $filePath)) {
            throw "File backup hilang: $fileName"
        }
        $actual = Get-Sha256 $filePath
        if ($actual -ne $expected) {
            throw "Checksum tidak cocok untuk $fileName (expected $expected, actual $actual)."
        }
        Write-Step "Checksum OK: $fileName"
    }
}

function Resolve-BackupFolder {
    if ($BackupPath) {
        $full = [System.IO.Path]::GetFullPath($BackupPath)
        if (-not (Test-Path $full)) { throw "Folder backup tidak ditemukan: $full" }
        return $full
    }

    if (-not $Latest) {
        throw 'Tentukan -BackupPath <folder> atau -Latest.'
    }

    if (-not $OutputRoot) {
        $OutputRoot = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot '..\backups' }
    }
    $OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

    $lastFile = Join-Path $OutputRoot 'last-backup.txt'
    if (Test-Path $lastFile) {
        $candidate = (Get-Content -Path $lastFile -Raw).Trim()
        if (Test-Path $candidate) { return $candidate }
    }

    $newest = Get-ChildItem -Path $OutputRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d{8}-\d{6}' } |
        Sort-Object Name -Descending |
        Select-Object -First 1

    if (-not $newest) { throw "Tidak ada backup di $OutputRoot." }
    return $newest.FullName
}

function Get-ClientTool {
    if ($script:ClientTool) { return $script:ClientTool }
    $script:ClientTool = Get-DockerOutput @(
        'exec', $DbContainer, 'sh', '-c',
        'if command -v mariadb >/dev/null 2>&1; then echo mariadb; elif command -v mysql >/dev/null 2>&1; then echo mysql; else echo MISSING; fi'
    )
    if ($script:ClientTool -eq 'MISSING') {
        throw "Tidak menemukan client 'mariadb'/'mysql' di container $DbContainer."
    }
    return $script:ClientTool
}

function Get-RowCounts {
    param([string]$Db)

    $client = Get-ClientTool
    $tables = @('users', 'transactions', 'categories', 'receipts', 'audit_logs')
    $sql = ($tables | ForEach-Object { "SELECT '$_', COUNT(*) FROM $_;" }) -join "`n"
    $raw = Invoke-Sql -Client $client -Sql $sql -Db $Db

    $counts = [ordered]@{}
    foreach ($line in ($raw -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $parts = $line -split "`t"
        if ($parts.Count -ge 2) {
            $counts[$parts[0].Trim()] = [int64]$parts[1].Trim()
        }
    }
    return $counts
}

function Compare-RowCounts {
    param($Expected, [string]$Db)

    $actual = Get-RowCounts -Db $Db
    $problems = @()
    foreach ($key in $Expected.PSObject.Properties.Name) {
        $want = [int64]$Expected.$key
        $got = [int64]$actual[$key]
        if ($want -ne $got) {
            $problems += "$key expected=$want actual=$got"
        }
    }
    return [pscustomobject]@{ Actual = $actual; Problems = $problems }
}

function Restore-Database {
    param([string]$Folder, [string]$Db)

    $dump = Join-Path $Folder 'fincloud_db.sql.gz'
    if (-not (Test-Path $dump)) { throw "Dump database tidak ditemukan: $dump" }

    $client = Get-ClientTool
    Write-Step "Menyalin dump ke container $DbContainer..."
    Invoke-Docker @('cp', $dump, ('{0}:{1}' -f $DbContainer, $script:TempDb))

    $check = Get-DockerOutput @('exec', $DbContainer, 'sh', '-c', "gzip -t $script:TempDb && echo OK")
    if ($check -ne 'OK') { throw 'Integritas gzip dump gagal.' }

    Write-Step "Membuat database '$Db' bila belum ada..."
    $createSql = 'CREATE DATABASE IF NOT EXISTS `{0}`;' -f $Db
    Invoke-Sql -Client $client -Sql $createSql

    Write-Step "Mengimpor dump ke '$Db'..."
    $importScript = "gzip -dc $script:TempDb | MYSQL_PWD=`$MARIADB_ROOT_PASSWORD $client -uroot $Db"
    Invoke-Docker @('exec', $DbContainer, 'sh', '-c', $importScript)

    Invoke-Docker @('exec', $DbContainer, 'rm', '-f', $script:TempDb)
    Write-Step "Restore database '$Db' selesai." 'OK'
}

function Restore-Storage {
    param([string]$Folder)

    $archive = Join-Path $Folder 'receipts.tar.gz'
    if (-not (Test-Path $archive)) {
        Write-Step 'Arsip receipts.tar.gz tidak ada; restore storage dilewati.' 'WARN'
        return
    }

    Write-Step "Mengekstrak arsip MinIO di host..."
    if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
        throw "Perintah 'tar' tidak ditemukan di host."
    }

    $staging = Join-Path ([System.IO.Path]::GetTempPath()) ('fincloud-restore-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null

    try {
        & tar -xzf $archive -C $staging
        if ($LASTEXITCODE -ne 0) { throw "Ekstraksi arsip MinIO gagal (exit $LASTEXITCODE)." }

        $extractedBucket = Join-Path $staging $Bucket
        if (-not (Test-Path $extractedBucket)) {
            throw "Folder '$Bucket' tidak ditemukan di dalam arsip."
        }

        Write-Step "Mengganti isi bucket '$Bucket'..."
        Invoke-Docker @('exec', $StorageContainer, 'rm', '-rf', ('/data/{0}' -f $Bucket))
        Invoke-Docker @('cp', $extractedBucket, ('{0}:/data/{1}' -f $StorageContainer, $Bucket))
    } finally {
        if (Test-Path $staging) { Remove-Item -Path $staging -Recurse -Force }
    }

    Write-Step "Restore bucket '$Bucket' selesai." 'OK'
}

function Stop-Backend {
    $wasRunning = Test-ContainerRunning 'fincloud-backend'
    if ($wasRunning) {
        Write-Step 'Menyetop container backend agar tidak ada write selama restore...'
        Invoke-Docker @('stop', 'fincloud-backend')
    } else {
        Write-Step 'Container backend sudah berhenti.' 'WARN'
    }
    return $wasRunning
}

function Start-Backend {
    param([bool]$WasRunning)

    if (-not $WasRunning) { return }
    Write-Step 'Menjalankan kembali container backend...'
    Invoke-Docker @('start', 'fincloud-backend')

    for ($i = 1; $i -le 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                Write-Step 'Backend sehat (health check 200).' 'OK'
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    Write-Step 'Backend belum merespons health check setelah 60 detik.' 'WARN'
}

function Invoke-VerifyOnly {
    param([string]$Folder)

    if ($TargetDatabase -eq $Database) {
        throw "TargetDatabase tidak boleh sama dengan database produksi ($Database)."
    }

    Write-Step "Mode verifikasi: restore ke database scratch '$TargetDatabase'."
    Assert-Checksums -Path $Folder

    $client = Get-ClientTool
    $dump = Join-Path $Folder 'fincloud_db.sql.gz'
    Invoke-Docker @('cp', $dump, ('{0}:{1}' -f $DbContainer, $script:TempDb))

    $check = Get-DockerOutput @('exec', $DbContainer, 'sh', '-c', "gzip -t $script:TempDb && echo OK")
    if ($check -ne 'OK') { throw 'Integritas gzip dump gagal.' }

    $dropCreate = 'DROP DATABASE IF EXISTS `{0}`; CREATE DATABASE `{0}`;' -f $TargetDatabase
    Invoke-Sql -Client $client -Sql $dropCreate

    $importScript = "gzip -dc $script:TempDb | MYSQL_PWD=`$MARIADB_ROOT_PASSWORD $client -uroot $TargetDatabase"
    Invoke-Docker @('exec', $DbContainer, 'sh', '-c', $importScript)

    $manifestPath = Join-Path $Folder 'manifest.json'
    $problems = @()
    if (Test-Path $manifestPath) {
        $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
        $comparison = Compare-RowCounts -Expected $manifest.rowCounts -Db $TargetDatabase
        $problems = $comparison.Problems
    } else {
        Write-Step 'manifest.json tidak ada; perbandingan row count dilewati.' 'WARN'
    }

    $dropSql = 'DROP DATABASE IF EXISTS `{0}`;' -f $TargetDatabase
    Invoke-Sql -Client $client -Sql $dropSql
    Invoke-Docker @('exec', $DbContainer, 'rm', '-f', $script:TempDb)

    if ($problems.Count -gt 0) {
        Write-Step ("Verifikasi GAGAL: {0}" -f ($problems -join '; ')) 'ERROR'
        exit 1
    }

    Write-Step 'Verifikasi restore database OK (row count cocok dengan manifest).' 'OK'

    if (-not $DatabaseOnly) {
        $archive = Join-Path $Folder 'receipts.tar.gz'
        if (Test-Path $archive) {
            & tar -tzf $archive > $null
            if ($LASTEXITCODE -ne 0) { throw 'Integritas arsip MinIO gagal.' }
            Write-Step 'Verifikasi arsip MinIO OK.' 'OK'
        }
    }

    Write-Host ''
    Write-Host 'VERIFY OK'
    exit 0
}

try {
    if ($DatabaseOnly -and $StorageOnly) {
        throw 'Pilih salah satu: -DatabaseOnly atau -StorageOnly.'
    }

    $folder = Resolve-BackupFolder

    if (-not (Test-Path (Join-Path $folder 'fincloud_db.sql.gz')) -and -not $StorageOnly) {
        throw "File fincloud_db.sql.gz tidak ada di $folder."
    }

    if ($VerifyOnly) {
        Invoke-VerifyOnly -Folder $folder
    }

    if (-not $Force) {
        throw 'Restore menimpa data. Jalankan ulang dengan -Force setelah yakin.'
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI tidak ditemukan di PATH.'
    }
    if (-not (Test-ContainerRunning $DbContainer) -and -not $StorageOnly) {
        throw "Container '$DbContainer' tidak berjalan."
    }
    if (-not (Test-ContainerRunning $StorageContainer) -and -not $DatabaseOnly) {
        throw "Container '$StorageContainer' tidak berjalan."
    }

    Write-Step "Backup sumber: $folder"
    Assert-Checksums -Path $folder

    # ---------------------------------------------------------- pre-restore
    $preBackup = $null
    if (-not $SkipPreBackup) {
        $backupScript = Join-Path $PSScriptRoot 'backup.ps1'
        if (-not (Test-Path $backupScript)) {
            throw "backup.ps1 tidak ditemukan di $PSScriptRoot."
        }
        if (-not $OutputRoot) {
            $OutputRoot = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot '..\backups' }
        }
        Write-Step 'Membuat snapshot pra-restore...'
        & $backupScript -OutputRoot $OutputRoot -RetentionDays 0
        if ($LASTEXITCODE -ne 0) {
            throw 'Snapshot pra-restore gagal; restore dibatalkan.'
        }
        $lastFile = Join-Path ([System.IO.Path]::GetFullPath($OutputRoot)) 'last-backup.txt'
        if (Test-Path $lastFile) {
            $preBackup = (Get-Content -Path $lastFile -Raw).Trim()
            Write-Step "Snapshot pra-restore: $preBackup"
        }
    } else {
        Write-Step 'Snapshot pra-restore dilewati (-SkipPreBackup).' 'WARN'
    }

    $wasRunning = Stop-Backend

    try {
        if (-not $StorageOnly) {
            Restore-Database -Folder $folder -Db $Database
        }
        if (-not $DatabaseOnly) {
            Restore-Storage -Folder $folder
        }

        $manifestPath = Join-Path $folder 'manifest.json'
        if ((Test-Path $manifestPath) -and (-not $StorageOnly)) {
            $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
            $comparison = Compare-RowCounts -Expected $manifest.rowCounts -Db $Database
            if ($comparison.Problems.Count -gt 0) {
                throw ("Row count pasca-restore tidak cocok: {0}" -f ($comparison.Problems -join '; '))
            }
            Write-Step 'Row count pasca-restore cocok dengan manifest.' 'OK'
        }

        Start-Backend -WasRunning $wasRunning

        Write-Host ''
        Write-Host ("RESTORE OK -> {0}" -f $folder) -ForegroundColor Green
        exit 0
    } catch {
        Write-Step ("Restore gagal: {0}" -f $_.Exception.Message) 'ERROR'

        if ($preBackup -and (Test-Path $preBackup)) {
            Write-Step 'Melakukan rollback ke snapshot pra-restore...' 'WARN'
            try {
                if (-not $StorageOnly) { Restore-Database -Folder $preBackup -Db $Database }
                if (-not $DatabaseOnly) { Restore-Storage -Folder $preBackup }
                Write-Step 'Rollback selesai.' 'OK'
            } catch {
                Write-Step ("Rollback juga gagal: {0}" -f $_.Exception.Message) 'ERROR'
            }
        }

        Start-Backend -WasRunning $wasRunning
        exit 1
    }
} catch {
    Write-Step ("Restore GAGAL: {0}" -f $_.Exception.Message) 'ERROR'
    exit 1
}
