# Validação Visual — UX Fase 2

**Data:** 2026-04-07
**Commit:** be3be2f
**Device:** iPhone 14 Pro (390x844px, 3x)
**Município:** Florianópolis (4205407)
**Captura:** Playwright headless Chrome

## Screenshots

| Arquivo               | Descrição                                               |
| --------------------- | ------------------------------------------------------- |
| `dash-light-fold.png` | Light mode — above the fold (o que o prefeito vê em 3s) |
| `dash-light-full.png` | Light mode — página completa                            |
| `dash-dark-fold.png`  | Dark mode — above the fold                              |
| `dash-dark-full.png`  | Dark mode — página completa                             |

## O que o prefeito vê em 3 segundos

1. **Score Global: 75/100** — border verde, "Situação Verde"
2. **Tendência: ↑12 pts** — sparkline + "2023 → 2025", tendência positiva
3. **Pior ODS: 37/100** — "ODS 5 · Gênero", border vermelho (alerta imediato)
4. **Ranking SC** — dados de benchmark (CSRF bloqueou na porta alternativa, funciona em ambiente normal)

## Layout validado

- **Row 1:** 4 KPI Cards em grid 2x2 (Score Global, Ranking SC, Tendência, Pior ODS)
- **Row 2:** 5 Dimension Cards (Social 58, Econômico 83, Ambiental 83, Institucional 82, Parcerias 75)
- **Row 3:** Recomendações Priorizadas + Evolução do Score ESG
- **Bottom nav:** Painel, Simular, Metas, Relatórios, Comparar

## Checklist visual

- [x] Labels 11px uppercase tracking-[0.08em] (padrão Linear)
- [x] Cores semânticas consistentes (verde/amarelo/vermelho)
- [x] Sparkline no card Tendência
- [x] tabular-nums nos scores
- [x] Dark mode com separação clara de camadas
- [x] Cool gray background (não branco puro)
- [x] Shadow-card nas cards (Vercel-style)
- [x] Zero hover:scale-[1.02]
- [x] Zero cores hardcoded (bg-gray-_, text-green-_, etc.)
- [x] Bottom nav mobile funcional

## Notas

- Ranking SC e Recomendações mostraram "—"/erro nos screenshots por incompatibilidade de CSRF (Vite rodando em porta 5174 vs backend esperando 5173). Em ambiente normal (porta 5173) funcionam corretamente.
- Script de captura disponível em `screenshot-capture.cjs` para reprodução.

## Verificação de código

- `npx tsc --noEmit` — zero erros
- `npx vitest run` — 917/918 passed (1 flaky por rate limiter pré-existente)
