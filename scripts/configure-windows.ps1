# Interface local: o token permanece na memoria e entra no SSH apenas por stdin.
# Execute com powershell.exe -NoProfile -STA -File scripts/configure-windows.ps1.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
$setupStateDir = [IO.Path]::Combine([Environment]::GetFolderPath('UserProfile'), 'projetos', 'inemaccbot', 'state')
$null = [IO.Directory]::CreateDirectory($setupStateDir)
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Configurar INEMACCBOT'
$form.Size = New-Object System.Drawing.Size(660, 565)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

function New-Label($text, $x, $y, $width, $height) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $text
    $label.SetBounds($x, $y, $width, $height)
    $form.Controls.Add($label)
    return $label
}

$null = New-Label '1. Cole o NOVO token do BotFather no campo abaixo.' 20 20 600 26
$tokenBox = New-Object System.Windows.Forms.TextBox
$tokenBox.SetBounds(20, 52, 500, 30)
$tokenBox.UseSystemPasswordChar = $true
$tokenBox.ShortcutsEnabled = $true
$form.Controls.Add($tokenBox)
$paste = New-Object System.Windows.Forms.Button
$paste.Text = 'Colar'
$paste.SetBounds(530, 50, 90, 32)
$form.Controls.Add($paste)
$paste.Add_Click({
    if ([System.Windows.Forms.Clipboard]::ContainsText()) {
        $tokenBox.Text = [System.Windows.Forms.Clipboard]::GetText().Trim()
        $tokenBox.Focus()
    }
})
$count = New-Label 'Campo vazio. Voce pode usar Ctrl+V ou o botao Colar.' 20 88 600 25
$tokenBox.Add_TextChanged({
    $count.Text = 'Caracteres preenchidos: ' + $tokenBox.Text.Length
    $chatList.Items.Clear()
    $chatBox.Clear()
})
$null = New-Label '2. Envie /start ao seu bot no Telegram e clique abaixo.' 20 126 600 26
$find = New-Object System.Windows.Forms.Button
$find.Text = 'Validar token e localizar meu chat'
$find.SetBounds(20, 158, 330, 35)
$form.Controls.Add($find)
$chatList = New-Object System.Windows.Forms.ListBox
$chatList.SetBounds(20, 205, 600, 95)
$chatList.DisplayMember = 'Label'
$form.Controls.Add($chatList)
$null = New-Label '3. Selecione seu chat acima ou digite o ID autorizado:' 20 314 600 26
$chatBox = New-Object System.Windows.Forms.TextBox
$chatBox.SetBounds(20, 345, 330, 28)
$form.Controls.Add($chatBox)
$chatList.Add_SelectedIndexChanged({
    if ($null -ne $chatList.SelectedItem) { $chatBox.Text = [string]$chatList.SelectedItem.Id }
})
$activate = New-Object System.Windows.Forms.Button
$activate.Text = 'Salvar na VPS e ativar o bot'
$activate.SetBounds(20, 391, 330, 40)
$form.Controls.Add($activate)
$status = New-Label 'VPS: 91.107.207.165. O token nao sera salvo no Windows.' 20 447 600 65

$find.Add_Click({
    $token = $tokenBox.Text.Trim()
    if ($token -notmatch '^\d{5,}:[A-Za-z0-9_-]{20,}$') {
        $status.Text = 'Cole um token completo. As bolinhas indicam que ele foi preenchido.'
        return
    }
    $find.Enabled = $false
    $activate.Enabled = $false
    $status.Text = 'Validando token e buscando os chats...'
    $status.Refresh()
    try {
        $base = 'https://api.telegram.org/bot' + $token
        $me = Invoke-RestMethod -Uri ($base + '/getMe') -Method Post -TimeoutSec 20
        if (-not $me.ok) { throw 'Token recusado' }
        $updates = Invoke-RestMethod -Uri ($base + '/getUpdates') -Method Post -Body @{timeout=0} -TimeoutSec 20
        $chatList.Items.Clear()
        $seen = @{}
        foreach ($update in $updates.result) {
            $chat = $update.message.chat
            if ($null -ne $chat -and $chat.type -eq 'private' -and -not $seen.ContainsKey([string]$chat.id)) {
                $seen[[string]$chat.id] = $true
                $name = if ($chat.username) { '@' + $chat.username } else { $chat.first_name }
                $null = $chatList.Items.Add([pscustomobject]@{Id=$chat.id;Label=([string]$chat.id + ' - ' + $name)})
            }
        }
        $status.Text = 'Bot validado: @' + $me.result.username + '. Selecione o SEU chat para autorizar.'
        if ($chatList.Items.Count -eq 0) {
            $status.Text = 'Abra @' + $me.result.username + ' no Telegram, envie /start e clique em localizar novamente.'
        }
    } catch {
        # Erros HTTP podem carregar a URL com token. Nunca exiba o erro bruto.
        $status.Text = 'Nao foi possivel validar/localizar. Confira o novo token e a conexao com o Telegram.'
    } finally { $find.Enabled = $true; $activate.Enabled = $true }
})

