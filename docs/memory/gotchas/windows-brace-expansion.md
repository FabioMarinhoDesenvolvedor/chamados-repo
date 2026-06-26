# Brace expansion não funciona no PowerShell/CMD

Problema:
Comandos como `mkdir -p {src,docs}` ou `mkdir docs/memory/{decisions,gotchas}`
criam pastas com o nome LITERAL `{src,docs}` no Windows (PowerShell e CMD não
fazem brace expansion como o bash). Já aconteceu: gerou a pasta-lixo
`chamados/{src,docs` (removida).

Solução:
- No Windows, criar pastas uma a uma, ou usar o bash (Git Bash) para brace expansion.
- PowerShell: `New-Item -ItemType Directory -Force a, b, c` (lista separada por vírgula).
- Sempre conferir `ls` após criar várias pastas de uma vez.
