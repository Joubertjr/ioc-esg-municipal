# INPE TerraBrasilis Collector — Especificacao
> Data: 2026-04-01 | ODS 13 (Acao Climatica) + ODS 15 (Vida Terrestre)

## IMPORTANTE: URL base NAO e REST /api/v1

A URL `terrabrasilis.dpi.inpe.br/api/v1` retorna 404.
Arquitetura real: **WFS (OGC Web Feature Service)** via GeoServer.

## URL Base
```
https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WFS&version=2.0.0
```

## Workflow de 2 passos para dados municipais

### Passo 1: Obter bbox do municipio por geocodigo IBGE
```
GET /geoserver/prodes-mata-atlantica-nb/ows
  ?service=WFS&version=2.0.0
  &request=GetFeature
  &typeName=prodes-mata-atlantica-nb:municipalities_mata_atlantica_biome
  &outputFormat=application/json
  &CQL_FILTER=geocodigo='4209300'
```
Retorna: bbox [-50.6966,-28.4333,-49.9993,-27.5688]

### Passo 2: Buscar desmatamento por bbox
```
GET /geoserver/prodes-mata-atlantica-nb/ows
  ?service=WFS&version=2.0.0
  &request=GetFeature
  &typeName=prodes-mata-atlantica-nb:yearly_deforestation
  &outputFormat=application/json
  &BBOX=-50.6966,-28.4333,-49.9993,-27.5688,EPSG:4674
```

## Layers Uteis (bioma Mata Atlantica = 100% SC)

| Layer | Dados |
|-------|-------|
| municipalities_mata_atlantica_biome | bbox por geocodigo IBGE 7 digitos |
| yearly_deforestation | Desmatamento anual 2004-2024 (area_km, year, state) |
| accumulated_deforestation_2000 | Acumulado desde 2000 |
| residual | Fragmentos florestais remanescentes |

## Formato: GeoJSON FeatureCollection
```json
{
  "features": [{
    "properties": {
      "state": "SC", "year": 2023, "area_km": 0.0126,
      "main_class": "desmatamento", "satellite": "sentinel 2B"
    }
  }]
}
```

## Autenticacao: NAO precisa (dados PRODES sao publicos)
## Rate limit: ~10 req/s

## Indicadores para ODS

| Indicador | Layer | Campo | ODS |
|-----------|-------|-------|-----|
| Desmatamento anual (km2) | yearly_deforestation + bbox | soma area_km por year | 13 + 15 |
| Desmatamento acumulado | accumulated_deforestation_2000 + bbox | soma area_km | 15 |
| Tendencia desmatamento | serie historica | variacao YoY | 13 |

## Gotchas
1. yearly_deforestation NAO tem geocodigo — precisa de bbox do passo 1
2. bbox e retangular — pode capturar poligonos de municipios vizinhos
3. propertyName com >5 campos quebra com ArrayIndexOutOfBoundsException
4. DETER NAO cobre SC (so Amazonia/Cerrado) — usar apenas PRODES
5. Dados mais recentes: 2024 (parcial)

## Dados verificados: Lages SC (4209300)
- 2022: 21.2 km2 | 2023: 45.4 km2 | 2024: 2.8 km2 (parcial)
