# Comando: /plan

Inicia o protocolo de planejamento documentado para a feature: $ARGUMENTS

## Execute os seguintes passos em ordem:

### 1. Análise de contexto

- Leia `docs/ESTADO_ATUAL_SC.md` para entender o estado atual
- Identifique todos os arquivos relevantes para esta feature
- Liste dependências e integrações afetadas

### 2. Proposta estruturada

Produza um documento com:

**O que será implementado:**
[descrição clara do que vai existir depois que terminar]

**Abordagem técnica:**
[como vai ser feito, com justificativa]

**Arquivos que serão criados:**
[lista]

**Arquivos que serão modificados:**
[lista com descrição da mudança]

**Riscos identificados:**
[o que pode dar errado e como mitigar]

**Alternativas consideradas e rejeitadas:**
[o que foi pensado mas não escolhido e por quê]

**Estimativa de complexidade:** [Baixa / Média / Alta]

### 3. Aguarde aprovação

Não inicie a implementação até receber confirmação explícita do usuário.

### 4. Após aprovação

- Salve este plano em `docs/plans/$ARGUMENTS.md`
- Faça checkpoint: `git add -A && git commit -m "checkpoint: antes de $ARGUMENTS"`
- Crie branch: `git checkout -b feature/$ARGUMENTS`
- Inicie implementação
