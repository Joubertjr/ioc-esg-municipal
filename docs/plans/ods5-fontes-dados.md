# Pesquisa de Fontes de Dados — ODS 5 (Igualdade de Gênero)

> Pesquisa realizada em 2026-04-01 por data-collector agent.
> Objetivo: mapear todas as fontes públicas brasileiras para calcular score ODS 5 a nível municipal.

---

## Sumário de Fontes

| Fonte | Tipo de Acesso | Granularidade | Relevância ODS 5 | Status |
|-------|---------------|---------------|-----------------|--------|
| TSE | Download CSV (ZIP) | Municipal | Alta — representação política | Confirmado |
| IBGE SIDRA (Censo 2022) | REST API | Municipal | Alta — renda e ocupação por sexo | Confirmado |
| RAIS/CAGED | Download FTP (TXT) | Municipal | Média — emprego formal | Confirmado sem API |
| DataSUS SIM/SINASC | TABNET (POST scraping) | Municipal | Alta — mortalidade materna, gravidez adolescente | Confirmado sem API REST |
| INEP Censo Escolar | Download ZIP (CSV) | Municipal | Baixa-Média — taxa conclusão por sexo | Confirmado sem API |

---

## 1. TSE — Tribunal Superior Eleitoral

### Acesso
- **Portal:** https://dadosabertos.tse.jus.br
- **Tipo:** Download de arquivos ZIP contendo CSV/TXT — **sem API REST**
- **CKAN API:** Existe genérica mas apenas para metadados dos datasets, não para os dados em si

### Download direto (CDN)
```
# Todos os candidatos 2024 (todos os estados)
https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip

# Resultado eleições 2024 — votação nominal por município e zona
https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip

# Estrutura dos datasets no portal
https://dadosabertos.tse.jus.br/dataset/candidatos-2024
https://dadosabertos.tse.jus.br/dataset/resultados-2024
```

### Colunas relevantes (arquivo `consulta_cand_<ano>_<UF>.csv`)
| Coluna | Descrição |
|--------|-----------|
| `SQ_CANDIDATO` | Sequencial único do candidato |
| `DS_GENERO` | "FEMININO" ou "MASCULINO" |
| `DS_CARGO` | "PREFEITO", "VEREADOR", etc. |
| `CD_MUNICIPIO` | Código do município TSE (5 dígitos — **diferente do IBGE**) |
| `NM_MUNICIPIO` | Nome do município |
| `SG_UF` | Sigla do estado |
| `DS_SIT_TOT_TURNO` | "ELEITO POR QP", "ELEITO POR MÉDIA", "NÃO ELEITO", etc. |
| `NR_TURNO` | Turno (1 ou 2) |
| `DS_DETALHE_SITUACAO_CAND` | Situação detalhada |

### Gotcha crítico: código município TSE vs IBGE
- TSE usa código de **5 dígitos** (`CD_MUNICIPIO` = "88013" para Chapecó/SC)
- IBGE usa **7 dígitos** ("4204202" para Chapecó/SC)
- É necessário mapeamento: usar tabela de-para disponível em:
  `https://cdn.tse.jus.br/estatistica/sead/odsele/aux/munic.zip`
  - Colunas: `CD_MUNICIPIO` (TSE 5d) | `CD_MUNICIPIO_IBGE` (7d) | `NM_MUNICIPIO` | `SG_UF`

### Indicadores ODS 5 extraíveis
1. **% de vereadoras eleitas** = `count(DS_GENERO='FEMININO' AND DS_CARGO='VEREADOR' AND DS_SIT_TOT_TURNO LIKE 'ELEITO%')` / `total_vagas_câmara`
2. **Prefeita eleita (binário)** = `DS_GENERO='FEMININO' AND DS_CARGO='PREFEITO' AND DS_SIT_TOT_TURNO LIKE 'ELEITO%'`
3. **% de candidatas a vereador** = proporção de candidaturas femininas (inclui não eleitas)

### Periodicidade e série histórica
- Municipais: 2024, 2020, 2016, 2012, 2008... (a cada 4 anos)
- Dados históricos disponíveis desde 2002 no CDN com mesma estrutura
- Para série temporal: calcular tendência de evolução da representação feminina

