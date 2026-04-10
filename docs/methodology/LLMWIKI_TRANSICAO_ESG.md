# LLMWiki: Transição Arquitetural para o Contexto ESG Municipal

Este documento formaliza a análise do padrão "LLMWiki", proposto por Andrej Karpathy em abril de 2026 [1], e detalha sua transição estrutural e metodológica para o ecossistema do projeto IOC ESG Municipal. O objetivo é superar as limitações do RAG (Retrieval-Augmented Generation) tradicional [2], implementando uma base de conhecimento persistente, estruturada e autogerenciada, adaptada aos rigorosos requisitos de governança de dados governamentais e corporativos.

---

## 1. Fundamentação Teórica: O Padrão LLMWiki

A arquitetura RAG convencional sofre de um problema crônico de amnésia estrutural: a cada nova consulta, o modelo redescobre o conhecimento a partir do zero, fragmentando documentos em vetores matemáticos (chunks) que perdem seu contexto intrínseco [1] [2]. O padrão LLMWiki propõe uma mudança de paradigma, tratando os modelos de linguagem (LLMs) não apenas como motores de busca, mas como "compiladores de conhecimento".

### 1.1. Arquitetura em Três Camadas

A proposta original divide a gestão do conhecimento em camadas imutáveis e dinâmicas:

- **Fontes Brutas (Raw Sources):** O repositório imutável de dados originais (artigos, relatórios, dados crus). O LLM lê esta camada, mas nunca a modifica [1].
- **O Wiki Compilado:** Um diretório de arquivos estruturados (Markdown) gerados e mantidos exclusivamente pelo LLM. Contém resumos, páginas de entidades, sínteses temáticas e, crucialmente, referências cruzadas explícitas. É um artefato persistente e composto [1].
- **O Schema (Configuração):** O documento de governança (ex: `CLAUDE.md`) que instrui o agente sobre as regras de estruturação, nomenclatura e fluxos de trabalho esperados durante a ingestão e manutenção [1].

### 1.2. Ciclo de Vida do Conhecimento

O padrão opera através de três rotinas principais, automatizando o trabalho intelectual de organização:

- **Ingestão (Ingest):** A leitura completa de uma nova fonte, seguida da criação de sínteses, atualização de índices e modificação em cascata de páginas correlatas, estabelecendo conexões imediatas [1].
- **Consulta (Query):** A busca direcionada ao Wiki compilado, não aos dados brutos. As respostas geradas (tabelas, análises, gráficos) são reincorporadas ao Wiki como novas páginas, garantindo que a exploração produza um crescimento composto (compounding) [1].
- **Auditoria (Lint):** A verificação autônoma e periódica da saúde do Wiki, identificando contradições, dados obsoletos e lacunas de cobertura [1].

---

## 2. Limitações Enterprise e a Necessidade de Adaptação

Embora o LLMWiki seja revolucionário para a gestão de conhecimento pessoal (PKM), sua implementação estrita como um diretório local de arquivos Markdown apresenta vulnerabilidades críticas quando transposta para um ambiente corporativo ou governamental, como o IOC ESG Municipal [2].

A análise da arquitetura revela falhas estruturais em cenários multi-tenant:

- **Controle de Acesso (RBAC):** Sistemas de arquivos locais não suportam controle de acesso granular baseado em funções. Em um contexto onde dados de diferentes municípios coexistem, a segurança não pode depender de permissões de diretório (`chmod`) [2].
- **Auditoria e Conformidade:** O histórico do Git, embora útil para desenvolvimento, não atende aos requisitos de trilhas de auditoria compliance-grade necessários para dados públicos e avaliações ESG [2].
- **Escalabilidade e Exfiltração:** A gestão de milhões de documentos e interações em arquivos de texto plano gera gargalos de I/O e cria um risco inaceitável de exfiltração de dados em massa (um simples comando `zip` compromete toda a inteligência da plataforma) [2].

