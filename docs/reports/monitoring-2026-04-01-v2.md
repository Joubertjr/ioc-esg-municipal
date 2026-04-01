# Relatório de Monitoramento — IOC ESG Municipal v2
**Data:** 2026-04-01 | **Agente:** project-monitor | **Versão do projeto:** 0.1.0-pncp

---

## Sumário Executivo

| Dimensão | Status | Delta vs. v1 |
|----------|--------|-------------|
| Testes unitários | 231 passando, 0 falhando | +60 (era 171) |
| Erros TypeScript | 0 | Mantido |
| Cobertura ODS | **12/17 (71%)** | +3 ODS (era 9/17 calculados) |
| Coletores ativos | 7/7 | +1 (PNCP agora integrado) |
| INPE integrado ao score service | **SIM** | Resolvido |
| Auth JWT | Ausente | Pendente |
| Testes de integração/e2e | 0 | Pendente |

---

## 1. Cobertura ODS — Mapa Completo (1–17)

Análise baseada na leitura direta dos `*_ods_mapper.ts` de todos os 7 coletores.

| ODS | Nome | Fonte(s) | Indicadores | Status | Qualidade |
|-----|------|----------|-------------|--------|-----------|
| 1 | Erradicação da Pobreza | IBGE | `pct_baixa_renda` | **ATIVO** | Bom — limiar SC calibrado |
| 2 | Fome Zero | IBGE | `producao_agricola` (PAM tabela 5457) | **ATIVO** | Adequado — proxy válido para municípios rurais |
| 3 | Saúde e Bem-estar | SICONFI + DATASUS | `pct_despesa_saude` + 6 Previne Brasil | **ATIVO** | Bom — múltiplas fontes |
| 4 | Educação de Qualidade | SICONFI + INEP | `pct_despesa_educacao` + 2 IDEB | **ATIVO** | Bom — dado oficial IDEB 2023 |
| 5 | Igualdade de Gênero | — | — | **PENDENTE** | Sem coletor — fontes: SSP-SC/TSE |
| 6 | Água e Saneamento | SNIS | 4 indicadores IN023/IN056/IN046/IN049 | **ATIVO** | Bom — dados SNIS 2022 oficiais |
| 7 | Energia Limpa | — | — | **PENDENTE** | Sem coletor — fontes: ANEEL/IBGE |
| 8 | Trabalho Decente | IBGE | `taxa_ocupacao` + `pib_per_capita` | **ATIVO** | Adequado — 2 indicadores econômicos |
| 9 | Infraestrutura e Inovação | IBGE | `empresas_por_10k_hab` (CEMPRE 9418) | **ATIVO** | Adequado — proxy de atividade econômica |
| 10 | Redução das Desigualdades | IBGE | `razao_dependencia` | **ATIVO** | Melhorado — indicador próprio (razão demográfica) |
| 11 | Cidades Sustentáveis | IBGE + SICONFI | `densidade_demografica` + `pct_despesa_urbanismo` | **ATIVO** | Adequado — 2 fontes distintas |
| 12 | Consumo Responsável | — | — | **PENDENTE** | Sem coletor — fontes: SNIS-RS |
| 13 | Ação Climática | INPE | `desmatamento_anual_km2` + `tendencia_desmatamento_pct` | **ATIVO** | Bom — PRODES Mata Atlântica |
| 14 | Vida na Água | — | — | **PENDENTE** | Sem coletor — fontes: ANA/MapBiomas |
| 15 | Vida Terrestre | INPE | `desmatamento_acumulado_km2` + `tendencia_vida_terrestre_pct` | **ATIVO** | Bom — séries PRODES 2004-2024 |
| 16 | Paz e Instituições | SICONFI + PNCP | `equilibrio_fiscal_siconfi` + 4 indicadores PNCP | **ATIVO** | Excelente — maior riqueza de indicadores |
| 17 | Parcerias | SICONFI | `dependencia_fpm` | **ATIVO** | Adequado — proxy de autonomia fiscal |