$activate.Add_Click({
    $token = $tokenBox.Text.Trim()
    $ids = $chatBox.Text.Trim()
    if ($token -notmatch '^\d{5,}:[A-Za-z0-9_-]{20,}$' -or $ids -notmatch '^-?\d+(\s*,\s*-?\d+)*$') {
        $status.Text = 'Preencha o token e selecione ou digite o ID do seu chat.'
        return
    }
    $activate.Enabled = $false
    $find.Enabled = $false
    $paste.Enabled = $false
    $status.Text = 'Configurando na VPS. Aguarde ate 90 segundos...'
    $status.Refresh()
    $process = $null
    try {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = 'ssh.exe'
        $info.Arguments = '-T -o BatchMode=yes -o ConnectTimeout=15 root@91.107.207.165 python3 /root/projetos/inemaccbot/scripts/configure.py'
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardInput = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $info
        $null = $process.Start()
        $outTask = $process.StandardOutput.ReadToEndAsync()
        $errTask = $process.StandardError.ReadToEndAsync()
        # Credenciais nunca vao em argumentos, arquivos locais ou logs.
        $process.StandardInput.WriteLine($token)
        $process.StandardInput.WriteLine($ids)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(90000)) {
            $process.Kill()
            throw 'Prazo excedido'
        }
        $output = $outTask.GetAwaiter().GetResult()
        $errorText = $errTask.GetAwaiter().GetResult()
        $safeOutput = ($output + [Environment]::NewLine + $errorText).Replace($token, '[redigido]') -replace '\d{5,}:[A-Za-z0-9_-]{20,}', '[token redigido]'
        @{stage='resposta_ssh';code=$process.ExitCode;message=$safeOutput.Substring(0,[Math]::Min(4000,$safeOutput.Length))} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $setupStateDir 'windows-setup-status.json') -Encoding UTF8
        if ($process.ExitCode -eq 0) {
            $status.Text = 'Bot ativado! Envie /ping no Telegram. A resposta esperada e pong.'
            $tokenBox.Clear()
        } elseif (($output + $errorText).Contains('.env j')) {
            $status.Text = 'Ja existe uma configuracao na VPS. Avise para verificarmos o servico sem sobrescrever credenciais.'
        } else {
            # Exibe apenas mensagens conhecidas do backend, nunca stderr bruto ou URLs.
            $rawResult = $output + $errorText
            if ($rawResult.Contains('Token recusado pelo Telegram')) {
                $status.Text = 'O Telegram recusou o token. Copie o token NOVO e completo do BotFather e tente novamente.'
            } elseif ($rawResult.Contains('Formato do token')) {
                $status.Text = 'O token chegou incompleto. Copie somente o token do BotFather, sem textos antes ou depois.'
            } elseif ($rawResult.Contains('conectar ao Telegram')) {
                $status.Text = 'A VPS nao conseguiu conectar ao Telegram. Avise para verificarmos a rede.'
            } elseif ($rawResult.Contains('Telegram respondeu HTTP')) {
                $status.Text = 'O Telegram recusou temporariamente a consulta. Aguarde e tente novamente.'
            } elseif ($rawResult.Contains('Permission denied')) {
                $status.Text = 'A conexao SSH foi recusada. Avise para corrigirmos o acesso a VPS.'
            } else {
                $status.Text = 'Falha registrada na VPS. Avise para verificarmos a etapa exata, sem precisar enviar o token.'
            }
        }
    } catch {
        $diagnosticPath = Join-Path $setupStateDir 'windows-setup-status.json'
        $safeError = $_.Exception.Message.Replace($token, '[redigido]') -replace '\d{5,}:[A-Za-z0-9_-]{20,}', '[token redigido]'
        @{stage='falha_local';message=$safeError} | ConvertTo-Json | Set-Content -LiteralPath $diagnosticPath -Encoding UTF8
        $status.Text = 'Falha local registrada. Avise para corrigirmos o programa de configuracao.'
    } finally {
        if ($null -ne $process) { $process.Dispose() }
        $activate.Enabled = $true
        $find.Enabled = $true
        $paste.Enabled = $true
        $token = $null
    }
})
$form.Add_FormClosed({ $tokenBox.Clear() })
$null = $form.ShowDialog()
