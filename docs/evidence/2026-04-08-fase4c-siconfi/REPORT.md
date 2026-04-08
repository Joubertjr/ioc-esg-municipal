# Evidence Report: Fase 4C — SICONFI Integration

**Data:** 2026-04-08
**API:** SICONFI REST — Tesouro Nacional
**Base URL:** `https://apidatalake.tesouro.gov.br/ords/siconfi/tt/rreo`
**Município teste:** Florianopolis (4205407)

---

## Chamada realizada

```
GET /rreo?an_exercicio=2024&nr_periodo=6&co_tipo_demonstrativo=RREO&id_ente=4205407
```

**Status:** 200 OK
**Total de items:** 2.378
**Anexos encontrados:** RREO-Anexo 01, 02, 03, 04, 06, 07, 09, 11, 14

---

## Indicadores extraidos pelo SiconfiCollector

| Indicador         | Valor                     |
| ----------------- | ------------------------- |
| Populacao         | 574.200                   |
| Receita Total     | R$ 3.658.646.415,71       |
| Despesa Total     | R$ 3.625.153.996,53       |
| Despesa Saude     | R$ 598.654.452,96         |
| Despesa Educacao  | R$ 875.193.309,19         |
| Despesa Urbanismo | R$ 301.946.520,75         |
| FPM Anual         | R$ 264.622.198,69         |
| Equilibrio Fiscal | 100,92% (receita/despesa) |
| Dependencia FPM   | 7,23% (FPM/receita)       |

---

## Mapeamento ODS (via mapToOdsIndicators)

| ODS | Indicador             | Valor  | Interpretacao                            |
| --- | --------------------- | ------ | ---------------------------------------- |
| 3   | pct_despesa_saude     | 16,5%  | Acima do minimo constitucional (15%)     |
| 4   | pct_despesa_educacao  | 24,1%  | Proximo ao minimo constitucional (25%)   |
| 11  | pct_despesa_urbanismo | 8,3%   | Investimento em infraestrutura urbana    |
| 16  | equilibrio_fiscal     | 100,9% | Equilibrio fiscal saudavel               |
| 17  | dependencia_fpm       | 7,2%   | Baixa dependencia — boa autonomia fiscal |

---

## Exemplo de resposta (3 primeiros items)

Ver `response-sample.json` neste diretorio.

```json
{
  "exercicio": 2024,
  "demonstrativo": "RREO",
  "periodo": 6,
  "periodicidade": "B",
  "instituicao": "Prefeitura Municipal de Florianopolis - SC",
  "cod_ibge": 4205407,
  "uf": "SC",
  "populacao": 574200,
  "anexo": "RREO-Anexo 01",
  "coluna": "PREVISAO INICIAL",
  "cod_conta": "ReceitasExcetoIntraOrcamentarias",
  "conta": "RECEITAS (EXCETO INTRA-ORCAMENTARIAS) (I)",
  "valor": 3641124729
}
```

---

## Implementacao existente

O coletor `backend/agents/siconfi/siconfi_collector.ts` ja implementa:

- Chamada real via `fetchWithRetry` (3 retries, backoff exponencial)
- Cache Redis com TTL 24h (atualizado de 6h nesta fase)
- Validacao Zod do schema de resposta
- Fallback para ano anterior se exercicio corrente vazio
- Extracao de FPM (TOTAL ou soma MR-1..12), FUNDEB, receitas e despesas por funcao
- Rate limiting: 500ms entre requests em batch (throttle em cache miss)

---

_Gerado automaticamente para evidencia da Fase 4C_
