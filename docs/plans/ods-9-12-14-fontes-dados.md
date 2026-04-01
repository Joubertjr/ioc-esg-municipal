# Pesquisa de Fontes de Dados — ODS 9, 12 e 14

> Pesquisa realizada em: 2026-04-01
> Objetivo: Identificar fontes públicas brasileiras para calcular scores dos ODS 9, 12 e 14 a nível municipal (foco: 295 municípios de Santa Catarina)

---

## ODS 9 — Indústria, Inovação e Infraestrutura

### 1. IBGE SIDRA — PIB Municipal por Setor (Indústria)

**URL base:** `https://apisidra.ibge.gov.br/values/`
**Documentação:** https://apisidra.ibge.gov.br/home/ajuda
**Granularidade:** Municipal (N6), anual
**Formato:** REST JSON
**Viabilidade:** FACIL — já usamos IBGE

**Tabela principal:**
- **T/5938** — "PIB a preços correntes, valor adicionado bruto por atividade econômica e participações" (PIB-Munic)
  - Contém: Agropecuária, Indústria, Serviços — separados
  - Período: disponível até 2021 com abertura setorial (2022–2023 apenas PIB total sem abertura por setor — aguardar publicação do IBGE)
  - Endpoint exemplo: `https://apisidra.ibge.gov.br/values/t/5938/n6/all/p/last/v/allxp`
  - Para SC: `https://apisidra.ibge.gov.br/values/t/5938/n6/in n3 42/p/last/v/allxp`

**Tabela ODS específica:**
- **T/6587** — "Indicador ODS 9.2.1 — Valor adicionado da indústria em proporção do PIB e per capita"
  - Granularidade: estado (N3), não municipal
  - Uso: benchmark estadual para calibrar scores municipais

**Indicadores deriváveis para ODS 9:**
- Participação da indústria no VAB municipal (%)
- VAB industrial per capita (R$)
- Variação anual do VAB industrial

**Gotcha:** Para 2022 e 2023, o IBGE não publicou abertura setorial (apenas PIB total). Usar 2021 como dado mais recente com setores, informando `referenceYear: 2021`.

---

### 2. ANATEL — Cobertura de Banda Larga / Internet

**URL datasets:**
- Dataset "Meu Município": https://dados.gov.br/dados/conjuntos-dados/meu-municipio---acessos-e-cobertura-de-telecomunicacoes
- Dataset "Acessos - Banda Larga Fixa": https://dados.gov.br/dados/conjuntos-dados/acessos---banda-larga-fixa
- Dataset "Densidade Banda Larga Fixa": https://dados.gov.br/dados/conjuntos-dados/acessos---banda-larga-fixa-densidade-por-100-habitantes
- Índice Brasileiro de Conectividade (IBC): https://basedosdados.org/dataset/ad45c5dc-ecc6-43db-ae2c-45d71939e7c5
- Painel ANATEL: https://informacoes.anatel.gov.br/paineis/

**Granularidade:** Municipal, trimestral/anual
**Formato:** Download CSV (não há API REST pública com endpoint parametrizado)
**Viabilidade:** MEDIO — download de CSV, processar localmente (padrão SNIS/INEP)

**Indicadores disponíveis:**
- Densidade de acessos de banda larga fixa por 100 habitantes
- Percentual de domicílios com cobertura 4G/5G
- Existência de backhaul de fibra óptica no município
- IBC — Índice Brasileiro de Conectividade (ranking municipal)

**Abordagem de implementação:**
- Download semestral do CSV "Meu Município" de dados.gov.br
- Filtrar por código IBGE do município (campo `cd_municipio` = 7 dígitos)
- Armazenar localmente com `referenceYear`
- Cache TTL: 7 dias (dado muda pouco)

---

### 3. IBGE SIDRA — Acesso à Internet nos Domicílios (PNAD/Censo)

**Tabelas relevantes:**
- **T/5244** — "Domicílios com utilização da Internet, por banda larga fixa e móvel" (Censo 2022)
  - Granularidade: municipal (N6)
  - Endpoint: `https://apisidra.ibge.gov.br/values/t/5244/n6/in n3 42/p/last/v/allxp`
- **T/1220** — "Domicílios particulares permanentes com acesso à Internet" (Censo 2010)
  - Referência histórica
- **T/5192** — Uso da internet por telefone celular (Censo 2022)

