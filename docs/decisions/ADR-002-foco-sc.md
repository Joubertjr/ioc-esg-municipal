# ADR-002: Foco em Santa Catarina — Escala Nacional Adiada

**Data:** 2026-04-01
**Status:** Aceito
**Decisor:** Joubert + Claude

## Contexto

O projeto foi originalmente concebido para atender 5.570 municípios brasileiros. Durante a fase de setup, surgiu a questão de priorização: tentar cobrir o Brasil inteiro imediatamente ou validar o produto num mercado menor e mais controlável primeiro.

Santa Catarina apresenta vantagens estratégicas:

- 295 municípios com variação representativa (pequenos <5k hab, médios, grandes como Florianópolis)
- Dados IBGE/SICONFI bem estruturados para SC
- Mercado inicial viável para validar pricing R$12k–200k/ano
- Reduz complexidade de suporte e onboarding inicial

## Decisão

**Fase 1–6 focam exclusivamente nos 295 municípios de Santa Catarina.**

Escala para demais estados somente após:

1. Validação de produto com pelo menos 3 municípios pagantes em SC
2. Estabilidade de infra comprovada (SLA >99% por 30 dias)
3. Decisão explícita de expansão geográfica

A constante `MUNICIPALITIES_SC` em `shared/constants/` contém os 295 IBGE codes. Nenhum outro estado deve ser adicionado sem nova ADR.

## Consequências

### Positivas

- Seed de dados é rápido e confiável (295 registros vs 5.570)
- Benchmark estadual tem contexto real e comparável
- Suporte e onboarding são gerenciáveis por time pequeno
- Menor risco de dados inconsistentes de estados com APIs problemáticas

### Negativas

- Mercado endereçável imediato é menor (~R$3,5M ARR máximo SC vs ~R$66M Brasil)
- Municípios de outros estados que contatem serão recusados temporariamente

### Riscos

- Concorrente pode entrar com escopo nacional antes da expansão
- Mitigação: velocidade de execução em SC cria vantagem de dados e referências
