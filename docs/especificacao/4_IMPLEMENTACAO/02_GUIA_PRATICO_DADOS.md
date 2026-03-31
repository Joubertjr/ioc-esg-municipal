# 📋 GUIA PRÁTICO: EXTRAIR SALDOS DE FPM NÃO UTILIZADOS - MUNICÍPIOS SC

## Visão Geral

Este guia fornece **3 métodos práticos** para extrair dados de saldos de FPM não utilizados de todos os 295 municípios de Santa Catarina. Cada método tem um nível de dificuldade e tempo diferentes.

---

## MÉTODO 1: Portal da Transparência (Mais Fácil - 2-3 horas)

### Passo 1: Acessar o Portal
1. Ir para: https://portaldatransparencia.gov.br/transferencias/consulta
2. Configurar filtros:
   - **Período:** 01/01/2024 a 31/12/2024
   - **Tipo de Transferência:** Constitucionais e Royalties
   - **Tipo de Favorecido:** Administração Pública Municipal
   - **UF:** Santa Catarina

### Passo 2: Baixar Dados
1. Clicar em "Exportar" (botão no canto superior direito)
2. Selecionar formato: **CSV**
3. Salvar arquivo como: `fpm_sc_2024_portal_transparencia.csv`

### Passo 3: Processar Dados (Excel ou Google Sheets)
1. Abrir o arquivo CSV no Excel ou Google Sheets
2. Criar colunas:
   - **Município**
   - **FPM Recebido (Total 2024)**
   - **Fonte:** Portal da Transparência

### Resultado
- ✅ Dados de **quanto cada município recebeu** em FPM
- ❌ NÃO mostra quanto foi **gasto** (apenas entrada)
- ⏱️ Tempo: 30 minutos

---

## MÉTODO 2: SICONFI (Mais Completo - 4-6 horas)

### Passo 1: Acessar SICONFI
1. Ir para: https://siconfi.tesouro.gov.br/
2. Clicar em **"Consultar Dados Gerenciais"**
3. Fazer login (se necessário) ou continuar como visitante

### Passo 2: Configurar Consulta
1. Selecionar:
   - **Ente:** Município
   - **Estado:** Santa Catarina
   - **Exercício:** 2024
   - **Tipo de Informação:** Matriz de Saldos Contábeis

### Passo 3: Extrair Dados por Município
**Opção A (Manual - Mais Lento):**
1. Para cada município de SC:
   - Digitar nome do município
   - Clicar em "Consultar"
   - Procurar pela conta: **1.1.1.1.01.04 - Fundo de Participação dos Municípios**
   - Anotar o saldo final (31/12/2024)

**Opção B (Automática - Mais Rápido):**
1. Clicar em "Exportar Dados"
2. Selecionar:
   - Estado: SC
   - Exercício: 2024
   - Formato: CSV ou Excel
3. Baixar arquivo consolidado

### Passo 4: Processar Dados
No Excel/Google Sheets, criar tabela:

| Código IBGE | Município | FPM Recebido | Saldo Final FPM | Taxa Execução |
|---|---|---|---|---|
| 4204202 | Florianópolis | R$ 50.000.000 | R$ 2.500.000 | 95% |
| 4202404 | Joinville | R$ 45.000.000 | R$ 1.800.000 | 96% |

**Fórmula para Taxa de Execução:**
```
= (FPM Recebido - Saldo Final) / FPM Recebido * 100
```

### Resultado
- ✅ Dados de **entrada e saída** de FPM
- ✅ Mostra **saldos não utilizados**
- ✅ Permite calcular **taxa de execução**
- ⏱️ Tempo: 2-3 horas (com exportação automática)

---

## MÉTODO 3: TCE-SC e-Sfinge (Mais Detalhado - 6-8 horas)

### Passo 1: Acessar Portal e-Sfinge
1. Ir para: https://manualesfinge.tcesc.tc.br/
2. Fazer login (credenciais do TCE-SC ou solicitar acesso público)

### Passo 2: Consultar Execução Orçamentária
1. Selecionar:
   - **Exercício:** 2024
   - **Tipo de Relatório:** Execução Orçamentária
   - **Período:** Anual (01/01 a 31/12/2024)

### Passo 3: Para Cada Município
1. Procurar por:
   - **Receitas Realizadas:** FPM
   - **Despesas Empenhadas:** Total
   - **Saldo em Caixa:** Final do período

### Passo 4: Calcular Índices
Criar tabela com:

| Município | FPM Recebido | Despesas Realizadas | Saldo Não Utilizado | % Execução |
|---|---|---|---|---|
| Florianópolis | R$ 50M | R$ 48M | R$ 2M | 96% |