**Granularidade:** Municipal (Censo), estadual (PNAD Contínua)
**Formato:** REST JSON via API SIDRA
**Viabilidade:** FACIL

**Gotcha:** PNAD Contínua tem granularidade apenas estadual. Para nível municipal, usar Censo 2022 (dado pontual, não anual).

---

### 4. RAIS/CAGED — Empregos Formais na Indústria

**URL microdados:** `ftp://ftp.mtps.gov.br/pdet/microdados/`
**URL portal:** https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged
**Base dos Dados (BigQuery):** https://basedosdados.org/dataset/3e7c4d58-96ba-448e-b053-d385a829ef00

**Granularidade:** Municipal, anual (RAIS) / mensal (CAGED)
**Formato:** TXT comprimido (microdados pesados, ~GB) ou BigQuery via Base dos Dados
**Viabilidade:** DIFICIL — microdados pesados; recomendado usar tabelas pré-processadas da Base dos Dados

**Indicadores disponíveis:**
- Vínculos ativos na indústria por município (CNAE seção C = Indústria de Transformação)
- Percentual de emprego industrial no total de empregos formais
- Salário médio na indústria (proxy de qualidade do emprego industrial)

**Alternativa mais viável:** IBGE CEMPRE (Cadastro Central de Empresas) via SIDRA:
- **T/1685** — Empresas e unidades locais por atividade e pessoal ocupado
- Granularidade municipal, formato REST JSON
- Sem download de microdados pesados

---

### 5. CNPq/CAPES — Bolsas de Pesquisa (Proxy Inovação)

**URL CAPES dados abertos:** https://dadosabertos.capes.gov.br/
**URL CNPq histórico:** http://memoria2.cnpq.br/bolsistas-vigentes

**Granularidade:** Municipal (pelo município da instituição beneficiária)
**Formato:** CSV para download
**Viabilidade:** MEDIO-DIFICIL

**Indicadores disponíveis:**
- Número de bolsas CAPES ativas por município
- Bolsas CNPq (PIBIC, PIBITI, produtividade) por município

**Problema:** CNPq não tem API REST — dados via download anual. CAPES tem portal de dados abertos mas sem endpoint parametrizado por município.

**Recomendação:** Usar como indicador secundário/opcional. Para a maioria dos 295 municípios SC (pequenos, rurais), o valor será 0 ou muito próximo de 0 — baixo poder discriminatório. Priorizar PIB industrial e acesso à internet como indicadores principais do ODS 9.

---

### Resumo ODS 9 — Indicadores recomendados por viabilidade

| Indicador | Fonte | Granularidade | Formato | Viabilidade |
|-----------|-------|---------------|---------|-------------|
| Participação indústria no VAB (%) | IBGE SIDRA T/5938 | Municipal anual | REST JSON | FACIL |
| Domicílios com internet (%) | IBGE SIDRA T/5244 | Municipal (Censo) | REST JSON | FACIL |
| Densidade banda larga fixa / 100 hab | ANATEL CSV | Municipal semestral | CSV download | MEDIO |
| Empresas na indústria (CEMPRE) | IBGE SIDRA T/1685 | Municipal anual | REST JSON | FACIL |
| Empregos industriais formais | RAIS (Base dos Dados) | Municipal anual | BigQuery/CSV | DIFICIL |
| Bolsas de pesquisa | CAPES dados abertos | Municipal anual | CSV download | MEDIO |

**Indicadores mínimos viáveis para MVP:**
1. `industry_vab_share` — T/5938 via API IBGE (% VAB industrial / VAB total)
2. `internet_households_pct` — T/5244 via API IBGE (% domicílios com internet)
3. `broadband_density` — ANATEL CSV (acessos banda larga / 100 hab)

---

## ODS 12 — Consumo e Produção Responsáveis

### 1. SINISA/SNIS Resíduos Sólidos

**Contexto importante:** Em 2024, o SNIS encerrou atividades. O sistema sucessor é o **SINISA** (Sistema Nacional de Informações sobre Saneamento Básico), operado pelo Ministério das Cidades.

**URL SINISA (novo):** https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis/area-do-prestador-e-municipios/coleta-de-dados-do-snis-residuos-solidos-1
**URL histórico SNIS:** http://antigo.snis.gov.br/diagnostico-anual-residuos-solidos
**URL série histórica dados.gov.br:** https://dados.gov.br/dados/conjuntos-dados/snis---srie-histrica
**Base dos Dados:** https://basedosdados.org/dataset/2a543ad8-3cdb-4047-9498-efe7fb8ed697

