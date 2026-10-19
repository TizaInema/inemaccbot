---
name: videos-agnes
description: Filme narrado com imagens e clipes Agnes, com retomada por cena.
---

# Filme Agnes

Origem: https://github.com/inematds/videos-agnes, revisão `dca7c5d`.
A adaptação preserva âncoras de personagens, keyframes inicial/final, revisão
de dicção, voz local, retomada e imagem pronta para vídeo. A entrega é do bot atual.

Sua tarefa é gravar o JSON no caminho EXATO informado pelo worker. Não inicie
render nem processos em segundo plano: o bot valida o roteiro e inicia o backend.

Para `historia`, crie de 1 a 8 cenas coerentes. Narração em PT-BR; prompts
de imagem e movimento em inglês. Mantenha personagens e roupas consistentes.
Não prometa gratuidade permanente nem voz clonada.

Escreva um JSON:

```json
{"ratio":"16:9","anchors":[{"id":"robot","prompt":"A small orange robot, three-quarter view, plain background."}],"scenes":[{"image_prompt":"The same robot in a workshop.","end_prompt":"The same robot looks up at the stars.","refs":["robot"],"narration":"O pequeno robô olhou para as estrelas.","motion":"The robot looks upward, slow cinematic push-in."}]}
```

Para uma vista adicional do MESMO personagem, use uma âncora com `derive_from`
apontando para uma âncora anterior. Cada cena aceita no máximo 2 refs de âncoras.
O quadro final deriva do inicial e de até uma âncora; não gere personagens independentes.

Para `animar`, use a foto/arte já anexada, sem gerar novas imagens:

```json
{"image":"/caminho/absoluto/foto.png","seconds":15,"ratio":"9:16","motion":"Slow cinematic push-in, subtle natural movement. Keep printed text and logos unchanged."}
```

Aceita de 4 a 60 segundos, nos formatos 16:9, 9:16, 1:1, 4:3, 3:4 e 21:9.
Animações acima de 12 segundos usam clipes encadeados que retornam à imagem
inicial entre as emendas. Preserve a proporção e duração solicitadas nos campos.

O backend mantém IDs de tarefas, repete filas cheias, gera voz Kokoro pf_dora
para histórias e monta com FFmpeg. Requer AGNES_API_KEY no cofre. Não execute
rodar.py do repositório original: ele contém caminhos e entrega de outra instalação.
Nunca envie mensagens por conta própria; a entrega é responsabilidade do ccbot.