---

## MÉTODO 4: Combinado (Recomendado - 3-4 horas)

Este é o método mais eficiente, combinando o melhor de cada fonte.

### Passo 1: Baixar Dados do Portal da Transparência
- Arquivo: `fpm_sc_2024_portal_transparencia.csv`
- Contém: Quanto cada município recebeu

### Passo 2: Baixar Dados do SICONFI
- Arquivo: `siconfi_sc_2024_saldos.csv`
- Contém: Saldos finais de FPM por município

### Passo 3: Fazer Merge no Excel/Google Sheets
```
Fórmula VLOOKUP:
=VLOOKUP(A2, siconfi_sc_2024_saldos.csv!A:D, 3, FALSE)
```

### Passo 4: Calcular Métricas
```
Saldo Não Utilizado = FPM Recebido - (FPM Recebido - Saldo Final)
Taxa Execução = (FPM Recebido - Saldo Final) / FPM Recebido * 100
```

### Passo 5: Filtrar Outliers
Identificar municípios com:
- Taxa de execução < 80% (subutilização)
- Saldo não utilizado > R$ 500.000
- Contas rejeitadas pelo TCE-SC (cruzar com lista de 14 municípios)

---

## RESULTADO FINAL: TABELA CONSOLIDADA

Após seguir qualquer método, você terá uma tabela assim:

| Ranking | Município | Pop. | FPM Recebido | Saldo Não Utilizado | % Execução | Risco |
|---|---|---|---|---|---|---|
| 1 | Município A | 50k | R$ 5.000.000 | R$ 1.200.000 | 76% | 🔴 Alto |
| 2 | Município B | 30k | R$ 3.000.000 | R$ 900.000 | 70% | 🔴 Alto |
| 3 | Município C | 20k | R$ 2.000.000 | R$ 400.000 | 80% | 🟡 Médio |
| ... | ... | ... | ... | ... | ... | ... |

---

## DICAS PRÁTICAS

### 1. Usar Google Sheets (Mais Fácil que Excel)
- Copiar dados direto do portal
- Usar VLOOKUP nativo
- Compartilhar com equipe em tempo real

### 2. Automatizar com Python (Se Souber Programar)
```python
import pandas as pd

# Ler dados
fpm = pd.read_csv('fpm_sc_2024_portal_transparencia.csv')
siconfi = pd.read_csv('siconfi_sc_2024_saldos.csv')

# Merge
resultado = pd.merge(fpm, siconfi, on='codigo_ibge')

# Calcular
resultado['taxa_execucao'] = (resultado['fpm_recebido'] - resultado['saldo_final']) / resultado['fpm_recebido'] * 100

# Filtrar
subutilizados = resultado[resultado['taxa_execucao'] < 80]

# Salvar
subutilizados.to_csv('municipios_subutilizacao_fpm.csv', index=False)
```

### 3. Validar Dados
- Cruzar com lista do TCE-SC (14 municípios com contas rejeitadas)
- Verificar se há bloqueios de FPM (lista do Tesouro)
- Confirmar com secretários municipais (amostra de 5-10)

---

## CRONOGRAMA SUGERIDO

**Semana 1:**
- Dia 1-2: Baixar dados do Portal da Transparência
- Dia 3-4: Baixar dados do SICONFI
- Dia 5: Consolidar em uma única tabela

**Semana 2:**
- Dia 1-2: Calcular métricas (taxa execução, saldos)
- Dia 3-4: Filtrar outliers e validar
- Dia 5: Criar apresentação com resultados

**Semana 3:**
- Dia 1-2: Entrevistar 5-10 prefeitos para validar
- Dia 3-5: Refinar análise e criar relatório final

---

## RESULTADO ESPERADO

Ao final, você terá:

✅ **Lista de 30-50 municípios** com subutilização de FPM
✅ **Ranking de risco** (quem mais deixou dinheiro sem usar)
✅ **Dados validados** (cruzados com TCE-SC)
✅ **Oportunidade de venda** (pitch pronto para cada prefeito)

---

## PRÓXIMOS PASSOS

1. **Hoje:** Escolher método (recomendo Método 4 - Combinado)
2. **Semana 1:** Executar coleta de dados
3. **Semana 2:** Consolidar e validar
4. **Semana 3:** Usar dados para fazer vendas do IOC ESG Municipal

---

## CONTATO PARA DÚVIDAS

Se tiver dúvidas ao executar qualquer passo:
1. Verificar se está na URL correta
2. Tentar em navegador diferente (Chrome, Firefox)
3. Limpar cache do navegador
4. Contatar suporte do Tesouro Nacional (https://www.gov.br/tesouronacional/pt-br/)
