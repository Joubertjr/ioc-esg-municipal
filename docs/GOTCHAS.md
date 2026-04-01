# GOTCHAS — Problemas Encontrados por API

> Atualizar sempre que um novo problema for descoberto.
> Formato: data | API | sintoma | causa | solução

---

## INPE TerraBrasilis

**Data:** 2026-04-01
**Pesquisador:** data-collector agent

### Descoberta 1: A URL base `terrabrasilis.dpi.inpe.br/api/v1` não existe como REST API

- **Sintoma:** GET `https://terrabrasilis.dpi.inpe.br/api/v1/` retorna 404
- **Causa:** A documentação do projeto referenciava uma URL inexistente. O TerraBrasilis não expõe REST API convencional nesse path.
- **Solução:** Usar a interface WFS (Web Feature Service) do GeoServer embaixo do TerraBrasilis.
- **URL correta:** `https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WFS&version=2.0.0`

### Descoberta 2: Arquitetura real é WFS (OGC), não REST JSON

- **Sintoma:** Não há endpoints `/municipios`, `/desmatamento`, etc.
- **Causa:** TerraBrasilis usa padrão OGC — WFS para dados vetoriais, WMS para tiles.
- **Solução:** Todas as queries usam parâmetros WFS: `service=WFS&version=2.0.0&request=GetFeature&typeName=<workspace>:<layer>&outputFormat=application/json`
- **Retorno:** GeoJSON FeatureCollection com `totalFeatures`, `numberReturned`, `features[]`

### Descoberta 3: Dados por município requerem dois passos (geocodigo → bbox → deforestation)

- **Sintoma:** A layer `yearly_deforestation` não tem campo `geocodigo` ou `municipio` — só `state` (UF).
- **Causa:** Polígonos de desmatamento são brutos (por cena Landsat/Sentinel), sem join com município.
- **Solução:** Workflow de 2 etapas:
  1. Buscar bbox do município por `geocodigo` na layer `municipalities_mata_atlantica_biome`
  2. Usar WFS BBOX spatial filter na layer `yearly_deforestation`
- **Exemplo:**
  ```
  # Passo 1: bbox do município
  GET /geoserver/prodes-mata-atlantica-nb/ows?service=WFS&version=2.0.0
      &request=GetFeature
      &typeName=prodes-mata-atlantica-nb:municipalities_mata_atlantica_biome
      &outputFormat=application/json
      &count=1
      &CQL_FILTER=geocodigo='4209300'
  → retorna bbox: [-50.6966,-28.4333,-49.9993,-27.5688]

  # Passo 2: desmatamento por bbox
  GET /geoserver/prodes-mata-atlantica-nb/ows?service=WFS&version=2.0.0
      &request=GetFeature
      &typeName=prodes-mata-atlantica-nb:yearly_deforestation
      &outputFormat=application/json
      &count=5000
      &BBOX=-50.6966,-28.4333,-49.9993,-27.5688,EPSG:4674
  → retorna polígonos de desmatamento com area_km, year, state
  ```
- **Atenção:** bbox é aproximação retangular — pode incluir polígonos de municípios vizinhos. Para precisão exata, usar INTERSECTS com geometria do município (mais lento).

### Descoberta 4: Santa Catarina está coberta SOMENTE pelo bioma Mata Atlântica

- **Sintoma:** Nenhum dado de SC em PRODES Amazônia, PRODES Cerrado.
- **Causa:** SC pertence 100% ao bioma Mata Atlântica.
- **Solução:** Usar SEMPRE o workspace `prodes-mata-atlantica-nb` para municípios de SC.
- **Layers relevantes para SC:**
  - `prodes-mata-atlantica-nb:municipalities_mata_atlantica_biome` — 295 municípios SC confirmados
  - `prodes-mata-atlantica-nb:yearly_deforestation` — desmatamento anual (2004–2024)
  - `prodes-mata-atlantica-nb:accumulated_deforestation_2000` — acumulado desde 2000
  - `prodes-mata-atlantica-nb:residual` — fragmentos florestais remanescentes

### Descoberta 5: DETER não cobre SC (apenas Amazônia e Cerrado)

- **Sintoma:** Não existe `deter-mata-atlantica` no GeoServer.
- **Causa:** DETER é sistema de alertas em tempo real — opera apenas em Amazônia (`deter-amz`) e Cerrado (`deter-cerrado-nb`).
- **Solução:** Para SC, usar PRODES (anual). Dados mais recentes disponíveis: 2024 (parcial).
- **Dados disponíveis (verificado):** 2004, 2006, 2008, 2010, 2011, 2013, 2014, 2016–2024

