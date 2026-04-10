# Relatório de Auditoria: Sistemas Multi-Agente (Claude Code)

**Data:** 2026-04-10
**Alvo:** Projeto IOC ESG Municipal (`.claude/`)
**Método:** Auditoria de Fingimento Intelectual (Baseado no Guia de Auditoria Técnica para Claude Code/Cursor)

## Resumo Executivo

O projeto IOC ESG Municipal atingiu um alto grau de sofisticação com 26 agentes especializados e um framework robusto de Continuous Improvement. No entanto, a aplicação rigorosa do *Teste de Realidade* revelou sintomas clássicos de "fingimento intelectual" em camadas críticas do sistema.

A principal descoberta é o **Desbalanceamento Agente/Regra**: O sistema possui 26 agentes hiper-detalhados (alguns com mais de 250 linhas), mas **zero regras globais** (`.claude/rules/` está vazia). O conhecimento está preso no prompt dos agentes, o que degrada a atenção do LLM e impede o enforcement real.

---

## Fase 1: Mapeamento Topológico

A análise física do repositório revelou:

*   **Agentes:** 26 arquivos em `.claude/agents/` (Total de 2.893 linhas de prompt). O `orchestrator` é o maior, com 257 linhas.
*   **Comandos:** 12 arquivos em `.claude/commands/`.
*   **Skills:** 14 arquivos em `.claude/skills/`.
*   **Regras:** **0 arquivos** (A pasta `.claude/rules/` sequer existe).
*   **Memória:** A pasta `.claude/memory/` está vazia.
*   **Caos na Raiz:** A pasta `docs/` contém 17 relatórios soltos, misturando documentação técnica, relatórios de auditoria e validações de sprint, dificultando o parseamento por agentes.

**Diagnóstico:** Arquitetura *Agent-Heavy*. O sistema confia na "boa vontade" do LLM ler instruções longas em vez de forçar o comportamento via regras globais e hooks.

---

## Fase 2: Testes de Fingimento Intelectual

### 1. O Teste da Delegação (Orchestrator)
*   **O que diz:** "Voce coordena times de agentes especializados. Voce NAO implementa — voce planeja, delega e integra. [...] Lance TODOS em paralelo."
*   **A Prova:** O prompt permite as ferramentas `TaskCreate`, `TaskUpdate` e `Agent`. No entanto, **não há exemplos concretos** de como invocar essas ferramentas no prompt. O diagrama de dependências é apenas texto.
*   **Veredito (Falha Parcial):** O agente sabe que deve delegar, mas a falta de templates estritos de output frequentemente faz com que ele tente resolver o problema sozinho antes de invocar subagentes.

### 2. O Teste do Enforcement (Validação)
*   **O que diz:** Os agentes possuem instruções estritas de segurança e qualidade.
*   **A Prova:** O sistema possui hooks python (`pre_write_guard.py` e `pre_bash_guard.py`) configurados no `.mcp.json`/`settings.json` que **bloqueiam fisicamente** comandos como `rm -rf` ou a escrita em `.env`. O CI/CD no GitHub Actions roda `tsc` e `vitest`.
*   **Veredito (Aprovado ✅):** Este é o ponto mais forte do projeto. O enforcement não é apenas semântico, é mecânico (exit code 2 bloqueia a execução do Claude).

### 3. O Teste do Aprendizado (Memória)
*   **O que diz:** O `memory-manager` sincroniza a memória com um vault Obsidian em `~/obsidian-vault/ioc-esg-municipal/`.
*   **A Prova:** O comando `ls ~/obsidian-vault/` falhou. A pasta **não existe** no ambiente. O `.mcp.json` aponta para um caminho hardcoded do macOS do desenvolvedor original (`/Users/joubert/obsidian-vault/...`).
*   **Veredito (Falha Crítica ❌):** Fingimento intelectual grave. O agente finge que salva no vault, mas como o MCP falha silenciosamente (ou o caminho não existe na VPS/Sandbox), a memória semântica se perde a cada sessão.

