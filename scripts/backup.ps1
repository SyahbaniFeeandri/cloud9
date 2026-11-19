#Requires -Version 5.1
<#
.SYNOPSIS
    Backup otomatis FinCloud: MariaDB (mariadb-dump/mysqldump) + bucket MinIO.

.DESCRIPTION
    Membuat backup konsisten ke folder bertimestamp:

        backups/YYYYMMDD-HHMMSS/
        ├── fincloud_db.sql.gz
        ├── receipts.tar.gz          (opsional, kecuali -SkipStorage)
        ├── manifest.json
        ├── SHA256SUMS.txt
        └── backup.log

    Dump dilakukan DI DALAM container lalu di-copy dengan `docker cp` agar
    aman dari masalah encoding pipe PowerShell. Password tidak pernah
    dikirim lewat command line host: script memakai environment container
    (`MARIADB_ROOT_PASSWORD`).

.PARAMETER OutputRoot
    Folder tujuan backup. Default: $env:BACKUP_DIR atau <repo>/backups.

.PARAMETER RetentionDays
    Hapus backup lebih lama dari N hari. Default 7. Isi 0 untuk menonaktifkan.

.EXAMPLE
    .\scripts\backup.ps1

.EXAMPLE
    .\scripts\backup.ps1 -OutputRoot D:\backups\fincloud -RetentionDays 14

.EXAMPLE
    .\scripts\backup.ps1 -SkipStorage -DryRun
#>
[CmdletBinding()]
param(
    [string]$OutputRoot,
    [string]$Database = 'fincloud_db',
    [string]$DbContainer = 'fincloud-mariadb',
    [string]$StorageContainer = 'fincloud-minio',
    [string]$Bucket = 'fincloud-receipts',
    [int]$RetentionDays = 7,
    [string]$MetricsDir,
    [switch]$SkipStorage,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$script:BackupDir = $null
$script:LogFile = $null
$script:TempDb = '/tmp/fincloud_db.sql.gz'
$script:TempStorage = '/tmp/fincloud_receipts.tar.gz'

if (-not $MetricsDir) {
    $MetricsDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'infra/node-exporter/textfile'
}

function Write-Log {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'OK')]
        [string]$Level = 'INFO'
    )

    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
    if ($script:LogFile) {
        Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
    }
}

function Invoke-Docker {
    param([string[]]$DockerArgs)

    & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah gagal (exit $LASTEXITCODE): docker $($DockerArgs -join ' ')"
    }
}

