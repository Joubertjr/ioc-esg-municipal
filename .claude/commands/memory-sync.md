# Comando: /memory-sync

Sincroniza as duas camadas de memória persistente:

- **auto-memory** — `~/.claude/projects/<project>/memory/` (feedback + user + project + reference)
- **Obsidian vault** — `~/obsidian-vault/ioc-esg-municipal/long-term/` (architecture + gotchas + ADRs + lessons-learned)

Inspiração: Zep temporal graph + LangMem taxonomy — distinguir episódico
(daily logs), semântico (gotchas, architecture) e procedural (CLAUDE.md) e
manter cada tipo na camada correta.

## Execute:

```
Use o agente memory-manager e execute o operação 9 "sync-auto-memory".

Parâmetros opcionais ($ARGUMENTS):
- "dry-run" — só relatar inconsistências, não modificar nada
- "force"   — aplicar merges mesmo se houver conflito (usar com cuidado)
- default   — aplicar sync e pedir confirmação só em conflitos reais
```

## Quando usar

- Fim de sessão (como parte do checklist CLAUDE.md)
- Após feedback longo do usuário que gerou >=3 novas auto-memories
- Antes de `/morning-briefing` para garantir coerência
- Quando MEMORY.md ultrapassar 25 linhas (sinal de que precisa consolidar)

## Saída esperada

1. Relatório de sync em `~/obsidian-vault/ioc-esg-municipal/daily/YYYY-MM-DD-memory-sync.md`
2. MEMORY.md possivelmente reduzido
3. Nenhum conteúdo importante perdido (duplicatas viram pointers, históricos
   ficam marcados como `resolved`)

## O que NÃO fazer

- Rodar em dry-run e depois commitar sem aplicar as mudanças — dry-run é
  diagnóstico, não solução
- Deletar feedback memories que o usuário escreveu explicitamente
  (`user:` direto). Elas são invioláveis sem autorização
- Misturar daily logs com long-term/ — daily é episódico e pode ser
  arquivado, long-term é semântico e persiste para sempre