### Volume do arquivo
- `consulta_cand_2024.zip` (nacional) ~ 150 MB descompactado
- Recomendado: filtrar por `SG_UF='SC'` e `DS_CARGO IN ('PREFEITO','VEREADOR')` ao processar

---

## 2. IBGE SIDRA — API REST (Censo Demográfico 2022)

### Acesso
- **Base URL:** `https://apisidra.ibge.gov.br/values/`
- **Tipo:** REST API pública — **sem autenticação**
- **Documentação:** https://apisidra.ibge.gov.br/home/ajuda
- **Limite:** 100.000 valores por request

### Formato da URL
```
https://apisidra.ibge.gov.br/values/t/{tabela}/n6/{municipio}/v/{variavel}/p/{periodo}/c{classif}/{categoria}/f/n
```

Parâmetros:
- `t/` — código da tabela SIDRA
- `n6/` — nível geográfico município (7 dígitos IBGE). Use `all` para todos.
- `n6/in n3 42` — todos municípios de SC (estado 42)
- `v/` — variável (código numérico ou `all` ou `allxp`)
- `p/` — período (`last`, `all`, `2022`, etc.)
- `c2/` — classificação 2 = sexo: `6794` = Homens, `6795` = Mulheres, `all` = ambos
- `f/n` — retornar apenas nomes (sem códigos)
- `d/2` — 2 casas decimais

### Tabelas prioritárias para ODS 5

#### Grupo A — Rendimento por sexo (DIRETO — código de município funciona)

**Tabela 10281** — Rendimento médio e mediano por sexo, raça, educação
```
GET https://apisidra.ibge.gov.br/values/t/10281/n6/4204202/v/10098,10099/p/2022/c2/6794,6795/f/n
```
- Variáveis: `10098` = valor médio do rendimento | `10099` = valor mediano
- Retorna: rendimento médio mensal de pessoas ocupadas, por sexo, para município específico
- **Indicador ODS 5:** Razão de rendimento mulher/homem

**Tabela 10280** — Rendimento médio por posição na ocupação e tipo de emprego
```
GET https://apisidra.ibge.gov.br/values/t/10280/n6/4204202/v/10098,10099/p/2022/c2/6794,6795/f/n
```

**Tabela 10291** — Rendimento médio por sexo, raça e idade (pessoas 10+)
```
GET https://apisidra.ibge.gov.br/values/t/10291/n6/4204202/v/10098/p/2022/c2/6794,6795/f/n
```

#### Grupo B — Ocupação e mercado de trabalho por sexo

**Tabela 6580** — Pessoas 14+ por condição de atividade, sexo
```
GET https://apisidra.ibge.gov.br/values/t/6580/n6/4204202/v/606/p/2022/c2/6794,6795/f/n
```
- Variável `606` = pessoas na força de trabalho
- **Indicador ODS 5:** taxa de ocupação feminina vs masculina

**Tabela 10268** — Níveis de ocupação por sexo, raça e idade
```
GET https://apisidra.ibge.gov.br/values/t/10268/n6/4204202/v/all/p/2022/c2/6794,6795/f/n
```

**Tabela 9517** — Pessoas 14+ por condição de atividade, sexo, raça e escolaridade
```
GET https://apisidra.ibge.gov.br/values/t/9517/n6/4204202/v/606,607/p/2022/c2/6794,6795/f/n
```

#### Grupo C — Responsabilidade domiciliar por sexo

**Tabela 1378** — Responsável pelo domicílio por sexo
```
GET https://apisidra.ibge.gov.br/values/t/1378/n6/4204202/v/all/p/2022/c2/6794,6795/f/n
```
- **Indicador ODS 5:** % de domicílios chefiados por mulheres

**Tabela 608** — População residente por sexo
```
GET https://apisidra.ibge.gov.br/values/t/608/n6/4204202/v/93/p/2022/c2/6794,6795/f/n
```

