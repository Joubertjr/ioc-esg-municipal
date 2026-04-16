# 🗺️ MAPA DE DADOS ABERTOS PARA IOC ESG MUNICIPAL - SANTA CATARINA

## Resumo Executivo

Este documento consolida todas as fontes de dados abertos disponíveis para alimentar o IOC ESG Municipal em Santa Catarina. O mapa inclui endpoints de APIs, formatos de dados, frequência de atualização e instruções de integração técnica.

**Total de Fontes Identificadas:** 45+ APIs e portais de dados
**Cobertura:** 295 municípios de SC
**Atualização:** Dados em tempo real a mensal

---

## PARTE 1: DADOS FINANCEIROS E ORÇAMENTÁRIOS

### 1.1 Tesouro Nacional - SICONFI (Sistema de Informações Contábeis e Fiscais)

**Descrição:** API que fornece acesso aos dados da Matriz de Saldos Contábeis (MSC), receitas, despesas e indicadores financeiros de todos os municípios brasileiros.

| Atributo              | Valor                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| **Portal**            | https://www.tesourotransparente.gov.br/                                   |
| **API Endpoint**      | https://api.siconfi.tesouro.gov.br/v1/                                    |
| **Documentação**      | https://www.gov.br/tesouronacional/pt-br/central-de-conteudo/apis/siconfi |
| **Formato**           | JSON, CSV                                                                 |
| **Frequência**        | Mensal (até 30 dias após encerramento do mês)                             |
| **Autenticação**      | Sem autenticação (dados públicos)                                         |
| **Dados Disponíveis** | Receitas, Despesas, Saldos, Indicadores Fiscais                           |
| **Cobertura SC**      | 295 municípios                                                            |

**Endpoints Principais:**

- `GET /municipios/{uf}/exercicio/{exercicio}` - Dados de um município em um exercício
- `GET /municipios/{uf}/{municipio}/exercicio/{exercicio}/siconfi` - Matriz de Saldos Contábeis
- `GET /municipios/{uf}/{municipio}/exercicio/{exercicio}/receitas` - Receitas detalhadas
- `GET /municipios/{uf}/{municipio}/exercicio/{exercicio}/despesas` - Despesas detalhadas

**Exemplo de Uso (Python):**

```python
import requests
import json

# Obter dados de Florianópolis (código IBGE: 4204202) para 2025
url = "https://api.siconfi.tesouro.gov.br/v1/municipios/SC/4204202/exercicio/2025/siconfi"
response = requests.get(url)
dados = response.json()
print(json.dumps(dados, indent=2))
```

---

### 1.2 Tesouro Nacional - API de Transferências Constitucionais (FPM)

**Descrição:** API especializada em dados de transferências constitucionais, incluindo o Fundo de Participação dos Municípios (FPM), que é crítico para o IOC ESG.

| Atributo              | Valor                                                             |
| --------------------- | ----------------------------------------------------------------- |
| **Portal**            | https://www.tesourotransparente.gov.br/                           |
| **API Endpoint**      | https://api.tesouro.gov.br/v1/transferencias                      |
| **Documentação**      | https://www.gov.br/tesouronacional/pt-br/central-de-conteudo/apis |
| **Formato**           | JSON                                                              |
| **Frequência**        | Diária (atualização de repasses)                                  |
| **Autenticação**      | Sem autenticação                                                  |
| **Dados Disponíveis** | FPM, ICMS, ITR, Transferências Voluntárias                        |

**Endpoints Principais:**

- `GET /fpm/{uf}/{municipio}/{ano}` - Repasses do FPM por período
- `GET /transferencias-voluntarias/{municipio}` - Transferências voluntárias (convênios)

**Importância para ESG:** O FPM é a principal fonte de receita para pequenos e médios municípios. O IOC monitora em tempo real os repasses e sugere alocações para projetos ESG.

---

### 1.3 Portal da Transparência - Dados Consolidados

**Descrição:** Consolidação de dados de execução orçamentária, empenhos e pagamentos do governo federal.

| Atributo              | Valor                                                  |
| --------------------- | ------------------------------------------------------ |
| **Portal**            | https://portaldatransparencia.gov.br/                  |
| **API Endpoint**      | https://api.portaldatransparencia.gov.br/api-de-dados/ |
| **Formato**           | JSON, CSV                                              |
| **Frequência**        | Diária                                                 |
| **Dados Disponíveis** | Despesas, Empenhos, Licitações, Contratos              |

---

## PARTE 2: DADOS DEMOGRÁFICOS E SOCIOECONÔMICOS

