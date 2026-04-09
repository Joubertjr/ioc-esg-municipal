# LLMWiki: O Portal de Conhecimento Vivo do Projeto

Este documento apresenta uma análise complementar do padrão "LLMWiki" [1], reposicionando-o não como um substituto arquitetural para o sistema de dados do projeto, mas como uma **camada de conhecimento viva e colaborativa**. O objetivo é transformar o LLMWiki em um portal unificado que atenda a desenvolvedores, áreas de negócio e usuários finais, alimentado organicamente pela própria jornada de desenvolvimento dos projetos (como o ESG Municipal e o WhatsApp Ingest).

---

## 1. A Verdadeira Proposta do LLMWiki: Compounding de Conhecimento

A leitura anterior focou excessivamente na mecânica de armazenamento (arquivos Markdown vs. Bancos de Dados) e perdeu a essência do que Andrej Karpathy propôs: **a acumulação contínua de inteligência**. 

O problema central que o LLMWiki resolve não é apenas "como o RAG busca dados", mas **"como evitamos perder o contexto e o raciocínio gerado a cada iteração do projeto"** [1]. Atualmente, quando o Claude Code resolve um problema complexo de integração no módulo do WhatsApp ou cria uma nova métrica no projeto ESG, esse raciocínio se perde no histórico do chat ou fica enterrado em commits.

A proposta é que o LLMWiki atue como um **artefato persistente e composto** (compounding artifact). Ele não substitui o código ou o banco de dados; ele se senta *ao lado* deles, atuando como o "cérebro" do projeto.

### 1.1. O Wiki como Portal Unificado

O LLMWiki deve ser estruturado para servir a três públicos distintos, extraindo valor das mesmas fontes brutas:

*   **Para o Desenvolvedor (Claude Code / Equipe):** Documentação de arquitetura, decisões de design (ADRs), esquemas de banco de dados, fluxos de integração (ex: como o worker do WhatsApp se conecta ao RabbitMQ), e histórico de refatorações.
*   **Para o Negócio (Stakeholders):** Regras de cálculo dos ODS, fontes de dados governamentais utilizadas (ex: DATASUS, INEP), defasagem aceitável de dados, e o racional por trás das pontuações ESG.
*   **Para o Usuário Final:** Manuais de uso, explicações claras sobre o que cada indicador significa para o seu município, e FAQs dinâmicos gerados a partir das dúvidas mais comuns.

---

## 2. A Jornada de Desenvolvimento como Motor de Ingestão

A genialidade do padrão LLMWiki é que a manutenção não é feita por humanos, mas pelo próprio LLM [1]. Para que o portal de conhecimento do projeto ESG (ou WhatsApp) esteja sempre atualizado e enriquecido, a própria **jornada de desenvolvimento deve ser a fonte de ingestão**.

### 2.1. O Fluxo de Trabalho (Workflow) Proposto

A integração do LLMWiki ao fluxo de trabalho diário do Claude Code transforma a documentação de um "fardo pós-desenvolvimento" para um "subproduto natural da engenharia":

1.  **Ação (Desenvolvimento):** O Claude Code implementa uma nova feature (ex: correção do teste circular no LongMemEval).
2.  **Ingestão Automática (Ingest):** Ao finalizar a tarefa, o Claude Code não apenas faz o commit do código. Ele lê o diff, entende o contexto da mudança, e **atualiza a Wiki do projeto**.
    *   *Exemplo:* Ele atualiza a página `wiki/arquitetura/longmemeval.md` explicando o novo padrão Adapter implementado.
3.  **Atualização de Relacionamentos:** O LLM atualiza o `index.md` do projeto e modifica páginas correlatas. Se a mudança afetou a forma como os dados do INEP são consumidos, a página `wiki/negocio/fontes_dados.md` também é atualizada.
4.  **Log Cronológico:** Um registro é adicionado ao `wiki/log.md` documentando o que foi alterado e o porquê.

### 2.2. O Ciclo de Consulta e Síntese (Query & Synthesize)

Quando um stakeholder de negócio pergunta: *"Por que a nota de saúde (ODS 3) do município caiu?"*, o agente não precisa ler o código-fonte. Ele consulta a Wiki.

Mais importante, a resposta gerada para o stakeholder (uma análise detalhada das fontes DATASUS) não é descartada. Seguindo o princípio de *compounding* do LLMWiki, **essa resposta bem-sucedida é arquivada de volta na Wiki como uma nova página** (ex: `wiki/analises/queda_ods3_abril2026.md`) [1]. A Wiki cresce por exploração.

---

## 3. Plano de Implementação: A Wiki por Projeto

Para materializar esta visão, devemos estabelecer uma estrutura padronizada de Wiki que o Claude Code possa inicializar e manter para cada projeto (ESG, WhatsApp, etc.).

### 3.1. Estrutura de Diretórios da Wiki

Cada projeto deve conter um diretório `/wiki` na raiz do repositório, estruturado da seguinte forma:

```text
/wiki
├── index.md                  # O catálogo mestre, mantido pelo LLM
├── log.md                    # Registro cronológico append-only (ex: ## [2026-04-09] ingest | Refatoração LongMemEval)
├── /dev                      # Portal do Desenvolvedor
│   ├── arquitetura.md
│   ├── adrs/                 # Architecture Decision Records
│   └── integracoes/          # Ex: whatsapp_worker_flow.md
├── /negocio                  # Portal de Negócios
│   ├── regras_calculo.md     # Ex: Como o Score Geométrico funciona
│   └── fontes_dados.md       # Ex: Status e defasagem do IEPS, DATASUS
├── /usuario                  # Portal do Usuário Final
│   ├── faq.md
│   └── guia_indicadores.md
└── /sinteses                 # Onde as respostas complexas são arquivadas (Compounding)
```

### 3.2. O Arquivo de Schema (O "Contrato" do LLM)

O coração do LLMWiki é o arquivo de configuração (Schema) [1]. Devemos criar um arquivo `.claude/wiki_schema.md` que instrua o Claude Code sobre como atuar como o "mantenedor disciplinado" da Wiki.

**Regras do Schema para o Claude Code:**
1.  **Obrigatoriedade Pós-Tarefa:** Após qualquer modificação significativa de código, o Claude Code *deve* invocar a rotina de Ingestão da Wiki antes de finalizar a sessão.
2.  **Atualização em Cascata:** Se uma regra de negócio mudar no código, o Claude Code deve procurar e atualizar todas as páginas na pasta `/negocio` que referenciam essa regra.
3.  **Auditoria Contínua (Lint):** Semanalmente, o Claude Code deve rodar um script de linting na Wiki para encontrar contradições entre a documentação e o estado atual do código.

---

## 4. Conclusão

O LLMWiki não é um banco de dados vetorial disfarçado de Markdown; é uma **prática de engenharia de conhecimento**. Ao adotarmos este padrão como um complemento ao projeto IOC ESG Municipal, transformamos o Claude Code de um mero "escritor de código" para um "curador intelectual" do projeto. 

Toda a documentação do WhatsApp, as regras de negócio do ESG, e as decisões arquiteturais estarão sempre atualizadas, interligadas e prontas para consumo por qualquer audiência, crescendo organicamente a cada commit.

## Referências

[1] Karpathy, A. (2026). *LLM Wiki*. GitHub Gist. https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md
