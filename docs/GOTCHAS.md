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

> (a preencher conforme encontrados)

---

## SICONFI

> (a preencher conforme encontrados)

---

## DATASUS

> (a preencher conforme encontrados)

---

## INEP

> (a preencher conforme encontrados)

---

## SNIS

> (a preencher conforme encontrados)

---

## PNCP

> (a preencher conforme encontrados)
