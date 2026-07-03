# QUALITY.md — Contrato de Qualidade

> IOC ESG Municipal — Quality Architecture Assurance System (QAAS)

---

## O que é o QAAS

O QAAS é o sistema de garantia de qualidade arquitetural do projeto. Ele avalia 12 dimensões de qualidade com evidências verificáveis, usando uma combinação de:

1. **Fitness functions** — verificações determinísticas executáveis (sem LLM)
2. **Agente auditor** — diagnóstico profundo via `qaas-auditor`
3. **Políticas de release** — checklist obrigatório antes de deploy

## Como usar

```bash
# Fitness functions rápidas (~30s)
pnpm quality:check

# Fitness functions individuais
bash quality/fitness-functions/typecheck.sh
bash quality/fitness-functions/no-circular-deps.sh
bash quality/fitness-functions/no-secrets.sh

# Fitness functions lentas (~15min)
bash quality/fitness-functions/docker-build.sh
bash quality/fitness-functions/login-smoke.sh

# Diagnóstico completo via Claude Code
/qaas
```

## As 12 Dimensões

| Dim | Nome                         | O que avalia                          |
| --- | ---------------------------- | ------------------------------------- |
| A   | Requisitos e rastreabilidade | Comportamento → testes → evidência    |
| B   | Arquitetura e modularidade   | Fronteiras, acoplamento, dependências |
| C   | Arquitetura de testes        | Pirâmide, distribuição, determinismo  |
| D   | Cobertura por risco          | Código crítico exercitado             |
| E   | Efetividade dos testes       | Testes detectam defeitos reais        |
| F   | Integrações e contratos      | APIs, validação, compatibilidade      |
| G   | Segurança e supply chain     | Secrets, deps, OWASP                  |
| H   | Performance e capacidade     | Latência, cache, SLOs                 |
| I   | Resiliência e recuperação    | Retry, timeout, fallback              |
| J   | Observabilidade              | Logs, métricas, alertas               |
| K   | CI/CD e governança           | Pipeline, gates, reprodutibilidade    |
| L   | Agentes e IA                 | Coletores, evals, segurança           |

## Notas de Maturidade (0-5)

| Nota | Significado                                                          |
| ---- | -------------------------------------------------------------------- |
| 0    | Inexistente                                                          |
| 1    | Ad hoc, manual                                                       |
| 2    | Presente, parcial                                                    |
| 3    | Operacional, consistente                                             |
| 4    | Automatizado, monitorado, em CI                                      |
| 5    | Governado por evidência + fitness functions + prevenção de regressão |

## Fitness Functions

Verificações determinísticas que protegem invariantes arquiteturais:

| Função                | Tempo  | O que verifica                       |
| --------------------- | ------ | ------------------------------------ |
| `typecheck.sh`        | ~15s   | `tsc --noEmit` sem erros             |
| `no-circular-deps.sh` | ~5s    | Zero dependências circulares (madge) |
| `no-secrets.sh`       | ~3s    | Nenhum secret hardcoded no código    |
| `docker-build.sh`     | ~15min | Build de produção multi-stage passa  |
| `login-smoke.sh`      | ~10s   | Login funciona na stack de produção  |

## Contratos do Projeto

### 1. Contrato de Comportamento

O que o produto deve fazer: dashboard ESG para 295 municípios SC, simulação FPM, ranking, relatórios.
Definido em: `docs/ESTADO_ATUAL_SC.md`

### 2. Contrato de Arquitetura

Fronteiras de módulos, dependências permitidas, padrões de código.
Definido em: `CLAUDE.md`, `.claude/rules/`

### 3. Contrato de Qualidade

Níveis mínimos de teste, segurança, performance, observabilidade.
Definido em: este arquivo + `quality/policies/release-checklist.md`

### 4. Contrato de Evidência

Provas que precisam existir antes de release.
Definido em: `quality/policies/release-checklist.md`

## Estrutura de Diretórios

```
quality/
├── fitness-functions/     # Scripts determinísticos (shell)
│   ├── typecheck.sh
│   ├── no-circular-deps.sh
│   ├── no-secrets.sh
│   ├── docker-build.sh
│   └── login-smoke.sh
├── policies/              # Checklists e políticas
│   └── release-checklist.md
└── reports/               # Relatórios QAAS gerados
    └── QAAS_YYYY-MM-DD.md
```

## Roadmap (pós-aprovação SC)

Ferramentas e práticas para implementar após validação do cliente:

- [ ] Stryker (mutation testing) em services/ods/
- [ ] k6 (load testing) em rotas críticas
- [ ] Schemathesis (API fuzzing) contra OpenAPI spec
- [ ] Pact (contract testing) entre frontend e backend
- [ ] Testcontainers para testes de integração com DB real
- [ ] CodeQL (SAST) em CI
- [ ] SBOM + provenance no build Docker
- [ ] GitHub Actions workflow com gates de qualidade

---

_QAAS v1.0 — IOC ESG Municipal_