A transição para o IOC ESG Municipal exige, portanto, a adoção dos princípios do LLMWiki (estruturação, persistência e compilação), mas implementados sobre uma infraestrutura robusta, como um **Grafo Semântico** (Semantic Graph) [2].

---

## 3. Transição para o IOC ESG Municipal

A integração do padrão LLMWiki ao projeto ESG requer a adaptação das três camadas e das rotinas operacionais para o ecossistema existente de agentes coletores, Redis, e serviços de pontuação (scoring).

### 3.1. Arquitetura Adaptada (Semantic Graph ESG)

A implementação no IOC ESG Municipal abandona os arquivos Markdown em favor de nós estruturados em banco de dados, mantendo a filosofia de compilação:

- **Camada 1: Fontes Brutas Governamentais**
  - _O que é:_ As APIs e JSONs originais dos 15 agentes coletores (IBGE, DATASUS, INEP, etc.).
  - _Papel do LLM:_ Os agentes (ex: `datasus_collector.ts`) continuam atuando como extratores fiéis da fonte original, sem mutação.

- **Camada 2: O Grafo de Conhecimento ESG (O "Wiki")**
  - _O que é:_ Em vez de arquivos `.md`, o conhecimento é compilado em objetos estruturados (`MunicipalOdsReport` e `OdsIndicator`) e armazenado com referências explícitas (ex: Município → ODS 3 → Indicador Mortalidade).
  - _Papel do LLM:_ O serviço de scoring (`ods_score_service.ts`) atua como o "compilador", processando os dados brutos e estabelecendo as relações semânticas e pontuações consolidadas.

- **Camada 3: O Schema de Governança**
  - _O que é:_ Os arquivos Zod (ex: `ods.ts`) e o `CLAUDE.md` do projeto.
  - _Papel do LLM:_ Garantem que a estrutura do grafo obedeça estritamente aos 17 ODS da ONU e às regras de negócio da plataforma.

### 3.2. Operações de Manutenção Autônoma

As rotinas do LLMWiki são traduzidas para processos contínuos (daemons) na plataforma:

- **Ingestão Contínua:** Implementação de filas assíncronas (ex: Bull Queue) onde novos dados governamentais acionam a recompilação automática do nó do município afetado, propagando atualizações de score em cascata.
- **Consulta (Query) e Compounding:** A integração com o Model Context Protocol (MCP) permitirá que os agentes de IA não apenas consultem o grafo para gerar relatórios, mas gravem as análises complexas geradas de volta no sistema como "Insights Persistentes", enriquecendo o perfil do município.
- **Linting de Dados (Auditoria):** O Agente Auditor (`audit-agent.md`), já implementado, assume o papel da operação "Lint". Ele deve ser expandido para verificar ativamente contradições de dados (ex: defasagem de anos entre fontes) e alertar sobre a necessidade de atualização de coletores específicos.

## 4. Próximos Passos de Implementação

Para materializar esta transição, o fluxo de trabalho dos assistentes de código (Claude Code) deve focar nas seguintes entregas:

1.  **Integração MCP:** Configurar o servidor MCP para expor o grafo de dados ODS aos agentes de forma estruturada, substituindo buscas textuais rudimentares.
2.  **Módulo de Insights Persistentes:** Criar a estrutura de dados (schema) para armazenar as análises geradas pelas consultas (Query) associadas aos municípios, concretizando o princípio de _compounding_.
3.  **Expansão do Agente Auditor:** Incorporar regras de verificação de frescor de dados (data freshness) e consistência cruzada entre coletores na rotina de Linting.

---

## Referências

[1] Karpathy, A. (2026). _LLM Wiki_. GitHub Gist. https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md
[2] Epsilla. (2026). _Did Karpathy's 'LLM Wiki' Just Kill RAG? The Enterprise Verdict_. https://www.epsilla.com/blogs/llm-wiki-kills-rag-karpathy-enterprise-semantic-graph
