# Glossário operacional — IOC ESG Municipal

- **Vertical:** GovTech / ESG municipal brasileiro
- **Arquétipo MDO:** D regulado
- **Versão:** 0.1
- **Última atualização:** 2026-05-27

---

### Score ODS municipal

- **Definição:** número 0–100 que resume o desempenho do município em um ODS específico, calculado a partir de indicadores públicos ponderados.
- **Sinônimos:** "nota ODS" (UI — não usar em código)
- **Procedência:** Metodologia interna IOC; alinhamento conceitual ONU ODS
- **Usado em:** `OdsScoreSchema`, eval `ods-score-range`

### Indicador ODS

- **Definição:** métrica atômica (ex.: mortalidade infantil, IDEB) com valor, fonte, ano de referência e flag `dataAvailable`.
- **Sinônimos:** nenhum
- **Procedência:** `shared/types/domain/ods.ts`
- **Usado em:** coletores, `OdsIndicator`, evals de completude

### Status semáforo (verde / amarelo / vermelho)

- **Definição:** classificação derivada do score: verde ≥70, amarelo ≥40, vermelho &lt;40.
- **Sinônimos:** "faixa de desempenho"
- **Procedência:** `getOdsStatus()` em `shared/types/domain/ods.ts`
- **Usado em:** dashboard, relatório executivo

### FPM (Fundo de Participação dos Municípios)

- **Definição:** transferência constitucional da União aos municípios; base para simulação de alocação de investimento.
- **Sinônimos:** "repasse federal"
- **Procedência:** SICONFI / legislação fiscal brasileira
- **Usado em:** simulador, eval `fpm-simulation-bounds`

### Simulador de cenário FPM

- **Definição:** funcionalidade que projeta impacto de alocação hipotética de investimento nos scores ODS, sem persistir decisão oficial.
- **Sinônimos:** "what-if de investimento"
- **Procedência:** `shared/types/domain/simulation.ts`, README do produto
- **Usado em:** `SimulationRequestSchema`, tool-scope (write+HITL se exportar)

### Município (entidade operacional)

- **Definição:** unidade federativa municipal identificada por código IBGE, com conjunto de indicadores e scores históricos.
- **Sinônimos:** "tenant" (multi-município futuro)
- **Procedência:** Prisma / seed 295 municípios SC
- **Usado em:** RBAC, queries API

### Coletor (data collector)

- **Definição:** módulo que busca dados em API governamental pública, normaliza e persiste indicadores.
- **Sinônimos:** "agente de coleta" (dev — distinto de agente LLM)
- **Procedência:** `backend/services/ods/methodology_service.ts` (campo `agent`)
- **Usado em:** tool-scope, eval `collector-freshness`

### Frescor de dados (staleness)

- **Definição:** bucket `fresh | recent | stale | critical | unknown` pela idade do dado em anos.
- **Sinônimos:** "idade do indicador"
- **Procedência:** `classifyStaleness()` em `shared/types/domain/ods.ts`
- **Usado em:** alertas ao prefeito, eval `stale-data-warning`

### Relatório executivo ESG

- **Definição:** saída estruturada com resumo de scores, ODS críticos e recomendações priorizadas para gestor municipal.
- **Sinônimos:** "briefing prefeito"
- **Procedência:** roadmap MVP semanas 5–8
- **Usado em:** `ExecutiveReportSchema`, eval `report-cites-sources`

### Recomendação priorizada

- **Definição:** ação sugerida (investimento, política, re-coleta) com ODS alvo, impacto estimado e evidência de indicador.
- **Sinônimos:** nenhum
- **Procedência:** produto IOC
- **Usado em:** agente LLM (futuro), eval `recommendation-grounded`

### Benchmark municipal

- **Definição:** comparação do município com média/ranking de pares (ex.: municípios SC).
- **Sinônimos:** "comparativo"
- **Procedência:** `shared/constants/sc-benchmark-codes.ts`
- **Usado em:** API benchmarks, eval `benchmark-ranking`

### RBAC municipal

- **Definição:** controle de acesso por papel `admin | prefeito | secretario` sobre rotas e dados sensíveis.
- **Sinônimos:** nenhum
- **Procedência:** README — API autenticada
- **Usado em:** tool-scope (sem elevação de privilégio pelo agente)

### Writeback regulado

- **Definição:** qualquer persistência ou exportação que o gestor possa tratar como decisão oficial (cenário salvo, relatório assinado).
- **Sinônimos:** nenhum
- **Procedência:** MDO P-006 / LGPD
- **Usado em:** tool-scope HITL

### Procedência de fonte

- **Definição:** identificação obrigatória da origem do dado (API, ano, URL ou documento) em síntese ou relatório.
- **Sinônimos:** "citação de fonte"
- **Procedência:** MDO arquétipo C/D; prática jornalismo de dados
- **Usado em:** eval `report-cites-sources`, schemas de saída LLM

### Camada agêntica (produto)

- **Definição:** subsistema que usa LLM para relatório, recomendação e Q&A sobre dados já validados — não substitui coletores determinísticos.
- **Sinônimos:** "assistente prefeito"
- **Procedência:** MDO P-011 determinismo antes de agência
- **Usado em:** `llm_client.ts`, tool-scope

### HITL (human-in-the-loop)

- **Definição:** aprovação humana obrigatória antes de writeback ou exportação com efeito institucional.
- **Sinônimos:** nenhum
- **Procedência:** MDO template HITL queue v0.1.5
- **Usado em:** `tool_scope.md`, fila futura `docs/mdo/hitl-queue.md`
