# PNCP Collector — Especificacao
> Data: 2026-04-01 | ODS 16 (Instituicoes Eficazes)

## IMPORTANTE: URL base correta

A API de **consulta** (dados abertos, sem auth) usa:
```
https://pncp.gov.br/api/consulta
```

A URL `/api/pncp` e a API de **manutencao** (requer Bearer JWT).
Para o IOC ESG, usar SOMENTE `/api/consulta`.

## Endpoint Principal

```
GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao
  ?dataInicial=20250101
  &dataFinal=20250131
  &codigoMunicipioIbge=4205407
  &pagina=1
  &tamanhoPagina=50
```

## Parametros

| Parametro | Tipo | Obrig. | Exemplo |
|-----------|------|--------|---------|
| dataInicial | YYYYMMDD | sim | 20250101 |
| dataFinal | YYYYMMDD | sim | 20250131 |
| codigoMunicipioIbge | string 7 dig | nao | 4205407 |
| uf | string | nao | SC |
| codigoModalidadeContratacao | int | nao | 11 (pregao) |
| pagina | int | sim | 1 |
| tamanhoPagina | int | nao | 50 (max) |

## Resposta

```json
{
  "data": [{
    "sequencialCompra": 123456,
    "anoCompra": 2025,
    "numeroCompra": "001/2025",
    "orgaoEntidade": {
      "cnpj": "82892347000110",
      "razaoSocial": "PREFEITURA MUNICIPAL DE FLORIANOPOLIS"
    },
    "unidadeOrgao": {
      "codigoMunicipioIbge": "4205407",
      "ufSigla": "SC"
    },
    "objetoCompra": "Aquisicao de medicamentos...",
    "valorTotalEstimado": 150000.00,
    "valorTotalHomologado": 142500.00,
    "dataPublicacaoPncp": "2025-01-15T14:30:00",
    "modoDisputaNome": "Aberto",
    "srp": false
  }],
  "totalRegistros": 47,
  "totalPaginas": 1,
  "numeroPagina": 1,
  "paginasRestantes": 0
}
```

## Autenticacao: NAO precisa (dados publicos via /api/consulta)

## Indicadores ODS 16

| Indicador | Calculo | Score |
|-----------|---------|-------|
| Total licitacoes publicadas/ano | count(contratacoes) | >= 50 = 100, 0 = 0 |
| % dispensas sobre total | modalidade 7 / total | <= 20% = 100, >= 40% = 0 |
| Taxa homologacao | homologado / estimado | >= 90% = 100, < 50% = 0 |
| Uso de SRP | % com srp=true | >= 30% = 100, 0% = 0 |

## Gotchas

1. URL correta: /api/consulta (NAO /api/pncp)
2. codigoMunicipioIbge aceita 7 digitos (completo)
3. Max 500 registros por query (10 pags x 50)
4. Datas nos params: YYYYMMDD sem separador
5. Datas na resposta: ISO-8601 com timezone
6. Endpoint /contratos requer CNPJ (nao e opcional)
7. Municipios pequenos podem nao ter publicacoes
8. API instavel — timeout 30s + retry 3x obrigatorio

## Swagger: https://pncp.gov.br/api/consulta/swagger-ui/index.html