**Granularidade:** Municipal, anual
**Formato:** CSV/Excel para download (sem API REST)
**Defasagem:** ~18 meses (dado de 2023 publicado em meados de 2025)
**Viabilidade:** FACIL — mesmo padrão do SNIS Saneamento já planejado

**Indicadores-chave para ODS 12 (resíduos sólidos):**
- `IN015` — Coleta seletiva implantada (S/N + cobertura %)
- `IN016` — Percentual de municípios com coleta seletiva
- `IN028` — Taxa de cobertura do serviço de coleta de RSU (%)
- `IN031` — Quantidade de RSU coletado per capita (kg/hab.dia)
- `IN056` — Percentual de RSU destinado a aterro sanitário (meta: 100%)
- `IN058` — Percentual de RSU destinado a lixão/aterro controlado (meta: 0%)
- `IN029` — Massa de resíduos recicláveis recuperados per capita

**Gotcha:** O SNIS-RS usa código IBGE de 7 dígitos nos arquivos. Campo: `CO_MUNICIPIO`. O mesmo padrão da série de saneamento (água/esgoto).

**Gotcha:** A coleta de dados do SINISA 2024 usa nova plataforma. Os dados históricos (2002–2022) continuam disponíveis via SNIS antigo. Para 2023 em diante, acessar SINISA.

---

### 2. SINIR — Sistema Nacional de Informações sobre Resíduos Sólidos

**URL:** https://sinir.gov.br
**URL dados MMA:** https://dados.mma.gov.br/dataset/sinir

**Granularidade:** Municipal
**Formato:** Download de planilhas (sem API REST documentada)
**Viabilidade:** MEDIO — complementar ao SNIS/SINISA

**Dados disponíveis:**
- Status de Plano Municipal de Gestão de Resíduos Sólidos (PMGIRS) — sim/não
- Licenciamento de aterros sanitários por município
- Metas do Plano Nacional de Resíduos Sólidos (Planares) por município
- Relatórios de diagnóstico anuais por município

**Indicadores úteis:**
- Municípios com PMGIRS aprovado (governança)
- Destinação final adequada (aterro sanitário vs. lixão) — complementa SNIS

**Recomendação:** Usar SINIR como fonte complementar de governança, não como fonte primária. O SNIS/SINISA tem dados quantitativos mais ricos.

---

### 3. IBGE — Pesquisa de Saneamento Básico (MUNIC/PNSB)

**URL:** https://www.ibge.gov.br/estatisticas/sociais/habitacao/10586-pesquisa-nacional-de-saneamento-basico.html
**SIDRA tabela relacionada:** T/1364 (Manejo de Resíduos Sólidos — PNSB 2008, dado defasado)

**Granularidade:** Municipal
**Formato:** Download Excel + REST JSON (SIDRA para algumas variáveis)
**Periodicidade:** Decenal (2008, 2017, próxima ~2027)
**Viabilidade:** BAIXA para atualização — muito defasado

**Complementar:** IBGE MUNIC (Pesquisa de Informações Básicas Municipais) — anual, inclui módulo de gestão de resíduos:
- URL: https://www.ibge.gov.br/estatisticas/sociais/saude/10586-pesquisa-de-informacoes-basicas-municipais.html
- Formato: XLS/CSV download
- Contém: existência de coleta seletiva, tipo de destinação final

---

### Resumo ODS 12 — Indicadores recomendados

| Indicador | Fonte | Campo | Viabilidade |
|-----------|-------|-------|-------------|
| Coleta seletiva implantada (S/N) | SNIS/SINISA RS | IN015 | FACIL |
| % RSU em aterro sanitário | SNIS/SINISA RS | IN056 | FACIL |
| % RSU em lixão (negativo) | SNIS/SINISA RS | IN058 | FACIL |
| RSU coletado per capita (kg/hab.dia) | SNIS/SINISA RS | IN031 | FACIL |
| Recicláveis recuperados per capita | SNIS/SINISA RS | IN029 | FACIL |
| PMGIRS aprovado (governança) | SINIR | status | MEDIO |

**Indicadores mínimos viáveis para MVP:**
1. `selective_collection` — IN015 (binário: tem/não tem coleta seletiva)
2. `sanitary_landfill_pct` — IN056 (% RSU destinado adequadamente)
3. `waste_collected_per_capita` — IN031 (eficiência do serviço)