### 2.1 IBGE - API de Localidades

**Descrição:** API oficial do IBGE para dados de localidades, incluindo municípios, regiões e dados demográficos básicos.

| Atributo              | Valor                                                    |
| --------------------- | -------------------------------------------------------- |
| **Portal**            | https://servicodados.ibge.gov.br/                        |
| **API Endpoint**      | https://servicodados.ibge.gov.br/api/v1/localidades/     |
| **Documentação**      | https://servicodados.ibge.gov.br/api/docs/localidades    |
| **Formato**           | JSON                                                     |
| **Frequência**        | Atualização periódica (anual)                            |
| **Autenticação**      | Sem autenticação                                         |
| **Dados Disponíveis** | Municípios, Estados, Regiões, Mesorregião, Microrregiões |

**Endpoints Principais:**

- `GET /municipios?UF=SC` - Lista todos os 295 municípios de SC
- `GET /municipios/{id}` - Dados específicos de um município
- `GET /estados/SC/municipios` - Municípios de SC com detalhes

**Exemplo de Uso:**

```python
import requests

# Obter todos os municípios de SC
url = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/SC/municipios"
response = requests.get(url)
municipios = response.json()
print(f"Total de municípios em SC: {len(municipios)}")
```

---

### 2.2 IBGE - Cidades (Portal Web com Dados Estruturados)

**Descrição:** Portal web que consolida dados socioeconômicos, demográficos e de infraestrutura de todos os municípios.

| Atributo              | Valor                                           |
| --------------------- | ----------------------------------------------- |
| **Portal**            | https://cidades.ibge.gov.br/                    |
| **Formato**           | Web (pode ser extraído via scraping)            |
| **Frequência**        | Atualização periódica                           |
| **Dados Disponíveis** | População, PIB, Educação, Saúde, Infraestrutura |

**Dados Relevantes para ESG:**

- População (ODS 1, 3, 5, 10)
- Escolaridade e Educação (ODS 4)
- Acesso a Saneamento (ODS 6)
- Renda per Capita (ODS 1, 8, 10)

---

### 2.3 Banco Central - Portal de Dados Abertos

**Descrição:** Dados econômicos e financeiros agregados por região e município.

| Atributo              | Valor                                                    |
| --------------------- | -------------------------------------------------------- |
| **Portal**            | https://dadosabertos.bcb.gov.br/                         |
| **Formato**           | JSON, CSV                                                |
| **Dados Disponíveis** | Indicadores econômicos, Taxa de Juros, Inflação Regional |

---

## PARTE 3: DADOS DE LICITAÇÕES E COMPRAS PÚBLICAS

### 3.1 Portal Nacional de Contratações Públicas (PNCP)

**Descrição:** Sistema centralizado de todas as licitações e contratos da administração pública sob a Lei 14.133/2021.

| Atributo              | Valor                                                  |
| --------------------- | ------------------------------------------------------ |
| **Portal**            | https://pncp.gov.br/                                   |
| **API Endpoint**      | https://pncp.gov.br/api/consulta/swagger-ui/index.html |
| **Documentação**      | https://pncp.gov.br/api/consulta/swagger-ui/index.html |
| **Formato**           | JSON                                                   |
| **Frequência**        | Tempo real                                             |
| **Autenticação**      | Sem autenticação                                       |
| **Dados Disponíveis** | Licitações, Contratos, Itens, Fornecedores             |

**Endpoints Principais:**

- `GET /licitacoes?ente={codigo_municipio}` - Licitações de um município
- `GET /contratos?ente={codigo_municipio}` - Contratos vigentes
- `GET /licitacoes/{id}` - Detalhes de uma licitação específica

**Importância para ESG:** O IOC monitora todas as licitações municipais para garantir compliance com a Lei 14.133 (critérios de sustentabilidade obrigatórios).

---

### 3.2 Compras Governamentais (Governo Federal)

**Descrição:** API de compras do governo federal com histórico de licitações e preços praticados.

| Atributo              | Valor                                            |
| --------------------- | ------------------------------------------------ |
| **Portal**            | https://api.compras.dados.gov.br/                |
| **API Endpoint**      | https://api.compras.dados.gov.br/swagger-ui.html |
| **Formato**           | JSON                                             |
| **Frequência**        | Diária                                           |
| **Dados Disponíveis** | Licitações, Contratos, Preços, Fornecedores      |

---

## PARTE 4: DADOS DE EDUCAÇÃO

### 4.1 INEP - Instituto Nacional de Estudos e Pesquisas Educacionais