### Resumo de Cobertura

```
ODS com dados calculados: 12/17 (71%)
  - IBGE cobre:    ODS 1, 2, 8, 9, 10, 11
  - SICONFI cobre: ODS 3, 4, 11, 16, 17
  - DATASUS cobre: ODS 3
  - INEP cobre:    ODS 4
  - SNIS cobre:    ODS 6
  - INPE cobre:    ODS 13, 15
  - PNCP cobre:    ODS 16

ODS sem cobertura: 5/17 (29%)
  - ODS 5  (Igualdade de Gênero)   — fontes candidatas: TSE/SSP-SC
  - ODS 7  (Energia Limpa)         — fontes candidatas: ANEEL (consumo per capita)
  - ODS 12 (Consumo Responsável)   — fontes candidatas: SNIS-RS (resíduos sólidos)
  - ODS 14 (Vida na Água)          — fontes candidatas: ANA/MapBiomas
  - ODS 5 é o mais complexo (dados por sexo em nível municipal são raros)
  - ODS 14 não se aplica a municípios sem litoral (maioria dos 295 SC)
```

**Evolução:** O relatório v1 indicava 9/17 calculados e INPE como "pendente de integração". O estado real atual é 12/17 — INPE e PNCP foram integrados ao `ods_score_service.ts` e o IBGE ganhou ODS 2 (produção agrícola) e ODS 9 (empresas por 10k hab).

---

## 2. Testes — Estado Atual

### 2.1 Execução `npx vitest run`

```
Test Files  13 passed (13)
Tests       231 passed (231)
Duration    2.36s
```

**Zero falhas. Zero erros.**

### 2.2 Distribuição por Arquivo

| Arquivo de Teste | Suite | Testes | Status |
|-----------------|-------|--------|--------|
| `ibge_collector.test.ts` | Unit/Agents | 39 | PASS |
| `siconfi_collector.test.ts` | Unit/Agents | 14 | PASS |
| `datasus_collector.test.ts` | Unit/Agents | 11 | PASS |
| `inep_collector.test.ts` | Unit/Agents | 12 | PASS |
| `inpe_collector.test.ts` | Unit/Agents | 43 | PASS |
| `snis_collector.test.ts` | Unit/Agents | 15 | PASS |
| `pncp_collector.test.ts` | Unit/Agents | 18 | PASS |
| `ods_score_service.test.ts` | Unit/Services | ~13 | PASS |
| `boundary-values.test.ts` | Unit/Scoring | ~33 | PASS |
| `cache.test.ts` | Unit/Utils | ~5 | PASS |
| `http-client.test.ts` | Unit/Utils | ~6 | PASS |
| `routes/ods.test.ts` | Unit/Routes | ~7 | PASS |
| `routes/agents.test.ts` | Unit/Routes | ~15 | PASS |

### 2.3 Cobertura de Arquivos de Produção

| Arquivo de Produção | Testado? | Observação |
|--------------------|---------|------------|
| `agents/ibge/ibge_collector.ts` | SIM | 39 testes |
| `agents/ibge/ibge_ods_mapper.ts` | SIM | Via ibge_collector.test.ts |
| `agents/siconfi/siconfi_collector.ts` | SIM | 14 testes |
| `agents/datasus/datasus_collector.ts` | SIM | 11 testes |
| `agents/inep/inep_collector.ts` | SIM | 12 testes |
| `agents/snis/snis_collector.ts` | SIM | 15 testes |
| `agents/inpe/inpe_collector.ts` | SIM | 43 testes |
| `agents/pncp/pncp_collector.ts` | SIM | 18 testes |
| `services/ods/ods_score_service.ts` | SIM | ~13 testes |
| `utils/cache.ts` | SIM | ~5 testes |
| `utils/http-client.ts` | SIM | ~6 testes |
| `routes/ods.ts` | SIM | ~7 testes |
| `routes/agents.ts` | SIM | ~15 testes |
| `middleware/rate-limit.ts` | NÃO | Sem testes |
| `utils/logger.ts` | NÃO | Sem testes |
| `index.ts` | NÃO | Sem testes |
| `frontend/src/**` (12 arquivos TSX) | NÃO | Zero testes de componente |
| `tests/integration/**` | VAZIO | Apenas .gitkeep |
| `tests/e2e/**` | VAZIO | Apenas .gitkeep |

