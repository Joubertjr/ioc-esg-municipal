# PRIMEIRO PROMPT — IOC ESG Municipal
# Cole exatamente este bloco no Claude Code para iniciar

---

```
Leia o arquivo CLAUDE.md completamente antes de qualquer resposta.

Depois disso:
1. Confirme que compreendeu a stack, o domínio e os gotchas das APIs governamentais
2. Leia a documentação em docs/especificacao/ (especialmente DOCUMENTO_FINAL e GUIA_INTEGRACAO_APIS)
3. Relate: o que o projeto faz, quais APIs integra, qual o MVP de 8 semanas
4. Execute o protocolo de início de sessão descrito no CLAUDE.md

Você tem acesso a:
- 14 agentes especializados (orchestrator, backend-architect, data-collector, ods-analyst, etc.)
- 12 skills customizadas (/setup, /new-agent, /new-ods, /tdd, /full-stack, etc.)
- 4 slash commands (/plan, /checkpoint, /state, /decisions)
- 6 hooks automáticos (segurança, formatação, backup, logs)

Execute /setup para configurar a estrutura completa do projeto.
Apresente o plano completo e aguarde minha aprovação antes de implementar.
```

---

## SEQUÊNCIA APÓS APROVAÇÃO DO SETUP

```bash
# 1. Ambiente
pnpm docker:up          # PostgreSQL + Redis + Adminer
pnpm db:migrate         # Cria tabelas
pnpm db:seed            # 295 municípios de SC
pnpm dev                # Backend 3000 + Frontend 5173

# 2. Verificar que tudo subiu
curl http://localhost:3000/health
# Adminer: http://localhost:8080
```

## ROADMAP MVP — 8 SEMANAS

```
Semana 1-2: Infraestrutura + Coletores básicos
  /new-agent ibge      → população, renda, desemprego
  /new-agent siconfi   → FPM e finanças
  /new-agent datasus   → saúde

Semana 3-4: ODS prioritários
  /new-ods 3           → Saúde (mortalidade infantil, cobertura APS)
  /new-ods 4           → Educação (IDEB)
  /new-ods 6           → Saneamento (água, esgoto)

Semana 5-6: Dashboard MVP
  /full-stack dashboard-executivo
  → Cards dos 3 ODS + mapa de calor + alertas

Semana 7-8: Simulador MVP
  /full-stack simulador-cenarios
  → Selecionar investimento → ver impacto estimado → comparar cenários
```

## REFERÊNCIA RÁPIDA

```bash
# Skills principais
/setup                  # Setup inicial — UMA VEZ
/new-agent <api>        # ibge | siconfi | datasus | inep | snis | inpe | pncp
/new-ods <1-17>         # Calculator de score por ODS
/full-stack <feature>   # Feature completa coordenada por agentes
/tdd <feature>          # Red-Green-Refactor
/bug-fix                # Diagnóstico + correção + regressão
/pre-deploy             # Checklist antes de deploy
/health-check           # Monitor de saúde
/context-save           # Salvar antes de /compact
/morning-briefing       # Standup autônomo

# Agentes (diga: "Use o agente X para Y")
orchestrator            # Features complexas multi-agente
backend-architect       # Design de APIs
database-architect      # Schema e migrations
frontend-architect      # Hierarquia de componentes
data-collector          # Coletores de APIs gov
ods-analyst             # Scores e indicadores ODS
security-auditor        # Auditoria antes de deploy
code-reviewer           # Revisão pós-feature

# Automação 24/7
/loop 15m /health-check         # Monitor durante dev
/loop 5m verifique o build      # Babysit de processos
/schedule daily 9am /morning-briefing  # Standup automático

# Atalhos
Shift+Tab 2×    → Plan mode (planeja, não executa)
/btw <pergunta> → Pergunta sem poluir contexto
/compact        → Compactar (use antes de 70%)
/effort high    → Raciocínio profundo
```

## DOMÍNIO RÁPIDO

```
Problema: Prefeitos deixam R$20-40B em FPM sem usar
Solução: Dados públicos + simulação + IA → "Invista aqui, veja o impacto antes"

Mercado: 295 municípios SC → 5.570 Brasil
Modelo: R$12k-200k/ano por município (80%+ margem)
Dados: 100% públicos e gratuitos (IBGE, SICONFI, DATASUS, INEP, SNIS, INPE, PNCP)

Gotchas críticos:
- IBGE = 7 dígitos. SICONFI = 6 dígitos. Converter: ibgeCode.slice(0,6)
- FPM = 3 decênios/mês. Somar para valor mensal.
- DATASUS = instável. Timeout 30s + retry 3x + cache 12h.
- IDEB = bienal (anos pares). Interpolar para anos intermediários.
- Score: 0-100. Verde≥70, Amarelo 40-69, Vermelho<40.
```
