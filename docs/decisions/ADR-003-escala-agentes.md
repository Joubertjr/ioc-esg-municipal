# ADR-003: Escala = Paralelismo de Agentes, Não Expansão Geográfica

**Data:** 2026-04-01
**Status:** Aceito
**Decisor:** Joubert + Claude

## Contexto

No contexto deste projeto, o termo "escalar" pode ser interpretado de duas formas distintas:

1. Expansão geográfica (mais estados, mais municípios)
2. Capacidade de execução (mais tarefas em paralelo, mais agentes Claude)

A ambiguidade gerou confusão nas primeiras sessões de desenvolvimento, com risco de interpretações incorretas que diluitariam o foco no produto SC.

## Decisão

**Quando o usuário mencionar "escala" ou "escalar" sem contexto geográfico explícito, a interpretação padrão é: maximizar paralelismo com múltiplos agentes Claude.**

Exemplos de aplicação:

- "Escale a implementação dos coletores" → rodar 7 agentes `data-collector` em paralelo, um por API
- "Escale os testes" → rodar múltiplos agentes `test-writer` em paralelo por módulo
- "Escale a feature X" → orquestrar backend-architect + api-developer + frontend-architect em paralelo

A estrutura de 21 agentes especializados (Opus/Sonnet/Haiku por tier) é o mecanismo de escala.

Expansão geográfica requer instrução explícita: "expandir para [estado]" ou "adicionar municípios de [estado]".

## Consequências

### Positivas

- Elimina ambiguidade em instruções do usuário
- Maximiza velocidade de desenvolvimento com Claude Code
- Cada agente tem contexto limpo e especializado — menos alucinação
- Permite feature completa (backend + frontend + testes) em paralelo

### Negativas

- Requer mais tokens por sessão quando múltiplos agentes são usados
- Coordenação de agentes (via `orchestrator`) adiciona overhead inicial

### Riscos

- Agentes em paralelo podem gerar conflitos de arquivo se não coordenados
- Mitigação: `orchestrator` define responsabilidades antes de despachar agentes