---

## ODS 14 — Vida na Água

### Análise de Viabilidade para Municípios Sem Litoral

**Contexto crítico:** Dos 295 municípios de SC, apenas ~20 têm litoral (faixa costeira). Os ~275 municípios do interior **não têm acesso a água marinha** e, portanto, os indicadores clássicos do ODS 14 (proteção de ecossistemas marinhos, pesca oceânica, acidificação dos oceanos) são **inaplicáveis**.

**Decisão recomendada:** Duas abordagens para o score ODS 14 municipal:

1. **Municípios costeiros (com litoral):** Score completo com indicadores marinhos
2. **Municípios do interior:** Score adaptado com proxy de qualidade de águas superficiais (rios, lagos, reservatórios) — justificado pelo ODS 14.1 e 14.2 que incluem "águas continentais" como interpretação expandida por governos subnacionais

---

### 1. ANA — Qualidade de Corpos d'Água (IQA)

**URL portal dados abertos:** https://dadosabertos.ana.gov.br/
**URL IQA série histórica:** https://dadosabertos.ana.gov.br/maps/7a278de90bd14330ab014c9b5db350e0_17/about
**URL qualidade da água:** https://qualidadedaagua.ana.gov.br/
**Documentação RNQA:** https://www.gov.br/ana/pt-br/assuntos/monitoramento-e-eventos-criticos/qualidade-da-agua

**Granularidade:** Por ponto de monitoramento (estação hidrométrica), não por município diretamente
**Período:** 2010–2021 (série histórica IQA consolidada), dados mais recentes no HidroWeb
**Formato:** Download (CSV/GeoJSON) do portal + API REST do HidroWeb
**Viabilidade:** MEDIO — requer geocodificação (ponto → município)

**Indicadores disponíveis:**
- IQA — Índice de Qualidade da Água (0–100) por ponto de monitoramento
  - Parâmetros: temperatura, pH, oxigênio dissolvido, DBO, coliformes, N total, P total, sólidos totais, turbidez
- 3.724 pontos de monitoramento em todo o Brasil (dados 2010–2024)
- 107.647 observações de IQA disponíveis

**Abordagem de implementação para municípios:**
1. Baixar shapefile/CSV dos pontos de monitoramento (com coordenadas lat/lon)
2. Associar cada ponto ao município mais próximo (PostGIS ST_Within ou ST_DWithin)
3. Agregar IQA médio por município (considerando apenas pontos dentro do território)
4. Municípios sem ponto de monitoramento: interpolação pelo município vizinho mais próximo ou `null`

**Gotcha:** A maioria dos municípios pequenos de SC não tem ponto de monitoramento da RNQA. A rede é mais densa em bacias com maior pressão humana. Para municípios rurais pequenos, o dado pode ser ausente — retornar `null`, nunca imputar zero.

---

### 2. ICMBio — Unidades de Conservação Marinhas

**URL ICMBio:** https://www.icmbio.gov.br/
**URL UCs marinhas:** http://www.icmbio.gov.br/centrotamar/ucs-marinhas
**URL dados abertos:** https://dados.gov.br/dados/conjuntos-dados/http-www-icmbio-gov-br-acessoainformacao-plano-de-dados-abertos-html

**Granularidade:** Polígono geográfico (shapefile) — conversão para município via geocodificação
**Formato:** Shapefile (SHP) e KMZ para download
**Viabilidade:** MEDIO (requer GIS para cruzar com territórios municipais)

**Indicadores disponíveis:**
- Existência de UC marinha no território municipal (sim/não)
- Área de UC marinha no município (km²)
- Tipo de UC (Proteção Integral vs. Uso Sustentável)

**Aplicabilidade:** Apenas para municípios costeiros (~20 em SC). Para os demais: indicador inaplicável, não conta no score ou recebe peso zero.

---

### 3. ANA HidroWeb — API REST para Dados Hidrométricos

**URL:** https://www.snirh.gov.br/hidroweb/serieshistoricas
**API:** https://www.snirh.gov.br/hidroweb/rest/api

**Granularidade:** Por estação hidrométrica (com coordenadas — convertível para município)
**Formato:** REST JSON
**Viabilidade:** MEDIO — requer mapeamento estação→município

