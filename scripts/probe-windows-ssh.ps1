# Diagnostico sem token: executa no mesmo contexto da janela grafica.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$state = Join-Path $root 'state'
New-Item -ItemType Directory -Path $state -Force | Out-Null
$result = @{ user = [Environment]::UserName; profile = $env:USERPROFILE; status = 'inicio' }
try {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = 'ssh.exe'
    $info.Arguments = '-T -o BatchMode=yes -o ConnectTimeout=15 root@91.107.207.165 echo SSH_OK'
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $child = New-Object System.Diagnostics.Process
    $child.StartInfo = $info
    $null = $child.Start()
    $child.StandardInput.Close()
    $outTask = $child.StandardOutput.ReadToEndAsync()
    $errTask = $child.StandardError.ReadToEndAsync()
    if (-not $child.WaitForExit(25000)) { $child.Kill(); throw 'Timeout SSH' }
    $result.code = $child.ExitCode
    $result.stdout = $outTask.GetAwaiter().GetResult()
    $result.stderr = $errTask.GetAwaiter().GetResult()
    $result.status = 'concluido'
    $child.Dispose()
} catch { $result.status = 'erro'; $result.erro = $_.Exception.Message }
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $state 'windows-ssh-probe.json') -Encoding UTF8
