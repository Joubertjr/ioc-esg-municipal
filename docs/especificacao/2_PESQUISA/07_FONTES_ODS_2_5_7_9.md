# Fontes de Dados — ODS 2, 5, 7 e 9

**Data de pesquisa:** 2026-04-01
**Agente:** data-collector (nova tentativa apos rate limit)
**Status:** Pesquisa concluida, viabilidade avaliada por fonte

---

## ODS 2 — Fome Zero e Agricultura Sustentavel

### 2.1 SISVAN — Estado Nutricional Infantil

| Atributo | Valor |
|----------|-------|
| Orgao | Ministerio da Saude / DataSUS |
| Portal | https://dadosabertos.saude.gov.br/dataset/sisvan-estado-nutricional |
| Formato | CSV / JSON / XML (arquivos ZIP anuais) |
| Granularidade | Individual anonimizado — requer agregacao por municipio |
| Frequencia | Anual (divulgacao em junho; cobre ano anterior) |
| Autenticacao | Nenhuma |
| Viabilidade | MEDIO |

**URL de download (padrao anual):**
```
https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SISVAN/estado_nutricional/sisvan_estado_nutricional_2023.zip
```

**Campos relevantes para ODS 2:**
- `co_municipio_ibge` — codigo IBGE 7 digitos
- `nu_fase_vida` — fase (crianca/adolescente/adulto/idoso)
- `ds_imc` — classificacao IMC (magreza acentuada, magreza, eutrofico, sobrepeso, obesidade)
- `nu_peso`, `nu_altura` — medidas antropometricas
- `co_cnes` — estabelecimento de saude (APS)

**Indicadores calculaveis:**
- Taxa de desnutricao infantil (% de criancas com magreza ou magreza acentuada)
- Taxa de obesidade infantil
- Cobertura do SISVAN no municipio (criancas acompanhadas / total estimado)

**Gotcha critico:**
- Dados individualizados — arquivo ZIP de ~500 MB/ano
- Nao ha API REST por municipio — necessario baixar CSV completo e filtrar por `co_municipio_ibge`
- Municipios pequenos (<50 registros): suprimir resultado por questao de privacidade/amostra
- A URL `opendatasus.saude.gov.br` redireciona para `dadosabertos.saude.gov.br` desde 2025
- A API mencionada em `apidadosabertos.saude.gov.br` retornou 503 durante pesquisa — pouco confiavel

**Estrategia de implementacao:**
Download anual do ZIP no `setup` ou worker semanal, descompactar, importar para tabela local PostgreSQL particionada por ano, depois agregar por municipio. TTL: 7 dias (igual INEP/SNIS).

---

### 2.2 FNDE PNAE — Alimentacao Escolar

| Atributo | Valor |
|----------|-------|
| Orgao | FNDE (Fundo Nacional de Desenvolvimento da Educacao) |
| Portal | https://www.fnde.gov.br/dadosabertos/ |
| Portal alternativo | https://dados.gov.br/dados/conjuntos-dados/programa-nacional-de-alimentacao-escolar-pnae |
| Formato | CSV / Excel |
| Granularidade | Municipal |
| Frequencia | Anual |
| Autenticacao | Nenhuma |
| Viabilidade | MEDIO |

**Nota de acesso:** O portal `fnde.gov.br/dadosabertos/` estava inacessivel (ENOTFOUND) durante a pesquisa. O espelho em `dados.gov.br` tambem exige JavaScript. Recomenda-se acessar via CKAN API do portal govBR.

**URL CKAN (tentativa):**
```
https://dados.gov.br/api/3/action/package_show?id=programa-nacional-de-alimentacao-escolar-pnae
```

**Dados esperados (conforme documentacao do FNDE):**
- Alunos atendidos por rede (municipal/estadual) por municipio
- Valor repassado pelo FNDE por municipio/ano
- Escolas beneficiadas
- Prestacao de contas (agriculura familiar — percentual minimo 30%)

**Indicadores para ODS 2:**
- % de alunos atendidos pelo PNAE em relacao ao total matriculado
- % de compras da agricultura familiar (meta: >= 30%)
- Valor per capita repassado

**Gotcha:** Site do FNDE tem instabilidade historica. Priorizar cache longo (7 dias). Dados chegam com defasagem de ~12 meses.

---