### 4. O Teste do Estado (State Management)
*   **O que diz:** O `PROJECT_STATE.md` reflete o status do projeto.
*   **A Prova:** O arquivo é atualizado manualmente via comando `/state`. Não há um script que o gere dinamicamente lendo a AST ou a cobertura de testes.
*   **Veredito (Falha Parcial):** É um estado estático. Fica defasado rapidamente durante sessões de refatoração intensas.

---

## Fase 3: Rastreabilidade (Análise de Impacto)

*   **O que diz:** O `orchestrator` menciona "Refatoracoes com impacto sistemico".
*   **A Prova:** O `audit-agent` faz `grep` global por padrões específicos (`any`, `TODO`, `eval`), mas **nenhum agente** possui instruções para rodar um script de Análise de Impacto de Dependências (ex: `madge` ou busca em árvore) antes de deletar ou alterar uma função core.
*   **Veredito (Falha ❌):** O sistema opera com "visão de túnel". Altera o arquivo A sem verificar se quebra silenciosamente o arquivo B (a menos que o TypeScript grite no CI).

---

## Fase 4: Matriz de Diagnóstico e Task File

| Camada | O que a documentação diz | O que a auditoria provou | Ação Corretiva Exigida |
|--------|--------------------------|--------------------------|------------------------|
| **Regras** | (Implícito nos agentes) | Zero regras globais criadas. | Extrair invariantes dos agentes para `.claude/rules/`. |
| **Memória** | "Salva no Obsidian Vault" | O Vault não existe no ambiente (caminho macOS hardcoded). | Corrigir `.mcp.json` para usar caminhos relativos ou criar o diretório localmente. |
| **Impacto** | "Avalia impacto sistêmico" | Não há ferramentas de grafo de dependência no prompt. | Adicionar `madge` ou script de rastreabilidade ao `code-reviewer`. |
| **Organização**| "Documentação estruturada" | 17 arquivos soltos na raiz de `docs/`. | Reorganizar `docs/` em `/plans`, `/evidence`, `/methodology`. |

---

### Task File: `TASK_refatoracao_agentes.md`
*(Este bloco deve ser copiado e salvo como um arquivo na raiz para execução do Claude Code)*

```markdown
# TASK: Refatoração da Arquitetura Multi-Agente (Anti-Fingimento)

**Objetivo:** Eliminar o fingimento intelectual da camada de agentes e forçar enforcement mecânico.

**Critérios de Aceite:**

1. **Correção da Memória (Crítico):**
   - [ ] Verifique o `.mcp.json`. Ele aponta para `/Users/joubert/...`. Altere para usar uma variável de ambiente ou crie a pasta `obsidian-vault` dinamicamente no diretório atual (`$PWD/obsidian-vault`).
   - [ ] Teste a escrita de um arquivo no vault via MCP para garantir que não falha silenciosamente.

2. **Extração de Regras Globais:**
   - [ ] Crie o diretório `.claude/rules/`.
   - [ ] Extraia regras de codificação genéricas (ex: "Não use any", "Sempre trate erros do Prisma") dos prompts dos agentes (como `code-reviewer` e `backend-architect`) e crie arquivos `.md` focados em `.claude/rules/`.
   - [ ] Reduza o tamanho do prompt dos agentes, removendo o que agora é regra global.

3. **Análise de Impacto (Rastreabilidade):**
   - [ ] Adicione ao `package.json` a dependência `madge` (ou similar) para análise de dependências circulares e árvores de impacto.
   - [ ] Atualize o `code-reviewer.md` para **exigir** a execução de `npx madge --circular` antes de aprovar PRs ou refatorações estruturais.

4. **Organização Documental (Consumo por IA):**
   - [ ] Crie as pastas `docs/plans/`, `docs/evidence/`, e `docs/methodology/`.
   - [ ] Mova os 17 arquivos `.md` soltos na raiz de `docs/` para as pastas corretas (ex: `VALIDACAO_*.md` vai para `evidence/`, `PLANO_*.md` vai para `plans/`).
```