**Indicadores disponíveis:**
- Nível e vazão dos rios (proxy de saúde hídrica)
- Dados pluviométricos

**Limitação:** Dados hidrométricos (nível/vazão) são proxy fraco de "qualidade da água" para ODS 14. O IQA da RNQA é mais adequado.

---

### 4. MapBiomas — Cobertura de Água Continental

**URL:** https://mapbiomas.org
**URL dados:** https://plataforma.mapbiomas.org/
**Acesso:** Download anual (GeoTIFF por bioma) ou API Collection via Google Earth Engine

**Granularidade:** Pixel 30m (agregável por município)
**Período:** Anual desde 1985
**Formato:** GeoTIFF / Google Earth Engine
**Viabilidade:** DIFICIL — requer GEE ou processamento raster pesado

**Indicadores deriváveis:**
- Área de corpos d'água naturais por município (km²)
- Variação de cobertura de rios/lagos ao longo do tempo
- Expansão/retração de zonas úmidas

**Recomendação:** Usar como indicador complementar avançado (pós-MVP). Para MVP, priorizar IQA da ANA.

---

### Estratégia ODS 14 para SC recomendada

**Municípios costeiros (litoral, ~20):**

| Indicador | Fonte | Viabilidade |
|-----------|-------|-------------|
| IQA de corpos d'água costeiros | ANA RNQA | MEDIO |
| Área de UC marinha (km²) | ICMBio shapefile | MEDIO |
| Existência de UC marinha | ICMBio shapefile | MEDIO |

**Municípios do interior (~275):**

| Indicador | Fonte | Viabilidade |
|-----------|-------|-------------|
| IQA de rios no território | ANA RNQA / HidroWeb | MEDIO |
| Cobertura de matas ciliares (proxy) | MapBiomas | DIFICIL |
| % esgoto tratado antes de lançar em rios | SNIS/SINISA (IN046) | FACIL |

**Indicador proxy mais viável para municípios do interior:**
- `IN046` do SNIS (índice de esgoto tratado) é um indicador de impacto sobre corpos d'água — já coletado para ODS 6, pode ser reaproveitado como proxy ODS 14 para municípios sem litoral. Isso evita implementar novo coletor.

**Recomendação para MVP:** Para municípios sem litoral, calcular score ODS 14 usando:
1. IQA médio dos rios no território (ANA RNQA) — peso 60%
2. `IN046` — % de esgoto tratado (SNIS) — peso 40% (reaproveitado do ODS 6)

Municípios sem nenhum ponto de monitoramento ANA: score baseado apenas em IN046 (SNIS) enquanto aguarda expansão da rede de monitoramento.

---

## Decisões Arquiteturais Sugeridas

### Para o coletor SNIS Resíduos Sólidos

O SNIS Saneamento (água/esgoto) já está planejado em `backend/agents/snis/`. Recomenda-se criar sub-coletor:
- `backend/agents/snis/snis_residuos_collector.ts` — herda padrões do snis_sanitation_collector
- Campos-chave: IN015, IN016, IN028, IN029, IN031, IN056, IN058

### Para o coletor ANATEL

Criar `backend/agents/anatel/` novo:
- Download semestral de CSV do dados.gov.br
- Filtrar por `cd_municipio` (7 dígitos)
- TTL: 604800s (7 dias) — dado muda lentamente
- Indicadores: `broadband_per_100`, `coverage_4g_pct`, `ibc_score`

### Para o coletor ANA (ODS 14)

Criar `backend/agents/ana/`:
- Baixar dataset IQA da RNQA (CSV/GeoJSON)
- Carregar shapefile de municípios (IBGE malha municipal)
- PostGIS: `ST_Within(ponto_monitoramento, polygon_municipio)` para associação
- Agregar IQA médio por município
- TTL: 86400s (24h)
- Municípios sem dados: retornar `null` (nunca `0`)

### Para ODS 9 (IBGE SIDRA)

Expandir o coletor IBGE existente (`backend/agents/ibge/`) com:
- Tabela 5938: PIB/VAB por setor (indústria)
- Tabela 5244: % domicílios com internet (Censo 2022)
- Tabela 1685: Empresas e empregos na indústria (CEMPRE)
- Sem novo coletor — adicionar ao collector IBGE existente

---

## Fontes Descartadas ou de Baixa Prioridade