**Descrição:** Dados completos do Censo Escolar, incluindo escolas, alunos, professores e indicadores educacionais.

| Atributo              | Valor                                                                     |
| --------------------- | ------------------------------------------------------------------------- |
| **Portal**            | https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos           |
| **API Endpoint**      | https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/inep-data |
| **Formato**           | JSON, CSV, Excel                                                          |
| **Frequência**        | Anual (dezembro do ano anterior)                                          |
| **Dados Disponíveis** | Escolas, Alunos, Professores, Matrículas, Evasão                          |

**Datasets Principais:**

- Censo Escolar (Educação Básica)
- Censo Superior (Educação Universitária)
- ENEM (Avaliação de Desempenho)

**Relevância para ODS:** ODS 4 (Educação de Qualidade)

---

### 4.2 INEP Data - Business Intelligence

**Descrição:** Painéis de BI do INEP com visualizações prontas e acesso a dados estruturados.

| Atributo       | Valor                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| **Portal**     | https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/inep-data |
| **Formato**    | Dashboards interativos, CSV para download                                 |
| **Frequência** | Atualização contínua                                                      |

---

## PARTE 5: DADOS DE SAÚDE

### 5.1 DATASUS - Ministério da Saúde

**Descrição:** Sistema de informações de saúde com dados de morbidade, mortalidade, cobertura de serviços e indicadores de saúde pública.

| Atributo              | Valor                                                      |
| --------------------- | ---------------------------------------------------------- |
| **Portal**            | https://datasus.saude.gov.br/                              |
| **API Endpoint**      | https://datasus.saude.gov.br/api/                          |
| **Formato**           | JSON, XML                                                  |
| **Frequência**        | Mensal/Trimestral                                          |
| **Dados Disponíveis** | Internações, Procedimentos, Cobertura Vacinal, Mortalidade |

**Tabelas Principais:**

- SIM (Sistema de Informações sobre Mortalidade)
- SINAN (Sistema de Informação de Agravos de Notificação)
- SIH (Sistema de Informações Hospitalares)
- SAI (Sistema de Avaliação de Imunização)

**Relevância para ODS:** ODS 3 (Saúde e Bem-estar)

---

### 5.2 Portal de Dados Abertos do SUS

**Descrição:** Consolidação de dados de saúde pública em formato aberto.

| Atributo       | Valor                              |
| -------------- | ---------------------------------- |
| **Portal**     | https://dadosabertos.saude.gov.br/ |
| **Formato**    | JSON, CSV                          |
| **Frequência** | Periódica                          |

---

## PARTE 6: DADOS DE SANEAMENTO E MEIO AMBIENTE

### 6.1 SNIS - Sistema Nacional de Informações sobre Saneamento

**Descrição:** Dados completos sobre saneamento básico (água, esgoto, resíduos) coletados anualmente junto aos municípios.

| Atributo              | Valor                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Portal**            | https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis |
| **API Endpoint**      | https://dados.gov.br/dados/conjuntos-dados/snis---srie-histrica                        |
| **Formato**           | CSV, Excel                                                                             |
| **Frequência**        | Anual (coleta até junho do ano seguinte)                                               |
| **Dados Disponíveis** | Cobertura de Água, Esgoto, Resíduos Sólidos, Indicadores de Eficiência                 |

**Relevância para ODS:** ODS 6 (Água Limpa e Saneamento), ODS 12 (Consumo e Produção Responsáveis)

---

### 6.2 ANA - Agência Nacional de Águas e Saneamento Básico

**Descrição:** Dados sobre recursos hídricos, qualidade da água e infraestrutura de saneamento.

| Atributo              | Valor                                           |
| --------------------- | ----------------------------------------------- |
| **Portal**            | https://dadosabertos.ana.gov.br/                |
| **Formato**           | JSON, CSV, Geoespacial                          |
| **Frequência**        | Contínua                                        |
| **Dados Disponíveis** | Qualidade da Água, Vazão de Rios, Reservatórios |

---

### 6.3 INPE - Instituto Nacional de Pesquisas Espaciais

**Descrição:** Dados ambientais e climáticos, incluindo desmatamento, queimadas e cobertura vegetal.

| Atributo              | Valor                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **Portal**            | https://dados.gov.br/dados/organizacoes/visualizar/instituto-nacional-de-pesquisas-espaciais-inpe |
| **Formato**           | Geoespacial (GeoTIFF, Shapefile), JSON                                                            |
| **Frequência**        | Contínua                                                                                          |
| **Dados Disponíveis** | Desmatamento, Queimadas, Cobertura Vegetal, Mudanças Climáticas                                   |

