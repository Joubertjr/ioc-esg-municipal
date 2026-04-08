# PLANO MESTRE DE TESTES E QUALIDADE VISUAL (Design-First)

## 1. DIAGNÓSTICO DO ESTADO ATUAL

A análise completa do repositório revela que temos **918 testes passando**, o que é excelente. No entanto, a cobertura está fortemente concentrada em rotas de API, agentes coletores (apenas a extração, não o mapeamento) e serviços de backend.

**Gaps Críticos Identificados:**
1. **Frontend sem testes unitários:** Existem 54 arquivos `.tsx`/`.ts` em `frontend/src` (incluindo todos os 28 componentes novos criados na Fase 2), mas **zero** testes unitários de frontend.
2. **E2E Incompleto:** Temos testes Playwright para Dashboard, Auth, Simulator e Navigation, mas faltam testes E2E para Benchmark, Reports, Monitoring e Onboarding.
3. **Agentes sem teste de mapeamento:** Todos os 14 agentes têm testes para o `_collector.ts`, mas **nenhum** tem teste para o `_ods_mapper.ts` (onde a lógica de negócio real acontece).
4. **Serviços core sem cobertura:** O `scenario_service.ts` (que gera as recomendações de investimento) não possui testes unitários.

---

## 2. A MUDANÇA DE PARADIGMA: DESIGN-FIRST E TEST-DRIVEN UX

A partir de agora, adotaremos uma abordagem **Design-First** acoplada a testes rigorosos. 

Não podemos avançar para a Fase 4 (Inteligência de Dados) enquanto o frontend atual não estiver blindado contra regressões e validado visualmente no nível de "classe mundial".

O desenvolvimento fluirá em duas vias complementares:
- **Telas → Software:** Validar a UX visualmente e com testes de componente antes de integrar lógica complexa.
- **Software → Telas:** Garantir que o backend entregue dados consistentes através de testes de integração robustos que alimentam a UI.

---

## 3. PLANO DE EXECUÇÃO: BLINDAGEM DO PROJETO

### FASE 3A — Validação Visual e Testes de Frontend (Prioridade Máxima)
*O objetivo não é apenas cobrir linhas de código, mas garantir que a interface não quebre.*

1. **Validação Visual Imediata (Manual):**
   - Levantar o ambiente de dev (`pnpm dev`).
   - Tirar screenshots no Chrome DevTools (iPhone 14 Pro - 390px) para o Dashboard (light e dark mode).
   - Avaliar a regra dos "3 segundos" (o prefeito entende o status?).

2. **Testes de Componentes Base (Vitest + React Testing Library):**
   - Configurar o ambiente de testes para React no Vite.
   - Criar testes para os componentes core da Fase 2:
     - `FloatingBottomTabBar.tsx`
     - `NavigationRail.tsx`
     - `KpiCards.tsx`
     - `RecommendationPanel.tsx`
     - `AnimatedNumber.tsx`

3. **Acessibilidade (WCAG):**
   - Garantir que todos os testes de componentes validem atributos ARIA.
   - Adicionar indicadores visuais (ícones ✓/⚠/✗) além de cor para status ODS.

### FASE 3B — Cobertura E2E e Lógica de Negócio (Backend/Integração)

1. **Testes de Mapeamento ODS (ods_mapper.ts):**
   - Criar testes unitários para os mappers dos agentes principais (SICONFI, IBGE, DATASUS, INEP) para garantir que a transformação de dados brutos para ODS Score está correta.

2. **Testes do Scenario Service:**
   - Criar `tests/unit/services/scenario_service.test.ts` para cobrir a geração de recomendações de investimento.

3. **Completar Suite E2E (Playwright):**
   - Criar `benchmark.spec.ts`
   - Criar `reports.spec.ts`
   - Criar `monitoring.spec.ts`

---

## 4. CRITÉRIOS DE SUCESSO DESTA FASE

- [ ] Ambiente de testes de frontend configurado e rodando via `pnpm test:unit`.
- [ ] Mínimo de 10 componentes core de UI com testes passando.
- [ ] Mappers dos 4 agentes principais testados.
- [ ] Screenshot visual do mobile validado e aprovado.
- [ ] Nenhuma regressão nos 918 testes originais.

*Somente após a conclusão da Fase 3 avançaremos para a Fase 4A (Média Geométrica).*