### 2.3 IBGE SIDRA — Producao Agricola Municipal (PAM)

| Atributo | Valor |
|----------|-------|
| Orgao | IBGE |
| API Base | https://servicodados.ibge.gov.br/api/v3/agregados |
| Tabela principal | 5457 (lavouras temporarias e permanentes) |
| Formato | REST JSON |
| Granularidade | Municipal (N6) |
| Frequencia | Anual |
| Autenticacao | Nenhuma |
| Viabilidade | FACIL |

**Request de exemplo validado:**
```
GET https://servicodados.ibge.gov.br/api/v3/agregados/5457/periodos/2022/variaveis/215?localidades=N6[4204202]
```

**Response confirmado (Chapeco/SC 2022):**
```json
[{
  "id": "215",
  "variavel": "Valor da producao",
  "unidade": "Mil Reais",
  "resultados": [{
    "classificacoes": [{
      "id": "782",
      "nome": "Produto das lavouras temporarias e permanentes",
      "categoria": {"0": "Total"}
    }],
    "series": [{
      "localidade": {"id": "4204202", "nivel": {"id": "N6"}, "nome": "Chapeco (SC)"},
      "serie": {"2022": "158652"}
    }]
  }]
}]
```

**Variaveis relevantes da tabela 5457:**
- `215` — Valor da producao (Mil Reais)
- `216` — Area plantada (Hectares)
- `214` — Quantidade produzida (Toneladas)

**Variaveis alternativas:**
- Tabela `1612` — Lavouras temporarias (mesmas variaveis, separadas)
- Tabela `1613` — Lavouras permanentes

**Indicadores para ODS 2:**
- Valor bruto da producao agricola municipal (R$ mil)
- Area agricola total colhida (ha)
- Intensidade produtiva (R$/ha)

**Gotcha:** Codigo IBGE para municipios SC: 7 digitos, iniciam com 42. Filtro para SC inteiro: `localidades=N6[42*]`. Dados de 2022 = PAM mais recente validado.

---

## ODS 5 — Igualdade de Genero

### 5.1 TSE Dados Abertos — Representacao Feminina Eleita

| Atributo | Valor |
|----------|-------|
| Orgao | Tribunal Superior Eleitoral |
| Portal | https://dadosabertos.tse.jus.br/ |
| Dataset candidatos | https://dadosabertos.tse.jus.br/dataset/candidatos-2024 |
| Formato | CSV compactado (ZIP) |
| Granularidade | Municipal — por candidato |
| Frequencia | Quadrienal (eleicoes municipais) |
| Autenticacao | Nenhuma |
| Viabilidade | MEDIO |

**URL de download CSV candidatos 2024:**
```
https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip
```

**Campos confirmados ou fortemente evidenciados:**
- `DS_GENERO` — "FEMININO" / "MASCULINO"
- `DS_CARGO` — "VEREADOR" / "PREFEITO" / etc.
- `DS_SIT_TOT_TURNO` — situacao final: "ELEITO" / "NAO ELEITO" / "ELEITO POR QP" / etc.
- `SG_UF` — sigla do estado (SC)
- `NM_MUNICIPIO` — nome do municipio
- `SG_UE` — codigo TSE do municipio (diferente do IBGE)
- `CD_MUNICIPIO_IBGE` — codigo IBGE 7 digitos (presente em versoes recentes)

**Query logica para calcular % vereadoras eleitas:**
```
FILTRAR: SG_UF="SC" AND DS_CARGO="VEREADOR"
         AND DS_SIT_TOT_TURNO IN ("ELEITO", "ELEITO POR QP", "ELEITO POR MEDIA")
AGRUPAR por: NM_MUNICIPIO / CD_MUNICIPIO_IBGE
CALCULAR: COUNT(DS_GENERO="FEMININO") / COUNT(*) * 100
```

**Gotcha critico:**
- O arquivo ZIP contem todos os estados do Brasil (~50 MB descompactado)
- Separador CSV pode ser `;` (ponto-e-virgula) com encoding `latin-1` — verificar leiame
- `DS_SIT_TOT_TURNO` tem multiplos valores para "eleito" — usar IN list
- Dados de 2024 sao os mais recentes; proximas eleicoes municipais: 2028
- Para prefeitas: filtrar `DS_CARGO="PREFEITO"` — campo nao e genderizado no nome

