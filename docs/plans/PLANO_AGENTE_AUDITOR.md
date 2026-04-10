# Plano de Implementação: Agente Auditor Autônomo de Classe Mundial

Este documento define o plano técnico e metodológico para implementar um **Agente Auditor Autônomo** (Subagent) no Claude Code para o projeto **IOC ESG Municipal**. O objetivo é transformar a auditoria manual em um processo contínuo, automatizado e orientado a dados, garantindo que o código, os dados, a arquitetura e a segurança do projeto atendam aos mais altos padrões de qualidade de software [1] [2].

---

## 1. Fundamentação Teórica e Arquitetura

Auditorias de software de classe mundial não são eventos pontuais; são processos contínuos integrados ao ciclo de desenvolvimento. Frameworks modernos de _Continuous Quality Automation_ exigem que a avaliação cubra múltiplas dimensões simultaneamente: arquitetura, código, testes, segurança e conformidade de dados [1] [3].

No contexto de agentes de código como o Claude Code, a arquitetura mais eficaz para isso é o padrão de **Subagente Especializado (Subagent)**. Conforme a documentação oficial da Anthropic [4], subagentes:

- Operam em sua própria janela de contexto (isolamento).
- Possuem restrições específicas de ferramentas (ex: acesso apenas leitura).
- Seguem um _system prompt_ rigoroso e focado em um único domínio.

O nosso `audit-agent` atuará como um orquestrador de auditoria, capaz de analisar o projeto de ponta a ponta sem poluir o contexto da sessão principal do desenvolvedor.

---

## 2. Design do `audit-agent` (Claude Code Subagent)

O agente auditor será implementado como um subagente customizado do Claude Code, residindo no diretório `.claude/agents/` do projeto.

### 2.1. Configuração do Subagente (YAML Frontmatter)

O agente será configurado com as seguintes propriedades para garantir segurança e foco:

- **`name`**: `audit-agent`
- **`description`**: "Auditor autônomo de classe mundial. Executa uma auditoria profunda de código, arquitetura, dados, testes e segurança. Use periodicamente ou antes de releases importantes."
- **`model`**: `claude-3-7-sonnet-20250219` (ideal para análise profunda de código e raciocínio complexo).
- **`tools`**: `[Read, Grep, Glob, Bash]` (Acesso restrito: sem permissão de escrita/edição para garantir que a auditoria não modifique o código acidentalmente).
- **`permissions`**: `default` (herda as permissões da sessão, mas restrito pelas ferramentas).

### 2.2. As 5 Dimensões da Auditoria Contínua

O _system prompt_ do agente o instruirá a executar um roteiro de auditoria rigoroso em 5 dimensões [1] [3]:

1.  **Arquitetura e Design:** Validação do cumprimento das ADRs (Architecture Decision Records) e separação de responsabilidades (ex: isolamento entre agentes coletores e serviços de pontuação).
2.  **Qualidade de Código e Manutenibilidade:** Identificação de dívida técnica, código duplicado, tipagem frouxa (ex: uso de `any` no TypeScript) e complexidade ciclomática.
3.  **Qualidade e Conformidade de Dados (Foco ESG):** Verificação da integridade dos agentes coletores (ex: uso de APIs reais vs. _mocks_), validação de schemas Zod e tratamento de falhas em fontes de dados externas.
4.  **Testes e Cobertura:** Análise dos resultados do Vitest, identificação de _gaps_ de cobertura em arquivos críticos e validação de testes de integração.
5.  **Segurança e Hardening:** Busca por credenciais _hardcoded_, validação de inputs e revisão de dependências vulneráveis.

---

## 3. Roteiro de Auditoria (Workflow do Agente)

O agente será instruído a executar autonomamente o seguinte roteiro utilizando a ferramenta `Bash`:

**Passo 1: Coleta de Métricas Globais**

- Executar `npx tsc --noEmit` para verificar a saúde da tipagem estática.
- Executar `npx vitest run --coverage` (se configurado) para obter o status dos testes.
- Executar `git diff --stat HEAD~5..HEAD` para entender o volume de mudanças recentes.

**Passo 2: Análise de Agentes e Dados (Específico ESG)**