### Descoberta 6: propertyName com >5 atributos causa erro ArrayIndexOutOfBounds

- **Sintoma:** `java.lang.ArrayIndexOutOfBoundsException: Can handle 5 attributes only, index is 5`
- **Causa:** Bug no GeoServer desta instância — não suporta mais de 5 campos em `propertyName`.
- **Solução:** Não usar `propertyName` nas queries. Retornar todos os campos e filtrar no código TypeScript.

### Descoberta 7: CQL_FILTER com operador AND requer URL encoding cuidadoso

- **Sintoma:** Queries com `CQL_FILTER=state='SC' AND year>2018` retornam 0 resultados ou erro.
- **Causa:** O `AND` e `>` precisam de encoding específico no curl/fetch.
- **Solução:**
  - Usar `%20AND%20` para AND
  - Usar `%3D` para `=` e `%3E` para `>`
  - Ou fazer queries separadas por ano com `CQL_FILTER=state%3D%27SC%27%20AND%20year%3D2022`
  - Recomendado: filtrar por state na query e filtrar year no código para evitar problemas.

### Descoberta 8: Layer residual é fragmentos pequenos, não cobertura florestal total

- **Sintoma:** `residual` para Chapecó soma apenas ~3 km2 de floresta.
- **Causa:** `residual` (class_name: r2023) representa fragmentos residuais detectados por imagem de satélite — não é a cobertura florestal total do município.
- **Solução:** Para cobertura florestal total (ODS 15), a fonte correta é **MapBiomas** (download anual) ou calcular como `área_total_município - desmatamento_acumulado`.
- **Atenção:** Não confundir `residual` (fragmentos residuais detectados no ciclo PRODES) com cobertura florestal total.

### Descoberta 9: Geocodigo no TerraBrasilis é 7 dígitos (igual ao IBGE)

- **Confirmado:** Campo `geocodigo` na layer `municipalities_mata_atlantica_biome` usa código IBGE completo de 7 dígitos (ex: `4204202` = Chapecó).
- **Atenção:** O campo chama-se `geocodigo` (não `geocode`). Na layer `ams2:municipalities_border`, o campo é `geocode` (sem "digo").

### Descoberta 10: AMS (fogo/incêndio) cobre SC mas dados com score requerem autenticação

- **Layer pública:** `ams2:municipalities_border` — contém geocode, area, state_acr para todos os 295 municípios SC.
- **Layer com scores de risco de fogo:** `ams2_auth:municipalities_view` — requer autenticação (_auth suffix).
- **Solução para ODS 13:** Usar apenas `yearly_deforestation` (PRODES) + área acumulada. Para risco de incêndio, buscar alternativa (IBGE, BDQueimadas API separada).

### Descoberta 11: Dados mais recentes confirmados (2026-04-01)

| Layer | Ano mais recente |
|-------|-----------------|
| `yearly_deforestation` | 2024 (parcial — 906 polígonos SC) |
| `residual` | 2024 (class_name r2024) |
| `accumulated_deforestation_2000` | 2023 |

### Descoberta 12: Não precisa de autenticação para dados PRODES

- Confirmado: todas as layers do workspace `prodes-mata-atlantica-nb` são públicas.
- Sem necessidade de token, API key ou cadastro.
- Rate limit observado nos headers: `X-Rate-Limit-Limit: 10` (10 req/s).

---

## Workspaces GeoServer confirmados (2026-04-01)

| Workspace | Bioma | Cobertura SC |
|-----------|-------|-------------|
| `prodes-mata-atlantica-nb` | Mata Atlântica | SIM (295 municípios) |
| `prodes-amazon-nb` | Amazônia | NÃO |
| `prodes-legal-amz` | Amazônia Legal | NÃO |
| `prodes-cerrado-nb` | Cerrado | NÃO |
| `prodes-pampa-nb` | Pampa | Parcial (extremo sul) |
| `prodes-caatinga-nb` | Caatinga | NÃO |
| `prodes-pantanal-nb` | Pantanal | NÃO |
| `deter-amz` | Amazônia | NÃO |
| `deter-cerrado-nb` | Cerrado | NÃO |
| `ams2` | Brasil todo (fogo) | SIM (apenas border) |

---

## IBGE

**Data:** 2026-04-01 | **Pesquisador:** data-collector agent

### Gotcha 1: Tabela 4967 (energia eletrica Censo 2010) retornou timeout na API

