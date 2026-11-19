#Requires -Version 5.1
<#
.SYNOPSIS
    Mendaftarkan backup FinCloud harian ke Windows Task Scheduler.

.DESCRIPTION
    Membuat scheduled task yang menjalankan scripts/backup.ps1 setiap hari.
    Task berjalan sebagai user saat ini dan hanya ketika user login. Untuk
    server produksi (Linux), gunakan cron/systemd timer — contohnya ada di
    docs/23-sop-backup-recovery.md.

.PARAMETER Time
    Jam eksekusi format HH:mm (24 jam). Default 02:00.

.PARAMETER RetentionDays
    Diteruskan ke backup.ps1. Default 7.

.EXAMPLE
    .\scripts\install-backup-task.ps1

.EXAMPLE
    .\scripts\install-backup-task.ps1 -Time 01:30 -RetentionDays 14

.EXAMPLE
    .\scripts\install-backup-task.ps1 -Unregister
#>
[CmdletBinding()]
param(
    [string]$TaskName = 'FinCloud-Backup',
    [string]$Time = '02:00',
    [int]$RetentionDays = 7,
    [string]$OutputRoot,
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

try {
    if ($Unregister) {
        $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if (-not $existing) {
            Write-Host "Task '$TaskName' tidak ditemukan."
            exit 0
        }
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Task '$TaskName' dihapus."
        exit 0
    }

    $backupScript = Join-Path $PSScriptRoot 'backup.ps1'
    if (-not (Test-Path $backupScript)) {
        throw "backup.ps1 tidak ditemukan di $PSScriptRoot."
    }

    try {
        $triggerTime = [datetime]::ParseExact($Time, 'HH:mm', [System.Globalization.CultureInfo]::InvariantCulture)
    } catch {
        throw "Format -Time harus HH:mm (contoh 02:00)."
    }

    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -RetentionDays $RetentionDays"
    if ($OutputRoot) {
        $resolved = [System.IO.Path]::GetFullPath($OutputRoot)
        $arguments += " -OutputRoot `"$resolved`""
    }

    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -DontStopOnIdleEnd `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2)

    if (-not (Test-IsAdmin)) {
        Write-Warning 'Menjalankan tanpa hak Administrator. Jika registrasi gagal, buka PowerShell as Administrator.'
    }

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description 'FinCloud daily backup (MariaDB + MinIO receipts)' `
        -Force | Out-Null

    Write-Host "Task '$TaskName' terdaftar. Jadwal: setiap hari $Time." -ForegroundColor Green
    Write-Host "Aksi: powershell.exe $arguments"
    Write-Host ''
    Write-Host 'Verifikasi:'
    Write-Host ("  Get-ScheduledTask -TaskName '{0}' | Get-ScheduledTaskInfo" -f $TaskName)
    Write-Host ("  Start-ScheduledTask -TaskName '{0}'" -f $TaskName)
    Write-Host ("  Unregister: .\scripts\install-backup-task.ps1 -Unregister")
    exit 0
} catch {
    Write-Error ("Gagal mendaftarkan task: {0}" -f $_.Exception.Message)
    exit 1
}