**Cobertura de arquivos produção backend crítico: ~90%** (13/14 arquivos)
**Cobertura frontend: 0%**
**Cobertura integração/e2e: 0%**

### 2.4 Delta vs. Relatório v1

| Métrica | v1 (171) | v2 (231) | Delta |
|---------|----------|----------|-------|
| Total de testes | 171 | 231 | +60 |
| Arquivos de teste | 12 | 13 | +1 (pncp_collector.test.ts) |
| Falhando | 0 | 0 | = |
| IBGE tests (ODS 9 adicionado) | 12 → | 39 | +27 |

---

## 3. TypeScript — Estado Atual

```bash
npx tsc --noEmit 2>&1 | tail -5
# (sem saída — zero erros)
```

**Resultado: ZERO erros TypeScript** em todos os 31 arquivos `.ts` do backend e 12 arquivos `.tsx`/`.ts` do frontend.

- `strict: true` — CONFORME
- Zero uso de `any` em código de produção — CONFORME
- Zod em todas as respostas de API externa — CONFORME

---

## 4. Coerência: PROJECT_STATE.md vs. Código Real

### 4.1 Divergências Encontradas

| Item no PROJECT_STATE.md | Realidade no código | Severidade |
|--------------------------|---------------------|------------|
| "121 testes passando" | **231 testes passando** | MÉDIA — desatualizado |
| "11/17 ODS" | **12/17 ODS** (ODS 9 implementado via IBGE CEMPRE) | MÉDIA — desatualizado |
| "testes INPE em andamento" | Todos os 43 testes INPE passando (commit `dae956f`) | BAIXA — resolvido |
| "PNCP em implementação" | PNCP implementado e integrado (commit `b833699`) | BAIXA — resolvido |
| "6 coletores ativos, 7o em implementação" | **7 coletores ativos** | BAIXA — desatualizado |
| ODS 10 como "duplica ODS 1/proxy errado" | **Resolvido** — usa `razao_dependencia` (próprio) | BAIXA — resolvido |

### 4.2 Itens Corretos no PROJECT_STATE.md

- Stack tecnológica — CONFORME
- 7 APIs mapeadas — CONFORME
- Infraestrutura Docker/CI/CD — CONFORME
- Próximos passos (simulador, auth, ODS 2/5/7/9) — PARCIALMENTE DESATUALIZADO (ODS 2 e 9 já implementados)

### 4.3 Veredicto

O `PROJECT_STATE.md` reflete o estado do projeto com 2-3 commits de defasagem. Está desatualizado em contagem de testes, coletores e ODS cobertos, mas correto nas pendências e riscos estruturais (sem auth, sem simulador, ODS 5/7/12/14 ausentes).

---

## 5. Análise de Riscos

### CRÍTICO — Bloqueador de Produção

| ID | Risco | Impacto | Ação Necessária |
|----|-------|---------|-----------------|
| CRIT-01 | **Zero autenticação nos endpoints** | Qualquer acesso público a dados de qualquer município | Implementar `middleware/auth.ts` com JWT — `jsonwebtoken` já nas deps |
| CRIT-02 | **Zero testes de integração** | Mudanças de schema nas APIs governamentais passam invisíveis | Implementar ao menos mock com `msw` ou `nock` para IBGE e SICONFI |
| CRIT-03 | **Zero testes E2E** | Fluxo do prefeito (entrar, ver dashboard, interpretar score) nunca validado | Playwright já configurado — criar 3 testes básicos |