### Exemplo de request e resposta
```bash
# Rendimento médio por sexo — Chapecó (4204202)
curl "https://apisidra.ibge.gov.br/values/t/10281/n6/4204202/v/10098/p/2022/c2/6794,6795/f/n"

# Resposta esperada (JSON array):
[
  {"D1N":"Chapecó","D2N":"Censo Demográfico 2022","D3N":"Homens","V":"3456.78","MN":"Reais"},
  {"D1N":"Chapecó","D2N":"Censo Demográfico 2022","D3N":"Mulheres","V":"2234.56","MN":"Reais"}
]
```

### Todos municípios SC de uma vez
```
# Rendimento médio de TODOS os 295 municípios de SC
GET https://apisidra.ibge.gov.br/values/t/10281/n6/in n3 42/v/10098/p/2022/c2/6794,6795/f/n

# Atenção: pode ultrapassar 100k valores — preferir n6/all e filtrar no código
```

### Periodicidade
- Censo 2022: referência quinquenal. Próximo: 2027 ou 2032.
- PNAD Contínua (tabelas 5xxx): trimestral, mas **sem granularidade municipal** — apenas UF/BR.

### Mapeamento ODS 5 x Tabelas SIDRA
| Indicador ODS 5 | Tabela SIDRA | Variável | Classificação |
|-----------------|-------------|---------|---------------|
| Razão rendimento F/M | 10281 | 10098 (médio), 10099 (mediano) | c2 (sexo) |
| Taxa ocupação feminina | 6580 | 606 | c2 |
| Nível de ocupação F/M | 10268 | all | c2 |
| Chefes de família femininos | 1378 | all | c2 |
| Desemprego por sexo | 9517 | 607 | c2 |

---

## 3. RAIS/CAGED — Ministério do Trabalho

### Acesso
- **Portal:** https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged
- **Tipo:** Download FTP — **sem API REST**
- **FTP:** `ftp://ftp.mtps.gov.br/pdet/microdados/`
- **Formato:** TXT com delimitador `;`, encoding UTF-8 (Novo CAGED) ou Latin-1 (RAIS legado)
- **PDET online:** https://bi.mte.gov.br/bgcaged/

### Estrutura de arquivos FTP
```
ftp://ftp.mtps.gov.br/pdet/microdados/
├── RAIS/
│   ├── 2023/
│   │   ├── RAIS_ESTAB_PUB.7z    # estabelecimentos (sem PF)
│   │   └── RAIS_VINC_PUB_MG_ES_RJ.7z  # vínculos por região
│   └── ...
└── Novo_CAGED/
    ├── 2024/
    │   ├── CAGEDMOV202401.7z    # movimentações mensais
    │   └── ...
    └── ...
```

### Campos RAIS relevantes para ODS 5 (arquivo de vínculos)
| Campo | Descrição |
|-------|-----------|
| `Município` | Código IBGE de 6 dígitos (sem verificador — igual ao SICONFI!) |
| `Sexo Trabalhador` | 1=Masculino, 3=Feminino |
| `Faixa Etária` | Faixas etárias codificadas |
| `Remuneração Média (SM)` | Remuneração em salários mínimos |
| `Remuneração Dezembro Nominal` | Valor em R$ |
| `CNAE 2.0 Subclasse` | Setor econômico |
| `Grau de Instrução após 2005` | Escolaridade |

### Indicadores ODS 5 extraíveis da RAIS
1. **Razão salarial F/M no emprego formal** = média remuneração mulheres / média remuneração homens por município
2. **% mulheres no emprego formal** = count(Sexo=3) / count(total) por município
3. **Segregação ocupacional** = distribuição por setor e sexo

### Gotcha: tamanho dos arquivos
- RAIS vínculos nacional: ~10 GB descompactado
- Estratégia recomendada: processar com streaming e filtrar `Município LIKE '42%'` (SC) durante leitura
- Ou usar ferramentas PDET online para agregar antes do download

### Periodicidade
- RAIS: anual (referência 31/12). Defasagem ~8 meses (dados de 2023 disponíveis ~ago/2024)
- Novo CAGED: mensal, dado mais recente disponível com ~2 meses de atraso

---

## 4. DataSUS — SIM e SINASC

