# GOTCHAS — IOC ESG Municipal
> Atualizar sempre que encontrar novo problema. Injetado automaticamente no início de cada sessão.

## APIs Governamentais

**IBGE × SICONFI — código diferente**
IBGE usa 7 dígitos com verificador (4204202). SICONFI usa 6 sem verificador (420420).
Sempre converter: `ibgeCode.slice(0, 6)` antes de chamar SICONFI.

**FPM em 3 parcelas por mês**
FPM é pago dias 10, 20, 30. Para valor mensal total: some as 3 parcelas.
API SICONFI retorna por decêndio — consolide antes de exibir.

**DATASUS instável**
Timeout de 30s, retry 3x com backoff (1s, 2s, 4s). Cache 12h obrigatório.
Se indisponível, retorne último valor em cache com flag `stale: true`.

**IDEB é bienal (anos pares)**
INEP não tem API REST — download de Excel do portal.
Para anos ímpares: interpole linearmente entre o anterior e o seguinte.
Municípios com <10 alunos na amostra: retornar `null`, nunca `0`.

**SNIS — 18 meses de atraso**
Dados de 2023 só disponíveis em meados de 2025.
Sempre exibir o ano de referência dos dados, não o ano atual.

**Municípios pequenos (<5k hab)**
Mortalidade infantil <3 óbitos é suprimida por privacidade no DATASUS.
Retornar `null` com `suppressed: true`, não confundir com zero óbitos.

## TypeScript

**Nunca confie no formato de APIs externas**
Valide com Zod ANTES de processar. Governamentais mudam schema sem aviso.
```typescript
// Errado:
const data = response.data as IBGEResponse
// Correto:
const data = IBGEResponseSchema.parse(response.data)
```

**Valores financeiros — use Decimal.js**
`number` em JavaScript perde precisão acima de 15 dígitos.
FPM pode chegar a R$100M+. Use `new Decimal(value)` para cálculos.

## Banco de dados

**Migrations — nunca editar manualmente**
Prisma gera SQL das migrations. Se precisar rollback, crie nova migration reversa.

**Score zero vs sem dados**
Score ODS `0` é crítico mas válido. `null` significa sem dados disponíveis.
Sempre retornar `{ score: number | null, dataAvailable: boolean }`.

## Domínio

**Benchmarking — compare municípios similares**
Não compare Florianópolis (587k hab) com municípios pequenos.
Use faixa ±30% de população para benchmarks justos.

**Simulação ≠ previsão**
O simulador gera estimativas baseadas em dados históricos, não certezas.
UI deve sempre exibir: "Estimativa baseada em dados históricos de [ano]".