function Get-DockerOutput {
    param([string[]]$DockerArgs)

    $output = & docker @DockerArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Perintah gagal (exit $LASTEXITCODE): docker $($DockerArgs -join ' ')`n$output"
    }
    return (($output | Out-String).Trim())
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

function Format-Size {
    param([int64]$Bytes)
    if ($Bytes -ge 1MB) { return ('{0:N2} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N2} KB' -f ($Bytes / 1KB)) }
    return ('{0} B' -f $Bytes)
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

function Write-BackupMetrics {
    param(
        [ValidateSet(0, 1)]
        [int]$Success,
        [double]$Timestamp = 0,
        [double]$DurationSeconds = 0,
        [int64]$SizeBytes = 0
    )

    if (-not $MetricsDir) { return }
    $target = Join-Path $MetricsDir 'fincloud_backup.prom'

    try {
        if (-not (Test-Path -LiteralPath $MetricsDir)) {
            New-Item -ItemType Directory -Path $MetricsDir -Force | Out-Null
        }

        # Preserve the last known successful values when recording a failed attempt.
        $lastSuccess = 0
        $lastDuration = 0
        $lastSize = 0
        if (Test-Path -LiteralPath $target) {
            $readGauge = {
                param([string]$Name)
                $m = Select-String -Path $target -Pattern ("^" + $Name + "\s+([0-9.eE+\-]+)") -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if ($m) {
                    return [double]::Parse($m.Matches[0].Groups[1].Value, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture)
                }
                return 0
            }
            $lastSuccess = & $readGauge 'fincloud_backup_last_success_timestamp_seconds'
            $lastDuration = & $readGauge 'fincloud_backup_last_duration_seconds'
            $lastSize = & $readGauge 'fincloud_backup_last_size_bytes'
        }
        if ($Success -eq 1) {
            if ($Timestamp -gt 0) { $lastSuccess = $Timestamp }
            $lastDuration = $DurationSeconds
            $lastSize = $SizeBytes
        }

        $content = @(
            '# HELP fincloud_backup_last_success_timestamp_seconds Unix timestamp of the last successful FinCloud backup.'
            '# TYPE fincloud_backup_last_success_timestamp_seconds gauge'
            ('fincloud_backup_last_success_timestamp_seconds {0:F0}' -f $lastSuccess)
            '# HELP fincloud_backup_last_attempt_success Whether the most recent backup attempt succeeded (1) or failed (0).'
            '# TYPE fincloud_backup_last_attempt_success gauge'
            ('fincloud_backup_last_attempt_success {0}' -f $Success)
            '# HELP fincloud_backup_last_duration_seconds Duration of the most recent successful backup.'
            '# TYPE fincloud_backup_last_duration_seconds gauge'
            ('fincloud_backup_last_duration_seconds {0:F2}' -f $lastDuration)
            '# HELP fincloud_backup_last_size_bytes Size of the most recent successful database dump.'
            '# TYPE fincloud_backup_last_size_bytes gauge'
            ('fincloud_backup_last_size_bytes {0:F0}' -f $lastSize)
        )

        # Write to a temp file first so node-exporter never reads a partial file.
        # Use LF line endings: the Prometheus text format rejects CRLF.
        $temp = Join-Path $MetricsDir 'fincloud_backup.prom.tmp'
        $payload = (($content -join "`n") + "`n")
        [System.IO.File]::WriteAllText($temp, $payload, [System.Text.Encoding]::ASCII)
        Move-Item -Path $temp -Destination $target -Force
    } catch {
        Write-Log ("Metrik backup tidak dapat ditulis: {0}" -f $_.Exception.Message) 'WARN'
    }
}

function Get-RowCounts {
    param([string]$Client, [string]$Db)

    $tables = @('users', 'transactions', 'categories', 'receipts', 'audit_logs')
    $sql = ($tables | ForEach-Object { "SELECT '$_', COUNT(*) FROM $_;" }) -join "`n"
    $raw = Invoke-Sql -Client $Client -Sql $sql -Db $Db

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

function Remove-OldBackups {
    param([string]$Root, [int]$Days, [string]$KeepPath)

    if ($Days -le 0) {
        Write-Log 'Retensi dinonaktifkan (RetentionDays=0).'
        return
    }

    $cutoff = (Get-Date).AddDays(-$Days)
    $candidates = Get-ChildItem -Path $Root -Directory |
        Where-Object {
            $_.Name -match '^\d{8}-\d{6}$' -and
            $_.LastWriteTime -lt $cutoff -and
            $_.FullName -ne $KeepPath
        } |
        Sort-Object Name

    if (-not $candidates) {
        Write-Log "Tidak ada backup lebih lama dari $Days hari."
        return
    }

    foreach ($dir in $candidates) {
        if ($DryRun) {
            Write-Log "[DryRun] Akan menghapus backup lama: $($dir.FullName)"
            continue
        }
        try {
            Remove-Item -Path $dir.FullName -Recurse -Force
            Write-Log "Backup lama dihapus: $($dir.Name)"
        } catch {
            Write-Log "Gagal menghapus $($dir.FullName): $($_.Exception.Message)" 'WARN'
        }
    }
}

$startedAt = Get-Date

try {
    # ---------------------------------------------------------------- config
    if (-not $OutputRoot) {
        $OutputRoot = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { Join-Path $PSScriptRoot '..\backups' }
    }
    if (-not $PSBoundParameters.ContainsKey('RetentionDays') -and $env:BACKUP_RETENTION_DAYS) {
        $RetentionDays = [int]$env:BACKUP_RETENTION_DAYS
    }
    $OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)

    Write-Log "FinCloud backup dimulai. Output: $OutputRoot"
    Write-Log "Database=$Database | DbContainer=$DbContainer | Bucket=$Bucket"

    # ------------------------------------------------------------- preflight
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI tidak ditemukan di PATH.'
    }

    $dockerVersion = Get-DockerOutput @('version', '--format', '{{.Server.Version}}')
    Write-Log "Docker daemon terdeteksi (server $dockerVersion)."

    if (-not (Test-ContainerRunning $DbContainer)) {
        throw "Container '$DbContainer' tidak berjalan. Jalankan: docker compose up -d mariadb"
    }
    if (-not $SkipStorage -and -not (Test-ContainerRunning $StorageContainer)) {
        throw "Container '$StorageContainer' tidak berjalan. Jalankan: docker compose up -d minio"
    }

    $dumpTool = Get-DockerOutput @(
        'exec', $DbContainer, 'sh', '-c',
        'if command -v mariadb-dump >/dev/null 2>&1; then echo mariadb-dump; elif command -v mysqldump >/dev/null 2>&1; then echo mysqldump; else echo MISSING; fi'
    )
    if ($dumpTool -eq 'MISSING') {
        throw "Tidak menemukan 'mariadb-dump' maupun 'mysqldump' di container $DbContainer."
    }
    Write-Log "Tool dump: $dumpTool"

    $clientTool = Get-DockerOutput @(
        'exec', $DbContainer, 'sh', '-c',
        'if command -v mariadb >/dev/null 2>&1; then echo mariadb; elif command -v mysql >/dev/null 2>&1; then echo mysql; else echo MISSING; fi'
    )
    if ($clientTool -eq 'MISSING') {
        throw "Tidak menemukan client 'mariadb'/'mysql' di container $DbContainer."
    }
    Write-Log "Client database: $clientTool"

    # Pastikan database bisa diakses.
    $null = Invoke-Sql -Client $clientTool -Sql 'SELECT 1;' -Db $Database
    Write-Log "Koneksi database '$Database' OK."

    if ($DryRun) {
        Write-Log '[DryRun] Preflight selesai. Tidak ada file yang dibuat.' 'OK'
        exit 0
    }

    # ---------------------------------------------------------------- folders
    if (-not (Test-Path -Path $OutputRoot)) {
        New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $script:BackupDir = Join-Path $OutputRoot $stamp
    $suffix = 1
    while (Test-Path -Path $script:BackupDir) {
        $script:BackupDir = Join-Path $OutputRoot ("{0}-{1}" -f $stamp, $suffix)
        $suffix += 1
    }
    New-Item -ItemType Directory -Path $script:BackupDir -Force | Out-Null
    $script:LogFile = Join-Path $script:BackupDir 'backup.log'

    $dbTarget = Join-Path $script:BackupDir 'fincloud_db.sql.gz'
    $storageTarget = Join-Path $script:BackupDir 'receipts.tar.gz'

    Write-Log "Folder backup: $script:BackupDir"

    # -------------------------------------------------------------- database
    Write-Log 'Membuat dump database (single-transaction)...'
    $dumpScript = "MYSQL_PWD=`$MARIADB_ROOT_PASSWORD $dumpTool -uroot --single-transaction --quick --routines --triggers --events --hex-blob --default-character-set=utf8mb4 $Database > /tmp/fincloud_db.sql && gzip -9 -c /tmp/fincloud_db.sql > $script:TempDb && rm -f /tmp/fincloud_db.sql"
    Invoke-Docker @('exec', $DbContainer, 'sh', '-c', $dumpScript)

    $gzipCheck = Get-DockerOutput @('exec', $DbContainer, 'sh', '-c', "gzip -t $script:TempDb && echo OK")
    if ($gzipCheck -ne 'OK') {
        throw 'Verifikasi gzip dump database gagal.'
    }

    Invoke-Docker @('cp', ('{0}:{1}' -f $DbContainer, $script:TempDb), $dbTarget)
    Invoke-Docker @('exec', $DbContainer, 'rm', '-f', $script:TempDb)

    $dbSize = (Get-Item -Path $dbTarget).Length
    $dbSha = Get-Sha256 $dbTarget
    Write-Log ("Dump database OK: {0} | SHA256 {1}" -f (Format-Size $dbSize), $dbSha)

    $rowCounts = Get-RowCounts -Client $clientTool -Db $Database
    $rowSummary = ($rowCounts.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
    Write-Log "Row counts: $rowSummary"

    # --------------------------------------------------------------- storage
    $storageIncluded = $false
    $storageSize = $null
    $storageSha = $null

    if ($SkipStorage) {
        Write-Log 'Backup MinIO dilewati (-SkipStorage).' 'WARN'
    } else {
        Write-Log 'Membuat arsip bucket MinIO...'

        if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
            throw "Perintah 'tar' tidak ditemukan di host. Diperlukan untuk mengarsipkan struk."
        }

        $bucketExists = Get-DockerOutput @('exec', $StorageContainer, 'sh', '-c', ('test -d /data/{0} && echo yes || echo no' -f $Bucket))
        if ($bucketExists -eq 'yes') {
            $staging = Join-Path $script:BackupDir $Bucket

            if (Test-Path $staging) { Remove-Item -Path $staging -Recurse -Force }
            Invoke-Docker @('cp', ('{0}:/data/{1}' -f $StorageContainer, $Bucket), $staging)

            & tar -czf $storageTarget -C $script:BackupDir $Bucket
            if ($LASTEXITCODE -ne 0) {
                throw "Pembuatan arsip MinIO gagal (exit $LASTEXITCODE)."
            }

            & tar -tzf $storageTarget > $null
            if ($LASTEXITCODE -ne 0) {
                throw 'Verifikasi arsip MinIO gagal.'
            }

            Remove-Item -Path $staging -Recurse -Force

            $storageIncluded = $true
            $storageSize = (Get-Item -Path $storageTarget).Length
            $storageSha = Get-Sha256 $storageTarget
            Write-Log ("Arsip MinIO OK: {0} | SHA256 {1}" -f (Format-Size $storageSize), $storageSha)
        } else {
            Write-Log "Bucket '$Bucket' belum ada; backup storage dilewati." 'WARN'
        }
    }

    # -------------------------------------------------------------- manifest
    $completedAt = Get-Date
    $manifest = [ordered]@{
        backupVersion   = 1
        createdAt       = $completedAt.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
        host            = $env:COMPUTERNAME
        database        = $Database
        dbContainer     = $DbContainer
        dbDumpTool      = $dumpTool
        dbDumpFile      = 'fincloud_db.sql.gz'
        dbDumpSizeBytes = $dbSize
        dbDumpSha256    = $dbSha
        storage         = [ordered]@{
            included  = $storageIncluded
            bucket    = $Bucket
            file      = if ($storageIncluded) { 'receipts.tar.gz' } else { $null }
            sizeBytes = $storageSize
            sha256    = $storageSha
        }
        rowCounts       = $rowCounts
        retentionDays   = $RetentionDays
        durationSeconds = [math]::Round(($completedAt - $startedAt).TotalSeconds, 2)
        status          = 'success'
    }

    $manifestPath = Join-Path $script:BackupDir 'manifest.json'
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding UTF8

    $sums = @()
    $sums += ('{0}  {1}' -f $dbSha, 'fincloud_db.sql.gz')
    if ($storageIncluded) {
        $sums += ('{0}  {1}' -f $storageSha, 'receipts.tar.gz')
    }
    $sums | Set-Content -Path (Join-Path $script:BackupDir 'SHA256SUMS.txt') -Encoding ASCII

    $script:BackupDir | Set-Content -Path (Join-Path $OutputRoot 'last-backup.txt') -Encoding UTF8

    Write-BackupMetrics -Success 1 `
        -Timestamp ([DateTimeOffset]$completedAt).ToUnixTimeSeconds() `
        -DurationSeconds $manifest.durationSeconds `
        -SizeBytes ([int64]$dbSize)

    Write-Log ("Backup selesai dalam {0:N2} detik." -f $manifest.durationSeconds) 'OK'

    # -------------------------------------------------------------- retention
    Remove-OldBackups -Root $OutputRoot -Days $RetentionDays -KeepPath $script:BackupDir

    Write-Host ''
    Write-Host ("BACKUP OK -> {0}" -f $script:BackupDir)
    exit 0
} catch {
    Write-Log ("Backup GAGAL: {0}" -f $_.Exception.Message) 'ERROR'
    Write-BackupMetrics -Success 0
    if ($script:BackupDir -and (Test-Path $script:BackupDir)) {
        Write-Host ("Artefak parsial: {0}" -f $script:BackupDir)
    }
    exit 1
}