| Fonte | Motivo |
|-------|--------|
| DNIT/ANTT infraestrutura rodoviária | Dados não disponíveis por município com código IBGE; somente malha rodoviária em shapefile — difícil correlação com score ODS 9 |
| CNPq bolsas de pesquisa | API inexistente; download manual; 0 valor discriminatório para pequenos municípios SC |
| PNSB/MUNIC IBGE (resíduos) | Periodicidade decenal — muito defasado para uso operacional |
| MapBiomas (cobertura d'água) | Requer GEE ou processamento raster pesado — pós-MVP |
| ICMBio UCs marinhas (para interior) | Inaplicável para 275/295 municípios de SC |

---

## Mapa de ODS → Fontes → Indicadores (resumo executivo)

```
ODS 9
├── industry_vab_share (%)         ← IBGE SIDRA T/5938 [REST JSON, FACIL]
├── internet_households_pct (%)    ← IBGE SIDRA T/5244 [REST JSON, FACIL]
├── broadband_per_100_hab          ← ANATEL CSV [download, MEDIO]
└── industry_firms_count           ← IBGE SIDRA T/1685 [REST JSON, FACIL]

ODS 12
├── selective_collection (bool)    ← SNIS/SINISA RS IN015 [CSV download, FACIL]
├── sanitary_landfill_pct (%)      ← SNIS/SINISA RS IN056 [CSV download, FACIL]
├── open_dump_pct (%)              ← SNIS/SINISA RS IN058 [CSV download, FACIL]
└── waste_per_capita (kg/hab.dia)  ← SNIS/SINISA RS IN031 [CSV download, FACIL]

ODS 14 — municípios costeiros (~20)
├── iqa_coastal_avg (0-100)        ← ANA RNQA IQA [GeoJSON+GIS, MEDIO]
└── marine_uc_area_km2             ← ICMBio shapefile [SHP+GIS, MEDIO]

ODS 14 — municípios do interior (~275)
├── iqa_rivers_avg (0-100)         ← ANA RNQA IQA [GeoJSON+GIS, MEDIO]
└── sewage_treated_pct (%)         ← SNIS IN046 [reaproveitado do ODS 6, FACIL]
```

---

## Referências

- [IBGE SIDRA Tabela 5938 — PIB Municipal por atividade](https://sidra.ibge.gov.br/tabela/5938)
- [IBGE SIDRA Tabela 6587 — ODS 9.2.1 Indústria](https://sidra.ibge.gov.br/tabela/6587)
- [API SIDRA — Documentação](https://apisidra.ibge.gov.br/home/ajuda)
- [ANATEL — Meu Município (Acessos e Cobertura)](https://dados.gov.br/dados/conjuntos-dados/meu-municipio---acessos-e-cobertura-de-telecomunicacoes)
- [ANATEL — Banda Larga Fixa Densidade](https://dados.gov.br/dados/conjuntos-dados/acessos---banda-larga-fixa-densidade-por-100-habitantes)
- [IBC — Índice Brasileiro de Conectividade (Base dos Dados)](https://basedosdados.org/dataset/ad45c5dc-ecc6-43db-ae2c-45d71939e7c5)
- [RAIS/CAGED Microdados — MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged)
- [RAIS (Base dos Dados)](https://basedosdados.org/dataset/3e7c4d58-96ba-448e-b053-d385a829ef00)
- [SNIS Diagnóstico Resíduos Sólidos (histórico)](http://antigo.snis.gov.br/diagnostico-anual-residuos-solidos)
- [SINISA — Novo sistema (2024+)](https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/snis/area-do-prestador-e-municipios/coleta-de-dados-do-snis-residuos-solidos-1)
- [SNIS Série Histórica — dados.gov.br](https://dados.gov.br/dados/conjuntos-dados/snis---srie-histrica)
- [SINIR — MMA dados](https://dados.mma.gov.br/dataset/sinir)
- [ANA — Portal de Dados Abertos](https://dadosabertos.ana.gov.br/)
- [ANA — IQA Série Histórica](https://dadosabertos.ana.gov.br/maps/7a278de90bd14330ab014c9b5db350e0_17/about)
- [ANA — Qualidade da Água portal](https://qualidadedaagua.ana.gov.br/)
- [ICMBio — UCs Marinhas](http://www.icmbio.gov.br/centrotamar/ucs-marinhas)
- [CAPES Dados Abertos](https://dadosabertos.capes.gov.br/)