- **Sintoma:** `GET /api/v3/agregados/4967/periodos/2010/variaveis/all?localidades=N6[4204202]` — timeout 60s
- **Causa:** Provavelmente tabela descontinuada ou servidor sobrecarregado para Censo 2010
- **Solucao:** Usar tabela 6737 para energia eletrica; fallback para estatistica nacional (99,8%) se N6 nao disponivel

### Gotcha 2: Tabela 6737 (energia eletrica Censo 2022) retorna ".." para municipios

- **Sintoma:** A API retorna `".."` (dado nao disponivel) para nivel municipal em 2022
- **Causa:** O IBGE ainda esta publicando resultados do Censo 2022 por etapas. Dados municipais de infraestrutura domiciliar ainda parcialmente indisponiveis via SIDRA API em 2026-04
- **Solucao:** Monitorar publicacao no SIDRA. Fallback: usar % do estado ou usar Censo 2010 como baseline

### Gotcha 3: Tabela 9514 retorna populacao total mas nao desagrega por sexo via API simples

- **Sintoma:** Classificacao de sexo presente no schema mas `categoria: {"0": ""}` (vazia)
- **Causa:** A classificacao de sexo requer parametro explicito: `&classificacao=2[4,5]` (4=Homens, 5=Mulheres)
- **Solucao:** URL correta: `...variaveis/606?localidades=N6[4204202]&classificacao=2[4,5]`

### Gotcha 4: CEMPRE tabela 9418 variavel 707 e pessoal ocupado, nao numero de empresas

- **Sintoma:** Consulta a variavel 707 retornou "Pessoal ocupado total", nao empresas ativas
- **Causa:** Confusao entre variaveis — 707 = pessoas, 2283 = empresas atuantes
- **Solucao:** Usar variavel `2283` para numero de empresas e organizacoes atuantes

---

## SICONFI

> (a preencher conforme encontrados)

---

## DATASUS / SISVAN

**Data:** 2026-04-01 | **Pesquisador:** data-collector agent

### Gotcha 1: opendatasus.saude.gov.br foi descontinuado — redireciona para dadosabertos.saude.gov.br

- **Sintoma:** GET `https://opendatasus.saude.gov.br/dataset/sisvan-estado-nutricional` retorna 302 para `dadosabertos.saude.gov.br`
- **Causa:** O DATASUS migrou o portal de dados abertos em 2025
- **Solucao:** Usar `https://dadosabertos.saude.gov.br/dataset/sisvan-estado-nutricional` como URL canonical
- **URLs de download mantidas:** O S3 `s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SISVAN/...` continua funcionando

### Gotcha 2: API REST do SISVAN (`apidadosabertos.saude.gov.br`) retornou 503 durante pesquisa

- **Sintoma:** GET `https://apidadosabertos.saude.gov.br/v1/` retorna 503 Service Unavailable
- **Causa:** Servidor instavel / em manutencao
- **Solucao:** Nao depender da API REST. Usar download anual do ZIP (S3) como fonte primaria

### Gotcha 3: SISVAN nao tem granularidade municipal direto — e por individuo

- **Sintoma:** Nao existe endpoint `/municipio/{id}/nutricao`
- **Causa:** Os dados sao individualizados e anonimizados — registro por atendimento
- **Solucao:** Baixar CSV anual completo (~500 MB), importar para PostgreSQL, agregar via SQL:
  ```sql
  SELECT co_municipio_ibge,
         COUNT(*) FILTER (WHERE ds_imc IN ('Magreza acentuada', 'Magreza')) AS desnutridos,
         COUNT(*) AS total
  FROM sisvan_estado_nutricional
  WHERE nu_fase_vida = '1' -- criancas
  GROUP BY co_municipio_ibge
  ```
- **Atencao:** municipios com < 50 registros: retornar null por amostra insuficiente

---

## INEP

> (a preencher conforme encontrados)

---

## SNIS

> (a preencher conforme encontrados)

---

## PNCP

> (a preencher conforme encontrados)

---

## TSE Dados Abertos

**Data:** 2026-04-01 | **Pesquisador:** data-collector agent

### Gotcha 1: Leiame/dicionario de campos do TSE nao esta acessivel via URL direta

- **Sintoma:** URL `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/leiame.pdf` retornou 404
- **Causa:** O leiame vem dentro do proprio ZIP do dataset — nao e publicado separadamente
- **Solucao:** Baixar o ZIP, extrair o arquivo `leiame.pdf` que acompanha o CSV para documentacao dos campos