### ALTO — Corrigir neste Sprint

| ID | Risco | Impacto | Arquivo |
|----|-------|---------|---------|
| ALTO-01 | **Base de cálculo ODS 3/4 incorreta** | `despesaSaude / despesaTotal` deveria ser `/ receitaImpostos` (exigência LRF art. 77 CF) — score pode ser inflado | `siconfi_ods_mapper.ts` |
| ALTO-02 | **`referenceYear` global enganoso** | SNIS 2022 + IBGE 2024 reportam um único ano como referência — dado confuso para prefeito | `ods_score_service.ts` linha 104-112 |
| ALTO-03 | **Sem `p-limit` no batch** | POST `/compare` (até 50 municípios × 7 fontes = 350 chamadas HTTP simultâneas) pode causar 429 ou sobrecarga | `routes/ods.ts` |
| ALTO-04 | **Redis sem autenticação** | Qualquer processo na rede lê/escreve no cache | `docker-compose.yml` — adicionar `requirepass` |
| ALTO-05 | **Adminer exposto** | UI de banco de dados acessível sem auth em porta 8080 | `docker-compose.yml` — remover da exposição pública |
| ALTO-06 | **Sem persistência de scores** | Schema Prisma `OdsIndicator` existe mas scores calculados nunca são gravados — sem histórico | `services/ods/ods_score_service.ts` — adicionar `prisma.odsIndicator.upsert` |

### MÉDIO — Backlog Prioritário

| ID | Risco | Impacto |
|----|-------|---------|
| MED-01 | **Interpolação IDEB não implementada** | Anos ímpares retornam dado do ano par anterior sem aviso — pode desorientar prefeito sobre evolução escolar |
| MED-02 | **Race condition `withCache`** | Múltiplas requisições simultâneas para mesmo município podem causar thundering herd no Redis |
| MED-03 | **ODS 11 densidade demográfica tem escala inadequada para municípios rurais** | ~70% dos 295 municípios SC têm < 50 hab/km² → score fixo 50 (amarelo) sem distinção — pouca utilidade diagnóstica |
| MED-04 | **Score ODS 16 concentrado no SICONFI** | Equilíbrio fiscal domina — PNCP (4 indicadores) tem peso igual ao `equilibrio_fiscal_siconfi` — deve ter peso menor |
| MED-05 | **Apenas 1 ADR formal** | 31 commits, 7 coletores, decisões de scoring — zero ADR além do ADR-001 de stack |
| MED-06 | **`producao_agricola` (ODS 2) inadequado para municípios urbanos** | Municípios como Florianópolis ou Joinville não têm PAM — `null` propaga para `dataAvailable: false` em ODS 2, mas não há fallback urbano |

### BAIXO — Monitora

| ID | Risco |
|----|-------|
| BAIXO-01 | INPE WFS usa bbox retangular — pode incluir polígonos de municípios limítrofes |
| BAIXO-02 | SNIS dados chegam com ~18 meses de atraso — 2022 é a referência mais recente |
| BAIXO-03 | Municípios < 5k hab: indicadores IBGE suprimidos por privacidade (Censo 2022) |
| BAIXO-04 | `scoreProducaoAgricola` usa escala discreta (4 faixas) sem interpolação — score pode saltar de 20 para 40 com R$1 de diferença |

---

## 6. Oportunidades — Próximos ODS

### ODS mais fáceis de implementar (por esforço estimado)

| ODS | Nome | Fonte | Esforço | Disponibilidade de Dados | Observação |
|-----|------|-------|---------|--------------------------|------------|
| **7** | Energia Limpa | ANEEL BDGD | 1 dia | ALTA — API REST pública | Consumo residencial per capita, % de acesso à rede |
| **12** | Consumo Responsável | SNIS-RS | 1 dia | ALTA — dados anuais (mesmo sistema do ODS 6) | Coleta de resíduos per capita, %reciclagem |
| **5** | Igualdade de Gênero | TSE/IBGE | 2 dias | MÉDIA — dados eleitorais públicos, mas não por gênero em nível municipal de forma direta | Representação feminina na câmara municipal (proxy TSE) |
| **14** | Vida na Água | ANA | 2 dias | BAIXA para maioria SC | Aplicável só a ~50 municípios costeiros — baixo ROI |