- Usar `Glob` e `Grep` no diretório `backend/agents/` para listar todos os coletores ativos.
- Procurar por padrões de dados estáticos (`JSON.parse`, `require('*.json')`) dentro dos coletores para identificar o uso de _mocks_ em vez de APIs reais.
- Verificar se todos os coletores implementam tratamento de erro adequado (retry, circuit breaker).

**Passo 3: Análise de Código e Dívida Técnica**

- Usar `Grep` para buscar instâncias de `any`, `ts-ignore` ou `TODO`/`FIXME` no código fonte.
- Verificar a duplicação de interfaces e tipos (ex: schemas Zod duplicados em múltiplos arquivos).

**Passo 4: Consolidação e Relatório**

- Sintetizar as descobertas em um relatório Markdown estruturado.
- Classificar os achados por severidade: 🔴 Crítico, 🟡 Aviso, 🟢 Positivo.

---

## 4. Fases de Implementação (Para Claude Code)

O Claude Code deve executar a implementação deste agente em 3 fases:

### Fase 1: Criação do Subagente `audit-agent`

**Objetivo:** Definir o arquivo Markdown do subagente com o YAML frontmatter e o system prompt.

- **Ação:** Criar o arquivo `.claude/agents/audit-agent.md`.
- **Requisitos Técnicos:**
  - Incluir o frontmatter especificado na Seção 2.1.
  - Escrever um system prompt detalhado instruindo o agente sobre as 5 dimensões (Seção 2.2) e o roteiro de execução (Seção 3).
  - Garantir que o prompt exija a entrega de um relatório final no formato Markdown.

### Fase 2: Criação do Comando de Atalho (Slash Command)

**Objetivo:** Facilitar a invocação da auditoria com um comando simples.

- **Ação:** Criar o arquivo `.claude/commands/audit.md`.
- **Requisitos Técnicos:**
  - Definir o comando `/audit`.
  - O comando deve instruir o Claude a invocar o `audit-agent` (ex: `Agent(name="auditor", subagent_type="audit-agent", prompt="Execute a auditoria completa do projeto e gere o relatório.")`).
  - Opcionalmente, o comando pode aceitar argumentos para focar a auditoria em uma dimensão específica (ex: `/audit security`).

### Fase 3: Integração com o Workflow Existente

**Objetivo:** Garantir que a auditoria faça parte do ciclo de vida do projeto.

- **Ação:** Atualizar o arquivo `CLAUDE.md`.
- **Requisitos Técnicos:**
  - Adicionar uma seção recomendando o uso do comando `/audit` antes de _commits_ importantes ou ao finalizar uma _feature_.
  - Mencionar a existência do `audit-agent` na lista de agentes disponíveis.

---

## 5. Prompt de Execução para o Claude Code

Para iniciar a implementação, copie e cole o bloco abaixo no terminal do Claude Code na raiz do projeto:

```text
Você atuará como Arquiteto de Qualidade de Software. Sua missão é implementar o `audit-agent`, um subagente autônomo de classe mundial para o Claude Code, focado em auditoria contínua.

Leia o documento `docs/plans/PLANO_AGENTE_AUDITOR.md` para entender a arquitetura e os requisitos.

Inicie a execução iterativa das Fases 1 a 3 descritas no documento:
1. Crie o arquivo `.claude/agents/audit-agent.md` com as restrições de ferramentas (somente leitura/execução) e o roteiro de auditoria rigoroso.
2. Crie o comando `.claude/commands/audit.md` para invocar o agente facilmente.
3. Atualize o `CLAUDE.md` para integrar a auditoria ao nosso fluxo de trabalho.

Após concluir as 3 fases, execute o comando `/audit` para testar o agente na prática e gerar o primeiro relatório de auditoria automatizado do projeto.
```

---

## Referências

[1] AIO Tests. (2025). _Software Quality Audit in Agile: Process & Best Practices_. https://www.aiotests.com/blog/software-quality-audit-for-agile-teams
[2] Nearshore Business Solutions. (2025). _Quality Assurance Best Practices for 2025_. https://nearshorebusinesssolutions.com/news/quality-assurance-best-practices/
[3] Techsessment. (2025). _The 50-Point Software Quality Assessment Checklist for CTOs_. https://techsessment.com/DownloadContent/50_Point_Software_Quality_Assessment_Checklist_CTO.pdf
[4] Anthropic. (2026). _Create custom subagents - Claude Code Docs_. https://code.claude.com/docs/en/sub-agents