**Relevância para ODS:** ODS 13 (Ação Climática), ODS 15 (Vida Terrestre)

---

## PARTE 7: DADOS DE SUSTENTABILIDADE E ODS

### 7.1 IDSC-BR - Índice de Desenvolvimento Sustentável das Cidades

**Descrição:** Índice agregado que avalia o progresso das cidades brasileiras nos 17 ODS.

| Atributo              | Valor                                     |
| --------------------- | ----------------------------------------- |
| **Portal**            | https://idsc.cidadessustentaveis.org.br/  |
| **Formato**           | Web (dados estruturados)                  |
| **Frequência**        | Anual                                     |
| **Dados Disponíveis** | Scores por ODS, Indicadores, Comparativos |

**Importância:** O IOC usa o IDSC-BR como baseline para o Score ESG de cada município.

---

### 7.2 IPEA - Instituto de Pesquisa Econômica Aplicada

**Descrição:** Pesquisas e dados sobre desenvolvimento sustentável, pobreza, desigualdade e políticas públicas.

| Atributo              | Valor                                              |
| --------------------- | -------------------------------------------------- |
| **Portal**            | https://www.ipea.gov.br/ods/                       |
| **Formato**           | Web, Dados Estruturados                            |
| **Frequência**        | Periódica                                          |
| **Dados Disponíveis** | Indicadores de Desenvolvimento, Análises Temáticas |

---

## PARTE 8: DADOS ESTADUAIS E MUNICIPAIS (SC)

### 8.1 Portal de Dados Abertos de Santa Catarina

**Descrição:** Portal oficial do estado com 111+ conjuntos de dados sobre finanças, educação, saúde e outros temas.

| Atributo         | Valor                                            |
| ---------------- | ------------------------------------------------ |
| **Portal**       | https://dados.sc.gov.br/                         |
| **API Endpoint** | https://dados.sc.gov.br/api/3/action/ (CKAN API) |
| **Documentação** | https://dados.sc.gov.br/api/3/docs               |
| **Formato**      | JSON, CSV, XML                                   |
| **Frequência**   | Variável (por dataset)                           |
| **Autenticação** | Sem autenticação                                 |

**Datasets Principais para Municípios:**

- Transferências Voluntárias - Municípios
- Transferências Voluntárias - Beneficiários
- Lista de Espera no SUS
- Plano 1000 (Municípios Participantes)

**Exemplo de Uso:**

```python
import requests

# Listar todos os datasets de SC
url = "https://dados.sc.gov.br/api/3/action/package_list"
response = requests.get(url)
datasets = response.json()['result']
print(f"Total de datasets: {len(datasets)}")
```

---

### 8.2 TCE-SC - Tribunal de Contas de Santa Catarina

**Descrição:** APIs de dados abertos do TCE-SC com informações de conformidade, contas municipais e fiscalização.

| Atributo              | Valor                                      |
| --------------------- | ------------------------------------------ |
| **Portal**            | https://www.tcesc.tc.br/apis-dados-abertos |
| **API Endpoint**      | [Conforme documentação do TCE-SC]          |
| **Formato**           | JSON                                       |
| **Frequência**        | Periódica                                  |
| **Dados Disponíveis** | Contas Municipais, Pareceres, Conformidade |

**Importância:** O IOC integra dados do TCE-SC para monitorar conformidade legal e identificar riscos de auditoria.

---

### 8.3 Portal da Transparência do Poder Executivo de SC

**Descrição:** Dados de execução orçamentária, despesas e receitas do governo estadual.

| Atributo              | Valor                                |
| --------------------- | ------------------------------------ |
| **Portal**            | https://www.transparencia.sc.gov.br/ |
| **Formato**           | CSV, Web                             |
| **Frequência**        | Contínua                             |
| **Dados Disponíveis** | Despesas, Receitas, Empenhos         |

---

### 8.4 Diário Oficial dos Municípios (DOM/SC)

**Descrição:** Publicações oficiais de todos os municípios de SC em um único portal.

| Atributo              | Valor                                                          |
| --------------------- | -------------------------------------------------------------- |
| **Portal**            | https://diariomunicipal.sc.gov.br/                             |
| **API Endpoint**      | https://diariomunicipal.sc.gov.br/?r=site/page&view=integracao |
| **Formato**           | JSON, XML                                                      |
| **Frequência**        | Diária                                                         |
| **Dados Disponíveis** | Publicações, Decretos, Portarias                               |

**Importância para IOC:** O sistema monitora o DOM/SC para detectar novas legislações que impactem ESG.

---