### Gotcha 2: Encoding do CSV de candidatos pode ser latin-1

- **Sintoma:** Acentuacao corrompida ao abrir com UTF-8
- **Causa:** Arquivos historicos do TSE usam encoding ISO-8859-1 (latin-1) e separador `;`
- **Solucao:** Usar `iconv -f latin-1 -t utf-8` ou `pandas.read_csv(encoding='latin-1', sep=';')` ao processar

### Gotcha 3: Campo de municipio no TSE e SG_UE (codigo TSE), nao codigo IBGE

- **Sintoma:** `SG_UE` tem formato diferente do codigo IBGE de 7 digitos
- **Causa:** O TSE usa codigos proprios para zonas eleitorais
- **Solucao:** Verificar se `CD_MUNICIPIO_IBGE` esta presente no CSV 2024. Se nao, usar tabela de-para disponivel no portal TSE. Alternativamente, cruzar por `NM_MUNICIPIO` + `SG_UF`

### Gotcha 4: DS_SIT_TOT_TURNO tem multiplos valores para "eleito"

- **Sintoma:** Filtrar so `ELEITO` perde vereadoras eleitas por quociente
- **Causa:** O TSE registra diferentes tipos de eleicao: por votos, por quociente partidario, por media
- **Solucao:** Usar IN list:
  ```sql
  WHERE DS_SIT_TOT_TURNO IN ('ELEITO', 'ELEITO POR QP', 'ELEITO POR MEDIA', 'ELEITO POR SUBLEGENDA')
  ```

---

## ANEEL Dados Abertos

**Data:** 2026-04-01 | **Pesquisador:** data-collector agent

### Gotcha 1: Arquivo principal de GD tem 905 MB — nao baixar em toda requisicao

- **Sintoma:** Download do CSV principal `empreendimento-geracao-distribuida.csv` demora 2-5 minutos
- **Causa:** Contem todos os empreendimentos do Brasil desde o inicio da GD
- **Solucao:** Usar exclusivamente o CSV de fotovoltaica (`empreendimento-gd-informacoes-tecnicas-fotovoltaica.csv`, ~50 MB). Agendar download mensal via worker Bull, salvar em PostgreSQL.

### Gotcha 2: Campo "CodMunicipioIbge" pode ter 6 digitos (sem verificador)

- **Sintoma:** Municipios do IBGE tem 7 digitos; campo ANEEL pode ter 6
- **Causa:** Inconsistencia historica nos sistemas de origem dos dados ANEEL
- **Solucao:** Verificar comprimento ao importar. Se 6 digitos, adicionar digito verificador usando algoritmo IBGE ou fazer join por nome do municipio + UF como fallback

### Gotcha 3: Houve gap de dados entre set-nov/2025

- **Sintoma:** Instalacoes registradas nesse periodo podem estar faltando
- **Causa:** ANEEL fez migracao de sistemas em set/2025 — atualizacoes foram suspensas
- **Solucao:** Dados anteriores a set/2025 e posteriores a nov/2025 sao confiaveis. Para o gap, usar dado mais recente anterior como aproximacao.

---

## ANATEL Dados Abertos

**Data:** 2026-04-01 | **Pesquisador:** data-collector agent

### Gotcha 1: Portal `informacoes.anatel.gov.br/paineis/` retorna 403

- **Sintoma:** GET direto retorna 403 Forbidden
- **Causa:** Painel exige browser com cookies/session
- **Solucao:** Usar API CKAN do dados.gov.br para obter URL de download do CSV:
  ```
  GET https://dados.gov.br/api/3/action/package_show?id=acessos---banda-larga-fixa
  ```

### Gotcha 2: Portal dados.gov.br exige JavaScript — pagina vazia via HTTP simples

- **Sintoma:** Fetch direto retorna apenas GTM scripts
- **Causa:** SPA (Single Page Application) com renderizacao client-side
- **Solucao:** Usar API REST do CKAN (acima) para navegar no catalogo sem JavaScript

### Gotcha 3: Melhor alternativa para banda larga por municipio e Base dos Dados

- **Dataset:** `basedosdados.br_anatel_banda_larga_fixa`
- **Acesso:** BigQuery (gratuito com conta Google) ou Python `basedosdados` package
- **Colunas:** `id_municipio` (7 dig), `ano`, `mes`, `produto`, `acessos`
- **Vantagem:** Pre-tratado, sem necessidade de parsear CSV raw de 200 MB
