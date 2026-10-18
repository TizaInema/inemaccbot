Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Integrações INEMACCBOT'
$form.Size = New-Object System.Drawing.Size(660, 430)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$label = New-Object System.Windows.Forms.Label
$label.Text = 'Cole as chaves da sua conta. Campos vazios mantêm os valores atuais.'
$label.SetBounds(20, 15, 610, 40)
$form.Controls.Add($label)
$fields = @{}
$names = @('AGNES_API_KEY', 'HEYGEN_API_KEY', 'HEYGEN_AVATAR_ID', 'HEYGEN_VOICE_ID')
for ($i=0; $i -lt $names.Count; $i++) {
    $name = $names[$i]
    $caption = New-Object System.Windows.Forms.Label
    $caption.Text = $name
    $caption.SetBounds(20, (65+$i*60), 190, 25)
    $form.Controls.Add($caption)
    $field = New-Object System.Windows.Forms.TextBox
    $field.SetBounds(215, (62+$i*60), 340, 28)
    $field.UseSystemPasswordChar = $name.EndsWith('_KEY')
    $field.ShortcutsEnabled = $true
    $form.Controls.Add($field)
    $fields[$name] = $field
    $paste = New-Object System.Windows.Forms.Button
    $paste.Text = 'Colar'
    $paste.Tag = $field
    $paste.SetBounds(560, (61+$i*60), 65, 30)
    $paste.Add_Click({ param($sender, $event) $sender.Tag.Text = [System.Windows.Forms.Clipboard]::GetText() })
    $form.Controls.Add($paste)
}
$save = New-Object System.Windows.Forms.Button
$save.Text = 'Salvar na VPS'
$save.SetBounds(215, 315, 180, 38)
$form.Controls.Add($save)
$save.Add_Click({
    $save.Enabled = $false
    try {
        $payload = @{}
        foreach ($name in $names) { $payload[$name] = $fields[$name].Text.Trim() }
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = 'ssh.exe'
        $psi.Arguments = '-o BatchMode=yes -o ConnectTimeout=10 root@91.107.207.165 python3 /root/projetos/inemaccbot/scripts/configure-providers.py --stdin-json'
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $proc = [System.Diagnostics.Process]::Start($psi)
        $proc.StandardInput.WriteLine(($payload | ConvertTo-Json -Compress))
        $proc.StandardInput.Close()
        if (-not $proc.WaitForExit(30000)) { $proc.Kill(); throw 'Tempo de conexão excedido.' }
        if ($proc.ExitCode -ne 0) { throw 'Não foi possível salvar. Confira o acesso SSH e o formato dos campos.' }
        foreach ($field in $fields.Values) { $field.Clear() }
        [System.Windows.Forms.MessageBox]::Show('Integrações salvas. Use /diagnostico no Telegram.', 'Concluído')
    } catch {
        [System.Windows.Forms.MessageBox]::Show('Falha ao configurar. Confira o acesso SSH à VPS e tente novamente.', 'Configuração pendente')
    } finally { $save.Enabled = $true }
})
$null = $form.ShowDialog()
