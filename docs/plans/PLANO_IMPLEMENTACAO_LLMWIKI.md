# Plano de Implementação: LLMWiki no Projeto ESG Municipal

Este documento define o plano de ação executável para o Claude Code implementar o padrão LLMWiki [1] como o portal de conhecimento vivo do projeto IOC ESG Municipal. O objetivo é unificar a documentação dispersa e criar um motor de curadoria contínua alimentado pela jornada de desenvolvimento.

---

## 1. Visão Geral da Arquitetura

A implementação será baseada em três pilares fundamentais:

1.  **Estrutura de Diretórios (`/wiki`):** O artefato persistente e composto.
2.  **Schema de Governança (`.claude/wiki_schema.md`):** As regras do jogo para o LLM.
3.  **Agentes Especializados:** O "motor" autônomo (Ingest, Query, Lint, Orchestrator).

---

## 2. Fases de Implementação

O Claude Code deve executar as seguintes fases sequencialmente.

### Fase 1: Setup da Infraestrutura Wiki

**Objetivo:** Criar a base estrutural e as regras de governança.

1.  Criar o diretório raiz `/wiki` e seus subdiretórios:
    - `/wiki/dev` (Portal do Desenvolvedor)
    - `/wiki/negocio` (Portal de Negócios)
    - `/wiki/usuario` (Portal do Usuário Final)
    - `/wiki/sinteses` (Repositório de Compounding)
2.  Criar os arquivos de controle raiz:
    - `/wiki/index.md` (Catálogo vazio, com cabeçalhos por categoria)
    - `/wiki/log.md` (Registro append-only vazio)
3.  Criar o Schema de Governança em `.claude/wiki_schema.md`. Este arquivo deve instruir os agentes sobre a estrutura acima e as regras de atualização (ex: "sempre atualize o log após modificar uma página").
4.  Modificar o arquivo `CLAUDE.md` na raiz do projeto para incluir uma diretiva obrigatória: _"Ao final de cada tarefa complexa, execute o comando `/wiki-ingest` para documentar o conhecimento gerado."_

### Fase 2: Implantação dos Agentes Especializados

**Objetivo:** Dar vida ao motor autônomo do LLMWiki.

1.  Mover os 4 agentes planejados para o diretório `.claude/agents/`:
    - `wiki-ingestor.md` (Curador contínuo)
    - `wiki-linter.md` (Auditor de consistência)
    - `wiki-query.md` (Sintetizador)
    - `wiki-orchestrator.md` (Coordenador mestre)
2.  Criar os comandos correspondentes em `.claude/commands/`:
    - `wiki-ingest.md`: Aciona o `wiki-ingestor` passando o diff recente.
    - `wiki-lint.md`: Aciona o `wiki-linter` para gerar relatório.
    - `wiki-query.md`: Aciona o `wiki-query` para responder e fazer compounding.

### Fase 3: Bootstrap (A Grande Ingestão)

**Objetivo:** Povoar a Wiki inicial consolidando a documentação dispersa existente no projeto.

O `wiki-orchestrator` deve ser acionado para coordenar a ingestão dos seguintes diretórios legados:

1.  **Planos de Arquitetura:** Ler todos os arquivos em `docs/plans/` e sintetizá-los em `/wiki/dev/arquitetura.md` e `/wiki/dev/adrs/`.
2.  **Relatórios de Evidência:** Ler os relatórios em `docs/evidence/` e extrair o histórico de evolução para `/wiki/sinteses/historico_fases.md`.
3.  **Especificações Técnicas:** Ler `docs/especificacao/` e popular `/wiki/negocio/regras_calculo.md` e `/wiki/negocio/fontes_dados.md`.
4.  **Auditoria e Monitoramento:** Ler `docs/evidence/audit/` e `docs/reports/` e criar `/wiki/dev/status_seguranca.md`.

_Critério de Aceite da Fase 3:_ A pasta `/wiki` deve conter um `index.md` rico, interligando todo o conhecimento legado de forma coesa, sem contradições aparentes, e o `log.md` deve registrar a "Grande Ingestão".

---

## 3. Prompt de Execução para o Claude Code

Para iniciar a implementação, copie e cole o prompt abaixo no terminal do Claude Code:

```text
/orchestrator Inicie a implementação do padrão LLMWiki no projeto IOC ESG Municipal.
Objetivo: Criar um portal de conhecimento vivo (/wiki) alimentado organicamente pela jornada de desenvolvimento.

Siga estritamente o plano definido em `docs/plans/PLANO_IMPLEMENTACAO_LLMWIKI.md`.

Passos imediatos:
1. Leia o plano completo.
2. Execute a Fase 1 (Setup da Infraestrutura e Schema).
3. Execute a Fase 2 (Implantação dos Agentes e Comandos). Os templates dos agentes já estão rascunhados em `docs/plans/wiki-*.md` — mova-os para `.claude/agents/` e refine-os.
4. Execute a Fase 3 (Bootstrap). Use seu poder de paralelismo para varrer `docs/plans/`, `docs/evidence/`, e `docs/especificacao/` e compilar o conhecimento legado na nova estrutura `/wiki`.

Ao final, gere um relatório de status mostrando a árvore de diretórios gerada em `/wiki` e o conteúdo inicial do `index.md`.
```

## Referências

[1] Karpathy, A. (2026). _LLM Wiki_. GitHub Gist. https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md
