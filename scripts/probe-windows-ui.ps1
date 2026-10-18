# Exercita o botao real da janela com token FICTICIO; nao configura nenhum bot.
$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'configure-windows.ps1') -Raw
$test = @'
$form.ShowInTaskbar = $false
$form.Opacity = 0
$form.Show()
$tokenBox.Text = '123456789:' + ('A' * 35)
$chatBox.Text = '1'
$activate.PerformClick()
$status.Text | Set-Content -LiteralPath (Join-Path $setupStateDir 'windows-ui-probe.txt') -Encoding UTF8
$form.Close()
'@
$source = $source.Replace('$null = $form.ShowDialog()', $test)
& ([scriptblock]::Create($source))
