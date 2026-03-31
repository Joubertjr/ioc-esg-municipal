---
name: tdd
description: TDD com Red-Green-Refactor em 3 fases separadas com gate de aprovação. Use ao implementar qualquer feature nova.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(pnpm test:unit *), Bash(pnpm test:integration *)
model: claude-opus-4-6
---

# Skill: TDD — Red-Green-Refactor

## FASE 1 — RED (testes que devem FALHAR)

1. Identifique TODOS os comportamentos: happy path, erros, edge cases, limites
2. Escreva os testes completos — **não implemente código ainda**
3. Execute e confirme que TODOS falham:
```bash
pnpm test:unit -- --reporter=verbose
```
4. **PARE.** Reporte: N testes escritos, todos falhando. Aguarde confirmação.

---

## FASE 2 — GREEN (implementação mínima)

1. Implemente apenas o suficiente para cada teste passar
2. Execute após cada bloco de implementação
3. **Só avance quando TODOS os testes estiverem verdes**
4. **PARE.** Reporte: N testes passando, arquivos criados. Aguarde confirmação.

---

## FASE 3 — REFACTOR (limpeza)

Testes são sua rede de segurança. Execute após CADA mudança:
- Remova duplicação
- Melhore nomes
- Extraia funções longas (>20 linhas)
- Simplifique condicionais

Execute suite completa ao final. **Todos devem continuar verdes.**

## Relatório final
```
TDD concluído: [feature]
Testes: N total (X happy paths, Y erros, Z edge cases)
Arquivos criados: [lista]
Cobertura não coberta: [lista com justificativa]
```
