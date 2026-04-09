# LongMemEval-ESG — Relatório 2026-04-09

> Benchmark de memória de longo prazo adaptado ao contexto ESG Municipal.

## Resumo Global

| Métrica                  | Valor      |
| :----------------------- | :--------- |
| **Instâncias avaliadas** | 5          |
| **Acurácia global**      | **100%**   |
| **Data de execução**     | 2026-04-09 |

## Acurácia por Categoria

| Categoria              | Total | Corretas |  Acurácia   |
| :--------------------- | :---: | :------: | :---------: |
| Extração de Informação |   5   |    5     | 🟢 **100%** |

## Acertos

| ID                       | Categoria              | Latência |
| :----------------------- | :--------------------- | :------: |
| ext-datasus-mort-4205407 | Extração de Informação |   0ms    |
| ext-datasus-mort-4209102 | Extração de Informação |   0ms    |
| ext-datasus-mort-4202404 | Extração de Informação |   0ms    |
| ext-datasus-mort-4204202 | Extração de Informação |   0ms    |
| ext-datasus-mort-4204608 | Extração de Informação |   0ms    |

## Metodologia

Benchmark baseado no [LongMemEval](https://arxiv.org/abs/2404.09960) adaptado para o contexto ESG Municipal.
Avaliação via LLM-as-a-Judge (Claude Haiku) com fallback heurístico quando API não disponível.
Categorias testadas: Extração, Multissessão, Temporal, Atualização, Abstenção.
