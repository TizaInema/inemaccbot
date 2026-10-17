# inemaccbot — recuperação parcial

Esta branch preserva os arquivos encontrados nas pastas locais
`_inemaccbot_catalog`, `_inemaccbot_patch` e `_inemaccbot_live_patch`.
Não é uma distribuição completa nem executável do bot.

O arquivo `recovery-manifest.json` registra a origem e o SHA-256 de cada
arquivo recuperado. Os arquivos originais foram preservados.

## Verificação em 17/10/2026

- O repositório remoto `TizaInema/inemaccbot` estava vazio.
- Na VPS informada, `/root/projetos/inemaccbot` não existia.
- A unidade systemd de usuário `inemaccbot.service` existia, parada e desabilitada.
- Os logs registravam falhas de tarefas de vídeo por ferramentas ausentes.
- A conta GitHub conectada tinha apenas permissão de leitura no repositório.

## Para concluir

Recuperar o projeto completo, incluindo `package.json`, lockfile,
`tsconfig.json`, módulos importados e instruções de implantação; comparar
com estes patches; instalar as dependências, executar os testes e configurar
as credenciais diretamente no servidor antes de ativar o serviço.

Não enviar tokens, arquivos `.env`, bancos de dados, logs ou credenciais ao Git.
Os scripts operacionais recuperados podem alterar filas ou enviar mensagens;
não foram executados durante esta recuperação.
