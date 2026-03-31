---
name: pr-summary
description: Gera sumário estruturado de PR para revisão. Use antes de abrir qualquer PR no GitHub.
allowed-tools: Read, Bash(git *)
model: claude-sonnet-4-6
---
# PR Summary

```bash
git log main..HEAD --oneline
git diff main --stat
git diff main --name-only
```

## Produza o sumário

```markdown
## O que foi feito
[descrição clara do que esta PR implementa]

## Por que foi feito assim
[decisões técnicas relevantes e alternativas consideradas]

## Arquivos alterados
- `arquivo.ts`: [o que mudou e por quê]

## Testes
- N testes adicionados/modificados
- Casos cobertos: [lista]

## Como testar
```bash
# Passo a passo para revisor testar
```

## Checklist
- [ ] TypeScript sem erros (`pnpm tsc --noEmit`)
- [ ] Testes passando (`pnpm test`)
- [ ] Sem segredos expostos
- [ ] `.env.example` atualizado se necessário
- [ ] Documentação atualizada

## Breaking changes
[Nenhum | lista de breaking changes]
```
