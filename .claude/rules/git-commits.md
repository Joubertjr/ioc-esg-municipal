---
scope: global
applies_to: all
---

# Git Commits — Convenções e Fluxo

> Aplicar em todo commit neste repositório, independente do agente ou humano que commita.

## Regras

### Formato obrigatório

```
<tipo>(<escopo>): <descrição imperativa em minúsculas>

- detalhe do que foi feito (opcional)
- motivo da decisão técnica (opcional)
```

### Tipos permitidos

| Tipo       | Quando usar                                              |
| ---------- | -------------------------------------------------------- |
| `feat`     | Nova funcionalidade visível ao usuário ou sistema        |
| `fix`      | Correção de bug                                          |
| `refactor` | Mudança interna sem alterar comportamento externo        |
| `test`     | Adição ou correção de testes                             |
| `docs`     | Documentação, ADRs, README                               |
| `chore`    | Manutenção: deps, config, scripts                        |
| `perf`     | Melhoria de performance mensurável                       |
| `ci`       | Mudanças em GitHub Actions, Docker CI, scripts de deploy |

### Escopos do projeto

`ibge` | `siconfi` | `datasus` | `inep` | `snis` | `inpe` | `pncp` | `ods` | `simulator` | `dashboard` | `reports` | `benchmarks` | `auth` | `db` | `infra` | `shared`

### O que nunca fazer

- Nunca: `fix bug`, `update`, `changes`, `wip`, `temp`, `misc`
- Nunca misturar refatoração com nova feature no mesmo commit
- Nunca commitar arquivos de credenciais (`.env`, chaves, senhas)
- Nunca commitar arquivos de páginas ou componentes UI sem evidências visuais em `docs/evidence/`

### Fluxo após commit

- **Sempre** executar `git push origin main` imediatamente após cada commit
- Commits de checkpoint antes de mudanças destrutivas: `git add -A && git commit -m "checkpoint: antes de <feature>"`
- Commits atômicos: uma responsabilidade por commit

### Exemplos corretos

```
feat(siconfi): adiciona endpoint de FPM mensal consolidado
fix(ibge): corrige parse de código de município com dígito verificador
test(ods): cobre calculator ODS-3 com fixtures de dados reais de saúde
docs(db): ADR-010 — decisão de usar CUID2 em vez de UUID
chore(infra): atualiza versão do node para 18.20 no Dockerfile
```