**Recomendação de sequência:** ODS 12 → ODS 7 → ODS 5 → ODS 14 (ou pular 14)

---

## 7. Coletores Sem Testes Adequados

| Coletor | Testes Existentes | Lacunas |
|---------|-------------------|---------|
| `ibge_collector.ts` | 39 — BOM | Sem teste para municípios <5k hab (indicadores suprimidos) |
| `siconfi_collector.ts` | 14 — ADEQUADO | Sem teste para cálculo `receitaImpostos` (quando for corrigido) |
| `datasus_collector.ts` | 11 — ADEQUADO | Sem teste para o fallback quadrimestral em cenário de API down |
| `inep_collector.ts` | 12 — ADEQUADO | Sem teste para interpolação IDEB bienal (feature ausente) |
| `snis_collector.ts` | 15 — BOM | Sem teste para município sem SNIS (pequenos sem prestadores) |
| `inpe_collector.ts` | 43 — BOM | Sem teste de integração real (bbox de município limítrofe) |
| `pncp_collector.ts` | 18 — ADEQUADO | Sem teste para `referenceYear` = ano em curso (antes de abril) |
| `middleware/rate-limit.ts` | 0 — AUSENTE | Sem qualquer teste de rate limiting |
| `routes/ods.ts` | ~7 — MÍNIMO | Sem teste para `/compare` com payload grande (50 municípios) |

---

## 8. Débito Técnico

### 8.1 Classificação

```
Débito Crítico (bloqueador de produção):
  - Ausência de autenticação (CRIT-01)
  - Ausência de testes de integração (CRIT-02)
  - Score global baseado em dados sem persistência (ALTO-06)

Débito Alto (compromete integridade do produto):
  - Base de cálculo ODS 3/4 incorreta vs. LRF (ALTO-01)
  - referenceYear único vs. múltiplos anos de referência (ALTO-02)
  - Sem p-limit no batch (ALTO-03)

Débito Médio (qualidade):
  - Apenas 1 ADR para 31 commits (MED-05)
  - Interpolação IDEB não implementada (MED-01)
  - Escala ODS 11 inadequada para municípios rurais (MED-03)
```

### 8.2 Acumulação de Débito (Tendência)

O projeto acumulou ~28 commits em 2 dias e mais ~3 commits pós v1. A velocidade é alta e a qualidade técnica (TypeScript strict, Zod, cache, retry) está bem mantida. O débito principal está concentrado em:

1. **Camadas horizontais não implementadas** (auth, persistência, simulador)
2. **Correções semânticas de scoring** (base de cálculo LRF)
3. **Testes não-unitários** (integração, e2e, frontend)

Se não houver planejamento de payback, o débito crítico 1 (ausência de auth) sozinho impede qualquer MVP entregável.

---

## 9. KPIs do Projeto

| KPI | Valor Atual | Meta Sprint | Meta Produto |
|-----|-------------|-------------|--------------|
| ODS cobertos | 12/17 (71%) | 14/17 (82%) | 17/17 (100%) |
| Testes unitários | 231 | 260+ | 300+ |
| Testes integração | 0 | 5+ | 20+ |
| Testes E2E | 0 | 3 | 15 |
| Erros TypeScript | 0 | 0 | 0 |
| Coletores ativos | 7 | 7 | 8+ |
| Auth implementada | NÃO | SIM | SIM |
| Scores persistidos | NÃO | NÃO | SIM |
| Simulador FPM | NÃO | NÃO | SIM |
| ADRs documentados | 1 | 4+ | 10+ |
| Municípios no seed | 295 SC | 295 SC | 5.570 BR |

