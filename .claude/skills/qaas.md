---
name: qaas
description: "QAAS — Quality Architecture Assurance System. Diagnóstico profundo em 12 dimensões com evidências verificáveis e fitness functions."
allowed-tools: Bash(*), Read, Glob, Grep, Agent, Write, Edit
---

# QAAS — Quality Architecture Assurance System

Executa o protocolo completo de diagnóstico de qualidade arquitetural do projeto IOC ESG Municipal.

## Contexto

O QAAS avalia 12 dimensões de qualidade com evidências verificáveis, produzindo um relatório estruturado e acionável. Não é opinião — é diagnóstico baseado em provas.

## Passos

### 1. Fitness Functions (verificações determinísticas)

Execute as fitness functions primeiro — são rápidas e dão baseline factual:

```bash
bash quality/fitness-functions/typecheck.sh
bash quality/fitness-functions/no-circular-deps.sh
bash quality/fitness-functions/no-secrets.sh
```

Registre cada resultado (PASS/FAIL + detalhes).

### 2. Diagnóstico Profundo (12 dimensões)

Lance o agente `qaas-auditor` para executar o protocolo completo:

```
Agent(qaas-auditor): Execute o protocolo QAAS completo. Fitness function results: [cole os resultados do passo 1]
```

O auditor avaliará:

| Dim | Dimensão                      | Pergunta central                                   |
| --- | ----------------------------- | -------------------------------------------------- |
| A   | Requisitos e rastreabilidade  | Comportamento prometido está mapeado para testes?  |
| B   | Arquitetura e modularidade    | Módulos respeitam dependências e fronteiras?       |
| C   | Arquitetura de testes         | Há equilíbrio entre unitário, integração e E2E?    |
| D   | Cobertura por risco           | Código crítico é exercitado?                       |
| E   | Efetividade dos testes        | Testes detectam defeitos reais?                    |
| F   | Integrações, APIs e contratos | Contratos entre serviços são protegidos?           |
| G   | Segurança e supply chain      | Falhas comuns e cadeia de suprimentos verificadas? |
| H   | Performance e resiliência     | Sistema sustenta carga e falhas previsíveis?       |
| I   | Resiliência e recuperação     | Retry, timeout, circuit breaker funcionam?         |
| J   | Observabilidade               | Falha em produção pode ser investigada?            |
| K   | CI/CD e governança            | Pipeline reproduzível e protegido?                 |
| L   | Agentes e IA                  | Comportamento probabilístico avaliado?             |

### 3. Fitness Functions Lentas (opcional)

Se solicitado ou antes de release, execute também:

```bash
bash quality/fitness-functions/docker-build.sh
bash quality/fitness-functions/login-smoke.sh
```

### 4. Relatório Final

O auditor salva o relatório em `quality/reports/QAAS_YYYY-MM-DD.md`.

Formato do scorecard:

```
QAAS SCORECARD — YYYY-MM-DD

| Dim | Dimensão                    | Nota (0-5) | Status |
|-----|-----------------------------|------------|--------|
| A   | Requisitos e rastreabilidade | X          | ...    |
| B   | Arquitetura e modularidade   | X          | ...    |
| ...                                                    |
| GLOBAL                            | X.X        | ...    |
```

### 5. Remediação

Se houver achados BLOQUEADOR ou CRÍTICO, gere plano de remediação com:

- Achado → arquivo:linha → cenário de falha → correção proposta → esforço estimado

Para corrigir automaticamente: `/audit-fix` (usa improvement-coordinator).