### Acesso
- **TABNET:** http://tabnet.datasus.gov.br
- **Tipo:** Interface web CGI — **sem API REST oficial**
- **Acesso programático:** POST HTTP para `tabcgi.exe` (scraping documentado)
- **Dados:** Disponíveis desde 1994 (SINASC) e 1996 (SIM/CID-10)

### Sistemas relevantes para ODS 5

#### SIM — Sistema de Informações sobre Mortalidade
- **Mortalidade materna:** CID-10 O00–O99 (Capítulo XV — Gravidez, parto e puerpério)
- **URL base TABNET:**
  ```
  http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sim/cnv/mat10uf.def
  # "mat10" = mortalidade materna; "uf" = por UF; trocar por "mun" para município
  ```
- **URL por município:**
  ```
  http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sim/cnv/mat10br.def
  ```

#### SINASC — Sistema de Informações de Nascidos Vivos
- **URL TABNET:**
  ```
  http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinasc/cnv/nvuf.def
  ```
- **Variável relevante:** `IDADEMAE` — idade da mãe (permite calcular gravidez adolescente <20 anos)
- **Linha sugerida:** Município de residência da mãe
- **Colunas sugeridas:** Faixa etária da mãe

### Método de acesso programático (TABNET POST)
O TABNET não tem API REST mas aceita requisições POST com parâmetros previsíveis:
```typescript
// Exemplo de POST para SIM — mortalidade materna por município SC
const params = new URLSearchParams({
  'Linha': 'Município',
  'Coluna': 'Não ativa',
  'Incremento': 'Óbitos_maternos',
  'Arquivos': 'matosc2022.dbf',  // arquivo do ano/UF
  'pesqmes1': 'Digite_o_nome_a_pesquisar',
  'SMunic': 'TODAS_AS_CATEGORIAS',
  'zerosec': '0',
  'formato': 'table',
  'mostre': 'Mostra'
});

const response = await fetch(
  'http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sim/cnv/mat10sc.def',
  { method: 'POST', body: params }
);
// Parse HTML da resposta para extrair tabela CSV
```

### Alternativa recomendada: pacote datasus (R) como referência
- Repositório: https://github.com/rpradosiqueira/datasus
- Função `sim_obt10_mun()` — mortalidade por município com filtro por CID
- Útil como referência para entender os parâmetros dos POSTs

### Indicadores ODS 5 extraíveis
| Indicador | Sistema | Filtro CID / Campo |
|-----------|---------|-------------------|
| Óbitos maternos por município | SIM | CID O00-O99 |
| Razão de mortalidade materna | SIM + SINASC | óbitos/NV × 100.000 |
| Nascimentos de mães <20 anos | SINASC | IDADEMAE < 20 |
| % gravidez adolescente | SINASC | IDADEMAE 10–19 / total NV |

### Gotcha crítico: supressão de dados
- Municípios com **<3 óbitos maternos** têm dados suprimidos por privacidade (retornam `X`)
- Para municípios pequenos (<20k hab): mortalidade materna geralmente não disponível por município
- Estratégia: usar dados de micro/meso-região como proxy para municípios com dado suprimido
- Periodicidade: dados com ~1 ano de defasagem (2024 disponível ~2025)

---

## 5. INEP — Instituto Nacional de Estudos e Pesquisas Educacionais

### Acesso
- **Microdados Censo Escolar:** https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar
- **Tipo:** Download ZIP — **sem API REST**
- **Tipo de arquivo:** CSV com `;` como delimitador
- **Codificação:** Latin-1 (ISO-8859-1)

### Download direto
```
# Censo Escolar 2024 — matrículas
https://download.inep.gov.br/microdados/microdados_educacao_basica_2024.zip

# Censo Escolar 2023
https://download.inep.gov.br/microdados/microdados_educacao_basica_2023.zip

# Padrão URL: microdados_educacao_basica_{ano}.zip
```

### Arquivos dentro do ZIP
```
microdados_educacao_basica_2024/
├── dados/
│   ├── MATRICULA_NORDESTE.csv   # ~3GB descompactado para Brasil inteiro
│   ├── MATRICULA_SUL.csv        # SC, PR, RS — preferir para SC
│   ├── TURMA.csv
│   └── ESCOLA.csv
├── Anexos/
│   └── Leia-me Censo Escolar 2024.pdf
```