**Indicadores para ODS 5:**
- % de vereadoras eleitas no municipio (meta ODS: 50%)
- Numero absoluto de vereadoras eleitas
- % de candidatas do total de candidatos registrados

---

### 5.2 RAIS — Emprego Formal por Sexo

| Atributo | Valor |
|----------|-------|
| Orgao | Ministerio do Trabalho e Emprego (MTE) |
| Portal microdados | https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/microdados-rais-e-caged |
| Formato | TXT com delimitador `;` (UTF-8) — download anual |
| Granularidade | Vinculo individual — agregar por municipio |
| Frequencia | Anual (defasagem ~12 meses) |
| Autenticacao | Registro no PDET (gratuito) |
| Viabilidade | DIFICIL |

**Alternativa de alto nivel (Base dos Dados / BigQuery):**
```
SELECT
  id_municipio,
  COUNT(CASE WHEN sexo = 2 THEN 1 END) AS mulheres_empregadas,
  COUNT(*) AS total_empregados,
  COUNT(CASE WHEN sexo = 2 THEN 1 END) * 100.0 / COUNT(*) AS pct_mulheres
FROM `basedosdados.br_me_rais.microdados_vinculos`
WHERE ano = 2022 AND sigla_uf = 'SC'
GROUP BY id_municipio
```

**Gotcha critico:**
- Microdados brutos: >350 GB — inviavel para download direto
- `sexo`: campo numerico na RAIS (1=Masculino, 2=Feminino no padrao RAIS)
- Acesso publico gratuito via PDET requer cadastro; alternativa: Base dos Dados (BigQuery)
- Base dos Dados tem coluna `id_municipio` (IBGE 7 digitos) e cobre ate 2022

**Indicadores para ODS 5:**
- % mulheres no mercado formal de trabalho por municipio
- Razao salario medio feminino / masculino (variavel `vl_remun_media_nom`)
- % mulheres em cargos de chefia (RAIS nao diferencia cargo, apenas CBO)

**Recomendacao:** Para MVP, usar tabelas ja agregadas do IBGE (CEMPRE ou PNAD) antes de implementar RAIS completo.

---

### 5.3 IBGE — Rendimento por Sexo (Censo 2022)

| Atributo | Valor |
|----------|-------|
| Orgao | IBGE |
| API Base | https://servicodados.ibge.gov.br/api/v3/agregados |
| Tabela | 9514 (populacao por sexo — Censo 2022) |
| Formato | REST JSON |
| Granularidade | Municipal (N6) |
| Frequencia | Decenal (Censo 2022 = dado mais recente) |
| Autenticacao | Nenhuma |
| Viabilidade | FACIL para populacao; MEDIO para rendimento |

**Nota sobre rendimento por sexo:** A tabela 9514 retorna populacao por sexo/idade — util para paridade demografica, mas nao para brecha salarial. Para rendimento, o Censo 2022 disponibiliza tabelas especificas via SIDRA (ainda mapeando IDs exatos em 2026-04).

**Indicador imediato disponivel (tabela 9514):**
- Razao de sexo por municipio (quantidade mulheres / homens)
- Percentual de mulheres na populacao

**Request valido (populacao total por municipio):**
```
GET https://servicodados.ibge.gov.br/api/v3/agregados/9514/periodos/2022/variaveis/all?localidades=N6[4204202]
```

---

## ODS 7 — Energia Limpa e Acessivel

### 7.1 ANEEL — Geracao Distribuida Solar por Municipio

| Atributo | Valor |
|----------|-------|
| Orgao | Agencia Nacional de Energia Eletrica (ANEEL) |
| Portal | https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida |
| Dataset ID | 5e0fafd2-21b9-4d5b-b622-40438d40aba2 |
| Formato | CSV download direto (sem API REST por municipio) |
| Granularidade | Por empreendimento — agregar por municipio |
| Frequencia | Diaria |
| Autenticacao | Nenhuma |
| Viabilidade | MEDIO |

**URLs de download confirmadas:**

CSV principal (todos os tipos de GD):
```
https://dadosabertos.aneel.gov.br/dataset/5e0fafd2-21b9-4d5b-b622-40438d40aba2/resource/b1bd71e7-d0ad-4214-9053-cbd58e9564a7/download/empreendimento-geracao-distribuida.csv
```