---

## 10. Recomendações de Próximos Passos

### P0 — Esta semana (bloqueadores de MVP)

1. **Autenticação JWT** — `middleware/auth.ts`, endpoint `POST /api/auth/login`, proteger todas as rotas `/api/*`. Esforço: 1 dia.

2. **Corrigir base de cálculo ODS 3/4** — Usar `receitaImpostos` (conforme LRF) em vez de `despesaTotal` em `siconfi_ods_mapper.ts`. Esforço: 2h + testes.

3. **Persistência de scores** — Adicionar `prisma.odsIndicator.upsert()` no `ods_score_service.ts` após calcular indicadores. Esforço: 4h.

### P1 — Próximo sprint

4. **Testes de integração mínimos** — Criar `tests/integration/apis/ibge_api.integration.test.ts` com mock `msw`. Esforço: 3h.

5. **ODS 12 (Consumo Responsável)** — Coletor SNIS-RS com coleta per capita e % de reciclagem. Esforço: 1 dia. ROI alto (SNIS já integrado).

6. **ODS 7 (Energia Limpa)** — Coletor ANEEL BDGD com consumo residencial per capita. Esforço: 1 dia. API pública REST.

7. **`p-limit` no batch** — Limitar a 5 municípios paralelos em `routes/ods.ts`. Esforço: 1h.

8. **`referenceYear` por ODS** — Substituir `Math.max` por objeto `{ [odsNumber]: year }` no score report. Esforço: 2h.

### P2 — Backlog

9. **Simulador de investimentos FPM** — Feature core do produto. Estimativa: 3 dias.
10. **ADRs faltantes** — Documentar: INPE WFS, circuit breaker, PNCP scoring, seed 295 SC.
11. **Testes E2E** — Playwright: fluxo login → dashboard → score município. 3 testes mínimos.
12. **ODS 5** — Pesquisa adicional de dados de gênero em nível municipal (proxy TSE).

---

## 11. Comparativo v1 → v2

| Métrica | Relatório v1 (2026-04-01 18:00) | Relatório v2 (2026-04-01 atual) |
|---------|--------------------------------|---------------------------------|
| Total de testes | 171 | **231** (+60) |
| Arquivos de teste | 12 | **13** (+1) |
| ODS calculados | 9/17 | **12/17** (+3) |
| Coletores integrados | 6/7 (PNCP pendente) | **7/7** |
| INPE integrado ao score service | Pendente verificação | **CONFIRMADO** (linha 100 ods_score_service.ts) |
| IBGE ODS cobertos | 4 (1, 8, 10, 11) | **6 (1, 2, 8, 9, 10, 11)** |
| ODS 10 com indicador próprio | Duvidoso | **CONFIRMADO** (`razao_dependencia`) |
| `console.log` em `index.ts` | Presente (MED-01 v1) | **Corrigido** (commit `93aeb1b`) |
| CRIT-02 v1 (INPE pendente) | Aberto | **Fechado** |
| ALTO-07 v1 (PNCP ausente) | Aberto | **Fechado** |
| ALTO-03 v1 (ODS 10 duplica ODS 1) | Aberto | **Fechado** |

### Riscos Resolvidos desde v1

- CRIT-02: INPE integrado ao score service
- ALTO-07: PNCP collector implementado e integrado
- ALTO-03: ODS 10 agora usa `razao_dependencia` (indicador próprio)
- MED-01 v1: `console.log` substituído por Winston em `index.ts`

### Riscos Novos identificados nesta análise

- MED-04: Peso do PNCP vs. SICONFI no ODS 16 não balanceado
- MED-06: ODS 2 `producao_agricola` sem fallback para municípios urbanos

---

*Relatório gerado por: project-monitor agent — IOC ESG Municipal v0.1.0*
*Baseado em: leitura direta de código + execução de testes + comparação com v1*
*Próximo monitoramento recomendado: após implementação de auth JWT ou 2026-04-08*