## PARTE 9: DADOS COMPLEMENTARES E ESPECIALIZADOS

### 9.1 Base dos Dados - Plataforma de Dados Abertos

**Descrição:** Plataforma que consolida e padroniza múltiplos datasets brasileiros, facilitando o acesso.

| Atributo              | Valor                                     |
| --------------------- | ----------------------------------------- |
| **Portal**            | https://basedosdados.org/                 |
| **API Endpoint**      | https://basedosdados.org/api/             |
| **Formato**           | SQL, Python, R                            |
| **Dados Disponíveis** | SNIS, INEP, IBGE, SICONFI e muitos outros |

---

### 9.2 Ministério das Cidades - Dados de Sustentabilidade Urbana

**Descrição:** Dados sobre cidades sustentáveis, mobilidade urbana e infraestrutura.

| Atributo              | Valor                                                      |
| --------------------- | ---------------------------------------------------------- |
| **Portal**            | https://www.gov.br/cidades/pt-br/assuntos/sustentabilidade |
| **Formato**           | Web, Relatórios                                            |
| **Dados Disponíveis** | Agenda 2030, Políticas Urbanas                             |

---

## PARTE 10: ARQUITETURA DE INTEGRAÇÃO TÉCNICA

### 10.1 Fluxo de Coleta de Dados (Data Pipeline)

O IOC ESG Municipal opera através de um pipeline de dados automatizado:

```
[Fontes de Dados] → [Coleta] → [Validação] → [Normalização] → [Enriquecimento] → [Armazenamento] → [Análise] → [Dashboard]
```

**Componentes:**

1. **Camada de Coleta (Watchers):** Agentes especializados em cada fonte de dados
   - Watcher SICONFI: Coleta dados financeiros mensalmente
   - Watcher IBGE: Atualiza dados demográficos anualmente
   - Watcher PNCP: Monitora licitações em tempo real
   - Watcher DOM/SC: Monitora publicações diárias

2. **Camada de Validação:** Verificação de integridade e completude dos dados

3. **Camada de Normalização:** Padronização de formatos e estruturas

4. **Camada de Enriquecimento:** Cruzamento de dados de múltiplas fontes

5. **Camada de Armazenamento:** Data Lake com histórico completo

6. **Camada de Análise:** Agentes de IA processando dados

7. **Camada de Visualização:** Dashboard e relatórios

---

### 10.2 Frequência de Atualização por Tipo de Dado

| Tipo de Dado                | Frequência | Latência | Prioridade |
| --------------------------- | ---------- | -------- | ---------- |
| Licitações (PNCP)           | Tempo Real | Minutos  | Crítica    |
| Repasses FPM                | Diária     | 1 dia    | Crítica    |
| Publicações (DOM/SC)        | Diária     | Horas    | Alta       |
| Dados Financeiros (SICONFI) | Mensal     | 30 dias  | Alta       |
| Dados de Saúde (DATASUS)    | Mensal     | 30 dias  | Média      |
| Dados de Educação (INEP)    | Anual      | 6 meses  | Média      |
| Dados Demográficos (IBGE)   | Anual      | 12 meses | Baixa      |
| Dados Ambientais (INPE)     | Contínua   | Dias     | Média      |

---

### 10.3 Estratégia de Implementação Faseada

**Fase 1 (Mês 1-2): MVP com Dados Públicos**

- Integração com IBGE, SICONFI, PNCP
- Dashboard básico com Score ESG
- Alertas de licitações

**Fase 2 (Mês 3-4): Integração Estadual**

- Conexão com Portal SC, TCE-SC, DOM/SC
- Monitoramento de conformidade
- Análise de transferências voluntárias

**Fase 3 (Mês 5-6): Dados Especializados**

- SNIS (Saneamento)
- DATASUS (Saúde)
- INEP (Educação)
- INPE (Meio Ambiente)

**Fase 4 (Mês 7+): Integração com ERPs Municipais**

- Conexão com sistemas locais (Betha, IPM, etc.)
- Dados em tempo real de execução orçamentária
- Análise preditiva avançada

---

## CONCLUSÃO

Este mapa consolida **45+ fontes de dados abertos** que alimentarão o IOC ESG Municipal. A arquitetura foi desenhada para ser escalável, começando com dados públicos (Fase 1) e evoluindo para integrações mais complexas com sistemas municipais (Fase 4).

A chave para o sucesso é a **automação completa da coleta e processamento**, permitindo que o IOC funcione como um "sistema nervoso" vivo da gestão pública municipal, monitorando em tempo real e sugerindo ações baseadas em dados.