CSV especifico fotovoltaica:
```
https://dadosabertos.aneel.gov.br/dataset/5e0fafd2-21b9-4d5b-b622-40438d40aba2/resource/49fa9ca0-f609-4ae3-a6f7-b97bd0945a3a/download/empreendimento-gd-informacoes-tecnicas-fotovoltaica.csv
```

**Campos confirmados do CSV:**
- `CodMunicipioIbge` — codigo IBGE do municipio (formato a verificar: 6 ou 7 digitos)
- `NomMunicpio` — nome do municipio (com typo no campo: "Municipio" sem i)
- `DscFonteGeracao` — tipo de fonte: "UFV" (solar), "EOL" (eolica), "CGH" (hidro), etc.
- `MdaPotenciaInstaladaKW` — capacidade instalada em kW
- `DthAtualizaCadastralEmpreend` — data de atualizacao

**Tamanho do arquivo:** ~905 MB (arquivo principal). Recomendado usar apenas o CSV de fotovoltaica para ODS 7.

**Indicadores para ODS 7:**
- Capacidade instalada solar (kW) por municipio
- Numero de unidades geradoras solares por municipio
- Crescimento anual de instalacoes (comparar com anos anteriores)

**Gotcha critico:**
- Arquivo de 905 MB — nao baixar em cada request; processar mensalmente e cachear em PostgreSQL
- `CodMunicipioIbge` pode ter 6 digitos (sem verificador) — verificar e padronizar para 7
- Houve suspensao de atualizacoes set-nov/2025 durante migracao de sistemas — dados historicos ok, mas verificar gap
- CKAN API disponivel para metadados: `https://dadosabertos.aneel.gov.br/api/3/action/package_show?id=5e0fafd2-21b9-4d5b-b622-40438d40aba2`

---

### 7.2 IBGE Censo 2022 — Domicilios com Energia Eletrica

| Atributo | Valor |
|----------|-------|
| Orgao | IBGE |
| API Base | https://servicodados.ibge.gov.br/api/v3/agregados |
| Tabelas identificadas | 4967, 6737, 6738 |
| Formato | REST JSON |
| Granularidade | Municipal (N6) |
| Frequencia | Decenal (Censo 2022) |
| Autenticacao | Nenhuma |
| Viabilidade | FACIL (para Censo 2010); MEDIO (Censo 2022 com limitacoes) |

**Tabelas SIDRA identificadas:**
- `4967` — "Domicilios com energia eletrica, por situacao do domicilio"
- `6737` — "Domicilios e Moradores com energia eletrica, por fonte de energia eletrica"
- `6738` — "Domicilios e Moradores com energia eletrica proveniente de rede geral em tempo integral"

**Resultado do teste com tabela 6737 (Chapeco/SC 2022):**
A API retornou `".."` (dado nao disponivel) para 2022 no nivel municipal — possivelmente a divulgacao completa do Censo 2022 ainda esta sendo publicada em etapas pelo IBGE.

**Resultado do teste com tabela 4967 para Censo 2010:**
Retornou timeout — possivel indisponibilidade temporaria.

**Fallback recomendado:** Usar dados de acessos da distribuidora por municipio via ANEEL ou percentual nacional do Censo 2022 (99,8%) ate que os dados municipais completos sejam publicados.

**Indicadores para ODS 7:**
- % de domicilios com energia eletrica (acesso universal)
- % com energia de rede geral (vs. geradores/solar off-grid)

---

### 7.3 ANATEL — Banda Larga como Proxy Energetico (Conectividade)

Nota: ANATEL e fonte primaria para ODS 9, nao ODS 7. Documentada na secao 9.1.

---

## ODS 9 — Industria, Inovacao e Infraestrutura

### 9.1 ANATEL — Cobertura Banda Larga por Municipio

| Atributo | Valor |
|----------|-------|
| Orgao | Agencia Nacional de Telecomunicacoes (ANATEL) |
| Painel | https://informacoes.anatel.gov.br/paineis/meu-municipio |
| Portal dados.gov.br | https://dados.gov.br/dados/conjuntos-dados/acessos---banda-larga-fixa |
| Formato | CSV (download mensal) |
| Granularidade | Municipal — acessos e densidade por 100 hab |
| Frequencia | Mensal |
| Autenticacao | Nenhuma |
| Viabilidade | MEDIO |

