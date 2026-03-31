# Comando: /checkpoint

Cria um commit de segurança antes de uma mudança significativa.

## Execute:

1. Verifique o status atual:
```bash
git status
git diff --stat
```

2. Se há mudanças não commitadas, faça o checkpoint:
```bash
git add -A
git commit -m "checkpoint: $ARGUMENTS"
```

3. Confirme:
```bash
git log --oneline -3
```

4. Reporte ao usuário: "Checkpoint criado. Você pode reverter com `git reset --hard HEAD~1` se necessário."

## Uso:
`/checkpoint antes de refatorar o módulo de auth`
`/checkpoint estado estável antes de migração`
