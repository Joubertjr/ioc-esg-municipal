# LongMemEval-ESG — Relatório 2026-04-09

> Benchmark de memória de longo prazo adaptado ao contexto ESG Municipal.

## Resumo Global

| Métrica                  | Valor      |
| :----------------------- | :--------- |
| **Instâncias avaliadas** | 50         |
| **Acurácia global**      | **100%**   |
| **Data de execução**     | 2026-04-09 |

## Acurácia por Categoria

| Categoria                   | Total | Corretas |  Acurácia   |
| :-------------------------- | :---: | :------: | :---------: |
| Extração de Informação      |  10   |    10    | 🟢 **100%** |
| Raciocínio Multissessão     |  10   |    10    | 🟢 **100%** |
| Raciocínio Temporal         |  10   |    10    | 🟢 **100%** |
| Atualização de Conhecimento |  10   |    10    | 🟢 **100%** |
| Abstenção                   |  10   |    10    | 🟢 **100%** |

## Acertos

| ID                                         | Categoria                   | Latência |
| :----------------------------------------- | :-------------------------- | :------: |
| ext-datasus-mort-4205407                   | Extração de Informação      |   0ms    |
| ext-datasus-mort-4209102                   | Extração de Informação      |   0ms    |
| ext-datasus-mort-4202404                   | Extração de Informação      |   0ms    |
| ext-datasus-mort-4204202                   | Extração de Informação      |   0ms    |
| ext-datasus-mort-4204608                   | Extração de Informação      |   0ms    |
| ext-snis-esgoto-4205407                    | Extração de Informação      |   1ms    |
| ext-snis-esgoto-4209102                    | Extração de Informação      |   0ms    |
| ext-snis-esgoto-4208203                    | Extração de Informação      |   0ms    |
| ext-snis-esgoto-4209300                    | Extração de Informação      |   0ms    |
| ext-snis-esgoto-4208906                    | Extração de Informação      |   0ms    |
| multi-snis-datasus-4205407                 | Raciocínio Multissessão     |   0ms    |
| multi-snis-datasus-4209102                 | Raciocínio Multissessão     |   0ms    |
| multi-snis-datasus-4202404                 | Raciocínio Multissessão     |   0ms    |
| multi-snis-datasus-4204202                 | Raciocínio Multissessão     |   0ms    |
| multi-snis-datasus-4204608                 | Raciocínio Multissessão     |   0ms    |
| multi-ibge-inep-4205407                    | Raciocínio Multissessão     |   0ms    |
| multi-ibge-inep-4209102                    | Raciocínio Multissessão     |   0ms    |
| multi-ibge-inep-4216602                    | Raciocínio Multissessão     |   0ms    |
| multi-ibge-inep-4202008                    | Raciocínio Multissessão     |   1ms    |
| multi-ibge-inep-4218707                    | Raciocínio Multissessão     |   0ms    |
| temp-inep-ideb-4205407                     | Raciocínio Temporal         |   0ms    |
| temp-inep-ideb-4209102                     | Raciocínio Temporal         |   0ms    |
| temp-inep-ideb-4204202                     | Raciocínio Temporal         |   0ms    |
| temp-inep-ideb-4209300                     | Raciocínio Temporal         |   0ms    |
| temp-inep-ideb-4204608                     | Raciocínio Temporal         |   0ms    |
| temp-siconfi-fpm-4205407                   | Raciocínio Temporal         |   0ms    |
| temp-siconfi-fpm-4209102                   | Raciocínio Temporal         |   0ms    |
| temp-siconfi-fpm-4202404                   | Raciocínio Temporal         |   0ms    |
| temp-siconfi-fpm-4208203                   | Raciocínio Temporal         |   0ms    |
| temp-siconfi-fpm-4216602                   | Raciocínio Temporal         |   0ms    |
| update-siconfi-despesaPessoal-4205407      | Atualização de Conhecimento |   0ms    |
| update-siconfi-despesaPessoal-4209102      | Atualização de Conhecimento |   1ms    |
| update-datasus-mortalidadeInfantil-4202404 | Atualização de Conhecimento |   0ms    |
| update-snis-atendimentoEsgoto-4204202      | Atualização de Conhecimento |   0ms    |
| update-datasus-mortalidadeInfantil-4204608 | Atualização de Conhecimento |   0ms    |
| update-inpe-desmatamento-4208203           | Atualização de Conhecimento |   0ms    |
| update-snis-atendimentoAgua-4209300        | Atualização de Conhecimento |   0ms    |
| update-siconfi-receitaTotal-4208906        | Atualização de Conhecimento |   0ms    |
| update-datasus-coberturaVacinal-4216602    | Atualização de Conhecimento |   0ms    |
| update-snis-perdaFaturamento-4202008       | Atualização de Conhecimento |   0ms    |
| abs-seeg-4205407                           | Abstenção                   |   0ms    |
| abs-tce-sc-4209102                         | Abstenção                   |   0ms    |
| abs-capes-4202404                          | Abstenção                   |   0ms    |
| abs-ipea-4204202                           | Abstenção                   |   0ms    |
| abs-mte-4204608                            | Abstenção                   |   0ms    |
| abs-ibama-4208203                          | Abstenção                   |   0ms    |
| abs-seeg-4209300                           | Abstenção                   |   0ms    |
| abs-rais-4208906                           | Abstenção                   |   0ms    |
| abs-caged-4216602                          | Abstenção                   |   0ms    |
| abs-mcti-4202008                           | Abstenção                   |   0ms    |

## Metodologia

Benchmark baseado no [LongMemEval](https://arxiv.org/abs/2404.09960) adaptado para o contexto ESG Municipal.
Avaliação via LLM-as-a-Judge (Claude Haiku) com fallback heurístico quando API não disponível.
Categorias testadas: Extração, Multissessão, Temporal, Atualização, Abstenção.