**Datasets ANATEL identificados:**
- "Acessos — Banda Larga Fixa" — numero de acessos SCM por municipio/mes
- "Meu Municipio" — painel com multiplos indicadores telecom por municipio
- "Cobertura Movel" — percentual de area com 3G/4G por municipio
- "Antenas nos Municipios" — inventario de ERBs (estacoes radio base)

**Estrutura esperada do CSV banda larga fixa:**
- Coluna de municipio (nome ou codigo IBGE — a verificar)
- Coluna UF
- Numero de acessos ativos
- Densidade por 100 habitantes

**Gotcha critico:**
- O painel `informacoes.anatel.gov.br/paineis/` retornou 403 durante pesquisa
- A URL `dados.gov.br` requer JavaScript (retorna pagina vazia)
- Recomendado: acessar diretamente o endpoint CKAN do dados.gov.br
  ```
  https://dados.gov.br/api/3/action/package_show?id=acessos---banda-larga-fixa
  ```
- Alternativa confiavel: Base dos Dados (basedosdados.org) tem dataset ANATEL pre-tratado

**URL Base dos Dados (BigQuery) para banda larga:**
```
basedosdados.br_anatel_banda_larga_fixa
```
Colunas: `id_municipio` (IBGE 7 dig), `ano`, `mes`, `produto`, `acessos`

**Indicadores para ODS 9:**
- Acessos de banda larga fixa por 100 habitantes
- Cobertura 4G (% da populacao coberta)
- Evolucao anual de conectividade

---

### 9.2 IBGE CEMPRE — Empresas Ativas por Municipio

| Atributo | Valor |
|----------|-------|
| Orgao | IBGE |
| API Base | https://servicodados.ibge.gov.br/api/v3/agregados |
| Tabela principal | 9418 (empresas e pessoal ocupado por CNAE 2.0 — municipios) |
| Tabela historica | 993 (ate 2021) |
| Formato | REST JSON |
| Granularidade | Municipal (N6) |
| Frequencia | Anual (defasagem ~18 meses) |
| Autenticacao | Nenhuma |
| Viabilidade | FACIL |

**Request de exemplo validado:**
```
GET https://servicodados.ibge.gov.br/api/v3/agregados/9418/periodos/2022/variaveis/707?localidades=N6[4204202]
```

**Response confirmado (Chapeco/SC 2022):**
```json
{
  "id": "707",
  "variavel": "Pessoal ocupado total",
  "unidade": "Pessoas",
  "resultados": [{
    "series": [{
      "localidade": {"id": "4204202", "nome": "Chapeco (SC)"},
      "serie": {"2022": "153048"}
    }]
  }]
}
```

**Variaveis disponiveis na tabela 9418:**
- `707` — Pessoal ocupado total (Pessoas)
- `708` — Pessoal ocupado assalariado (Pessoas)
- `2283` — Empresas e organizacoes atuantes (Unidades) — **indicador principal**
- `6459` — Salarios e outras remuneracoes (Mil Reais)
- `6461` — Salario medio mensal (Salarios minimos)

**Classificacao CNAE:** A tabela aceita filtro por secao CNAE. Para total: `classificacao=12762[117897]` (Total).

**Indicadores para ODS 9:**
- Numero de empresas ativas por municipio
- Densidade empresarial (empresas por 1000 hab)
- Total de postos de trabalho formais
- Salario medio municipal

**Tabela 3421** — dados apenas para municipios com 50.000+ hab (mais detalhada por CNAE).

---

## Resumo de Viabilidade

| ODS | Fonte | Viabilidade | Tipo | Frequencia |
|-----|-------|-------------|------|------------|
| 2 | SISVAN (DATASUS) | MEDIO | Download ZIP anual | Anual |
| 2 | FNDE PNAE | MEDIO | CSV/Excel anual | Anual |
| 2 | IBGE SIDRA PAM (tab. 5457) | FACIL | REST JSON | Anual |
| 5 | TSE candidatos eleitos | MEDIO | CSV ZIP quadrienal | Quadrienal |
| 5 | RAIS microdados | DIFICIL | TXT 350GB | Anual |
| 5 | Base dos Dados RAIS (BigQuery) | MEDIO | SQL/API | Anual |
| 5 | IBGE Censo 2022 (populacao por sexo) | FACIL | REST JSON | Decenal |
| 7 | ANEEL GD Fotovoltaica | MEDIO | CSV download diario | Diaria |
| 7 | IBGE Censo 2022 (energia domicilios) | MEDIO | REST JSON | Decenal |
| 9 | ANATEL Banda Larga (Base dos Dados) | MEDIO | BigQuery/CSV | Mensal |
| 9 | IBGE CEMPRE (tab. 9418) | FACIL | REST JSON | Anual |

