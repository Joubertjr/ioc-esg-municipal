---
scope: global
applies_to: all
---

# TypeScript — Regras de Qualidade

> Aplicar em todo arquivo `.ts` ou `.tsx` do projeto: backend, frontend e shared.

## Regras

### Configuração

- `strict: true` em todos os `tsconfig.json` — nunca desabilitar flags de strict
- `moduleResolution: NodeNext` no backend exige imports com extensão `.js` em paths relativos (ex: `import { foo } from './foo.js'`)

### Tipagem

- Zero `any` — se precisar de tipo dinâmico, use `unknown` + type guard explícito
- Prefira `interface` para domínio (Municipio, ODS, Indicador, Simulacao) e `type` para unions/utilitários
- Nunca usar `as` para silenciar erro — corrija a tipagem na origem
- Exports de tipos em arquivos dedicados em `shared/types/`

### Validação de I/O externo

- Toda resposta de API externa (IBGE, SICONFI, DATASUS, etc.) **deve** ser validada com Zod antes de ser utilizada
- Schemas Zod ficam em `backend/agents/<api>/schema.ts`
- Em caso de falha de parse, logar o erro com Winston e lançar exceção tipada — nunca silenciar

### Valores financeiros

- Usar `Decimal.js` para **todos** os valores de FPM, receitas, despesas e simulações
- Nunca usar `number` nativo para valores monetários — erros de ponto flutuante afetam cálculos de políticas públicas
- Exportar como `string` no JSON da API (`.toFixed(2)`) para evitar perda de precisão

### Imports

- Barrel exports (`index.ts`) apenas para `shared/types/` e `shared/constants/`
- Evitar imports circulares — use `madge` para detectar se suspeitar