### Campos relevantes para ODS 5 (arquivo MATRICULA_SUL.csv)
| Campo | Descrição |
|-------|-----------|
| `CO_MUNICIPIO` | Código IBGE do município — **7 dígitos** |
| `TP_SEXO` | 1=Masculino, 2=Feminino |
| `TP_ETAPA_ENSINO` | Etapa de ensino (EM, EF, EJA...) |
| `TP_SITUACAO` | 1=Aprovado, 2=Reprovado, 3=Transferido, 4=Abandonou, 5=Falecido |
| `NU_ANO_CENSO` | Ano do censo |
| `CO_ESCOLA` | Código da escola (join com ESCOLA.csv para lat/lon) |

### Indicadores ODS 5 extraíveis
1. **Taxa de abandono escolar por sexo** = count(TP_SITUACAO=4 AND TP_SEXO=2) / total_matrículas_femininas
2. **Taxa de reprovação por sexo** = similar
3. **Razão de matrículas F/M** no ensino médio por município

### Gotcha: taxa de conclusão não está diretamente no Censo Escolar
- O Censo Escolar registra situação no ano, não conclusão de ciclo
- Para taxa de conclusão formal, usar **Indicadores Educacionais INEP** (tabelas pré-processadas):
  ```
  https://download.inep.gov.br/informacoes_estatisticas/indicadores_educacionais/2023/NU_TX_ABANDONO_{etapa}_TOTAL.xlsx
  ```
- Porém, os indicadores pré-processados **não têm desagregação por sexo por município** — necessário calcular dos microdados

### Volume e estratégia de processamento
- MATRICULA_SUL.csv: ~500 MB descompactado
- Processar com streaming, filtrar `CO_MUNICIPIO LIKE '42%'` (SC = estado 42)
- Periodicidade: anual (referência março do ano corrente)

---

## 6. Indicadores ODS 5 — Mapeamento Completo e Score

### Indicadores propostos para o score ODS 5 municipal

| # | Indicador | Fonte | Peso | Frequência |
|---|-----------|-------|------|-----------|
| 5.1 | % vereadoras eleitas | TSE 2024 | 25% | 4 anos |
| 5.2 | Razão rendimento médio F/M (emprego formal) | SIDRA t10281 | 25% | 5 anos (Censo) |
| 5.3 | Taxa de gravidez adolescente (<20 anos) | SINASC/DataSUS | 20% | Anual |
| 5.4 | Taxa de ocupação feminina vs masculina | SIDRA t6580 | 15% | 5 anos (Censo) |
| 5.5 | Taxa de abandono escolar EM — sexo feminino | INEP Censo Escolar | 10% | Anual |
| 5.6 | Prefeita eleita (bônus) | TSE 2024 | 5% | 4 anos |

### Fórmulas de normalização

```typescript
// 5.1 — % vereadoras (referência nacional ~16%, meta ODS: 50%)
const scoreVereadoras = Math.min(100, (pctVereadoras / 0.5) * 100)

// 5.2 — Razão de rendimento (1.0 = paridade, realidade BR ~0.78)
const scoreRendimento = Math.min(100, (razaoRendimento / 1.0) * 100)

// 5.3 — Gravidez adolescente (menor = melhor; ref BR ~14%)
const scoreGravidez = Math.max(0, 100 - (pctGravidezAdolescente / 0.20) * 100)

// 5.4 — Taxa ocupação F/M (1.0 = paridade)
const scoreOcupacao = Math.min(100, (razaoOcupacao / 1.0) * 100)

// Score final ponderado
const scoreODS5 = (
  scoreVereadoras * 0.25 +
  scoreRendimento * 0.25 +
  scoreGravidez   * 0.20 +
  scoreOcupacao   * 0.15 +
  scoreAbandonoEM * 0.10 +
  scorePrefeita   * 0.05
)
```

---

## 7. Decisão de Implementação: Prioridade por Facilidade x Impacto

### Tier 1 — Implementar primeiro (API REST, dados limpos)
1. **IBGE SIDRA** — API REST gratuita, resposta JSON, código 7 dígitos nativo
   - Tabelas 10281, 6580, 1378
   - Integrar ao `IbgeCollector` existente ou criar `IbgeSidraODS5Collector`

