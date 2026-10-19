# Origem: inematds/videos-agnes, revisao.py, commit dca7c5d5b25f5ed21180e98057ebfca5224c466e.
"""Revisão de narração ANTES do TTS.

Regra (definida com o usuário, 2026-07-17): as histórias vêm de crianças. NÃO corrigir
o português (concordância, estilo) — preservar a voz da criança. Corrigir SÓ o que a
locução (chatterbox) erra: número/moeda por extenso, abreviações, e pontuação de fala.
Toda mudança é registrada e mostrada (diff) — nada é editado em silêncio.

Sem dependências externas (num2words não está disponível no ambiente).
"""
import re

_U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
      'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
_D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
_C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
      'seiscentos', 'setecentos', 'oitocentos', 'novecentos']


def _ate999(n):
    if n == 0:
        return ''
    if n == 100:
        return 'cem'
    p = []
    c, r = divmod(n, 100)
    if c:
        p.append(_C[c])
    if r < 20:
        if r:
            p.append(_U[r])
    else:
        d, u = divmod(r, 10)
        p.append(_D[d] + (' e ' + _U[u] if u else ''))
    return ' e '.join(p)


def extenso(n):
    """Inteiro >= 0 por extenso em pt-BR (até bilhões)."""
    n = int(n)
    if n < 20:
        return _U[n]
    partes = []
    for div, sing, plur in ((10**9, 'bilhão', 'bilhões'), (10**6, 'milhão', 'milhões'), (1000, 'mil', 'mil')):
        q, n = divmod(n, div)
        if q:
            if div == 1000:
                partes.append(('' if q == 1 else _ate999(q) + ' ') + 'mil')
            else:
                partes.append(_ate999(q) + ' ' + (sing if q == 1 else plur))
    if n:
        partes.append(_ate999(n))
    return ' e '.join(p for p in partes if p).replace('  ', ' ').strip()


def _moeda(m):
    val = m.group(1).replace('.', '').replace(',', '.')
    inteiro = int(float(val))
    return extenso(inteiro) + (' real' if inteiro == 1 else ' reais')


ABREV = {
    r'\bR\$\s*': '',            # tratado por _moeda antes
    r'\bvc\b': 'você', r'\bpq\b': 'porque', r'\bq\b': 'que',
    r'\bdr\.\b': 'doutor', r'\bsra\.\b': 'senhora', r'\bsr\.\b': 'senhor',
    r'\betc\.\b': 'etcétera', r'\bnº\b': 'número', r'\bkm\b': 'quilômetros',
}


def revisar(texto):
    """Devolve (texto_revisado, lista_de_mudancas). Preserva a grafia da criança;
    só normaliza o que a locução erra."""
    orig = texto
    mud = []
    # 1) moeda: R$60 / R$ 1.200,50 -> "sessenta reais"
    def moeda_log(m):
        novo = _moeda(m)
        mud.append((m.group(0), novo))
        return novo
    texto = re.sub(r'R\$\s*([\d.,]+)', moeda_log, texto)
    # 2) números soltos -> extenso (não toca em anos colados a "19"/"20" com 4 dígitos? mantém simples)
    def num_log(m):
        novo = extenso(m.group(0))
        mud.append((m.group(0), novo))
        return novo
    texto = re.sub(r'\b\d{1,9}\b', num_log, texto)
    # 3) abreviações de digitação
    for pat, rep in ABREV.items():
        if re.search(pat, texto, flags=re.I):
            texto2 = re.sub(pat, rep, texto, flags=re.I)
            if texto2 != texto:
                mud.append((pat, rep))
                texto = texto2
    # 4) pontuação de diálogo: travessão de fala vira pausa (vírgula) para a prosódia
    texto = re.sub(r'\s*[—–-]\s*(?=[A-ZÀ-Ú])', ', ', texto)
    # 5) espaços/reticências que quebram a prosódia
    texto = re.sub(r'\.{3,}', '. ', texto)
    texto = re.sub(r'\s{2,}', ' ', texto).strip()
    if texto != orig and not mud:
        mud.append(('(pontuação/espaços)', ''))
    return texto, mud


if __name__ == '__main__':
    for t in ['ele ganhou R$60', 'custa R$ 1.200,50', 'depois de 1 ano juntou 3 moedas',
              '- é muito caro - respondeu a mãe', 'tinha 2 amigos']:
        r, m = revisar(t)
        print(f'{t!r}\n  -> {r!r}\n  mudanças: {m}\n')