---

## Recomendacao de Implementacao por Prioridade

### Fase 1 — Implementar imediatamente (FACIL + REST)

1. **IBGE PAM tabela 5457** — Producao agricola para ODS 2
   - Mesmo padrao do coletor IBGE ja existente
   - Variaveis: 215 (valor), 216 (area), 214 (quantidade)

2. **IBGE CEMPRE tabela 9418** — Empresas para ODS 9
   - Mesmo padrao do coletor IBGE
   - Variavel 2283 (empresas atuantes) + 707 (pessoal ocupado)

3. **IBGE Censo 2022 tabela 9514** — Populacao por sexo para ODS 5
   - Indicador proxy de paridade demografica

### Fase 2 — Implementar no sprint seguinte (MEDIO)

4. **TSE candidatos eleitos** — Representacao feminina para ODS 5
   - Download unico do ZIP; processar CSV; cachear resultado por municipio
   - Dados validos ate 2028 (proximas eleicoes municipais)

5. **ANEEL GD Fotovoltaica** — Capacidade solar para ODS 7
   - Download mensal do CSV especifico (~50 MB)
   - Agregar por `CodMunicipioIbge`

6. **SISVAN** — Desnutricao infantil para ODS 2
   - Worker de ingestao anual (junho)
   - Importar para PostgreSQL e pre-agregar por municipio

### Fase 3 — Considerar para versao completa (DIFICIL / externo)

7. **ANATEL banda larga** — Via Base dos Dados (BigQuery)
   - Requer credencial Google Cloud gratuita
   - Alternativa: esperar publicacao CSV no dados.gov.br

8. **RAIS por sexo** — Via Base dos Dados (BigQuery)
   - 350 GB de microdados — usar apenas queries filtradas por UF

9. **FNDE PNAE** — Cobertura escolar para ODS 2
   - Portal instavel; monitorar disponibilidade

---

## Mapeamento ODS — Indicadores Consolidado

### ODS 2 — Indicadores identificados
```
ods2_desnutricao_infantil_pct     <- SISVAN: % criancas com magreza/magreza acentuada
ods2_producao_agricola_valor      <- PAM/5457 var.215: valor da producao (R$ mil)
ods2_area_agricola_ha             <- PAM/5457 var.216: area colhida (ha)
ods2_pnae_cobertura_pct           <- FNDE PNAE: % alunos atendidos
ods2_pnae_agri_familiar_pct       <- FNDE PNAE: % compras agricultura familiar
```

### ODS 5 — Indicadores identificados
```
ods5_vereadoras_eleitas_pct       <- TSE: % vereadoras / total vereadores
ods5_prefeita_eleita              <- TSE: boolean prefeita eleita (0/1)
ods5_mulheres_emprego_formal_pct  <- RAIS/Base dos Dados: % mulheres no formal
ods5_populacao_feminina_pct       <- IBGE Censo 2022: % mulheres na populacao
```

### ODS 7 — Indicadores identificados
```
ods7_solar_capacidade_kw          <- ANEEL GD: capacidade instalada solar (kW)
ods7_solar_unidades               <- ANEEL GD: numero de instalacoes solares
ods7_domicilios_energia_pct       <- IBGE Censo 2022: % domicilios com energia
```

### ODS 9 — Indicadores identificados
```
ods9_empresas_ativas              <- CEMPRE/9418: numero de empresas e organizacoes
ods9_densidade_empresarial        <- CEMPRE calculado: empresas / 1000 hab
ods9_pessoal_ocupado              <- CEMPRE/9418: total de postos de trabalho
ods9_banda_larga_acessos_100hab   <- ANATEL: acessos por 100 habitantes
ods9_cobertura_4g_pct             <- ANATEL: % populacao com cobertura 4G
```

---

*Pesquisa executada por: data-collector agent | 2026-04-01*
*Proxima acao: implementar coletores Fase 1 (IBGE PAM + CEMPRE) seguindo padrao /new-agent*