### Tier 2 — Implementar em seguida (download processado)
2. **TSE** — Download nacional único, CSV simples, de-para TSE→IBGE necessário
   - Processar `consulta_cand_2024.zip` + `munic.zip` (mapeamento)
   - Armazenar resultado agregado por município no banco
   - Novo coletor: `backend/agents/tse/tse_collector.ts`

### Tier 3 — Implementar após (mais complexo)
3. **DataSUS SINASC** — POST scraping do TABNET HTML
   - Integrar ao `DataSusCollector` existente
   - Adicionar método `fetchGravidezAdolescente(municipioId, ano)`

4. **INEP Censo Escolar** — Download de 500 MB, processar microdados
   - Integrar ao `InepCollector` existente ou processamento ETL separado
   - Armazenar indicadores pré-processados por município

5. **RAIS** — Download FTP pesado, processamento intensivo
   - ETL eventual: processar arquivo nacional, extrair SC, armazenar no banco

---

## 8. Gotchas Específicos do ODS 5

### TSE
- Código de município TSE (5d) ≠ código IBGE (7d) — usar tabela `munic.zip` para conversão
- Arquivo `consulta_cand` inclui candidatos não registrados — filtrar `DS_DETALHE_SITUACAO_CAND NOT IN ('INDEFERIDO','CANCELADO')`
- Para vereadoras: considerar apenas cadeiras efetivamente ganhas (`DS_SIT_TOT_TURNO LIKE 'ELEITO%'`)
- Cota de gênero: TSE exige 30% de candidaturas femininas — ou seja, % candidaturas ≠ % eleitas

### IBGE SIDRA
- Tabela 10281 é Censo 2022 — dado mais recente disponível
- Para municípios <20k hab: alguns valores podem retornar `X` (suprimido) — tratar como `null`
- A API aceita `n6/in n3 42` para todos os municípios de SC em uma chamada, mas pode exceder 100k valores com muitas variáveis — dividir se necessário
- Variável de rendimento: usar `10098` (médio) para score, `10099` (mediano) como validação

### DataSUS
- Óbitos maternos em municípios pequenos são suprimidos (<3 casos) — retornar `null`, nunca imputar
- SINASC disponível desde 1994 mas qualidade de dados melhorou significativamente após 2000
- TABNET não suporta filtro direto por código IBGE — necessário selecionar UF primeiro depois município

### INEP
- `TP_SITUACAO` no Censo Escolar é situação no final do ano letivo, não taxa de conclusão de ciclo
- Escolas com <3 alunos em determinada categoria: dados suprimidos (omitidos no CSV)
- Codificação Latin-1 — converter para UTF-8 antes de processar

---

## Referências

- [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br)
- [Candidatos 2024 — TSE](https://dadosabertos.tse.jus.br/dataset/candidatos-2024)
- [Resultados 2024 — TSE](https://dadosabertos.tse.jus.br/dataset/resultados-2024)
- [SIDRA — Censo 2022 Trabalho e Rendimento](https://sidra.ibge.gov.br/pesquisa/censo-demografico/demografico-2022/amostra-trabalho-e-rendimento)
- [SIDRA API — Documentação](https://apisidra.ibge.gov.br/home/ajuda)
- [Tabela 5436 — Rendimento médio mensal por sexo (PNAD)](https://sidra.ibge.gov.br/tabela/5436)
- [Tabela 1391 — Rendimento médio por sexo e situação domicílio](https://sidra.ibge.gov.br/tabela/1391)
- [Microdados RAIS e CAGED — MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged)
- [TABNET — DATASUS](https://datasus.saude.gov.br/informacoes-de-saude-tabnet/)
- [SIM — Mortalidade Materna](http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sim/cnv/mat10uf.def)
- [SINASC — Nascidos Vivos](http://tabnet.datasus.gov.br/cgi/tabcgi.exe?sinasc/cnv/nvuf.def)
- [Microdados Censo Escolar — INEP](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar)
- [pacote R datasus](https://github.com/rpradosiqueira/datasus)
