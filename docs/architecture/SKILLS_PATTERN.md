# Padrão Canônico de Skills — IOC ESG Municipal

> **Documento único, versionado.** Define o contrato de um arquivo em `.claude/skills/`.
> Toda skill nova **deve** seguir este padrão. Skills existentes são reformadas oportunisticamente (não em rewrites massivos).
> Revisão: quando uma nova skill for criada ou um padrão de uso mudar.

---

## 0. O que é uma Skill (vs Command vs Agent)

| Artefato    | Onde vive           | Natureza                                                 | Invocação                        |
| ----------- | ------------------- | -------------------------------------------------------- | -------------------------------- |
| **Skill**   | `.claude/skills/`   | Workflow reutilizável, multi-passos, com saída auditável | `Skill` tool — `skill: "<nome>"` |
| **Command** | `.claude/commands/` | Comando de slash, orienta uma conversa/ação curta        | `/<nome>` no prompt              |
| **Agent**   | `.claude/agents/`   | Especialista com contexto isolado e tools próprias       | `Agent` tool com `subagent_type` |

Regra de escolha:

- **Passos repetíveis com artefato concreto** (screenshots, relatório, PR) → **Skill**
- **Trigger curto que orienta o Claude principal** → **Command** (pode delegar para skill/agent)
- **Contexto grande ou persona distinta** → **Agent**

Se a decisão é ambígua: prefira Skill se há artefato auditável; prefira Command se é só um atalho de orientação.

---

## 1. Frontmatter canônico

```yaml
---
name: <kebab-case> # obrigatório; == nome do arquivo sem .md
description: <frase única, 120-180 chars> # obrigatório; usada pelo Claude para decidir invocação
allowed-tools: <CSV de tools> # obrigatório; formato CSV, sem array YAML
model: <ID completo> # opcional — default: herda
effort: low | medium | high # opcional — default: medium
---
```

**Regras de frontmatter:**

- `name` **sempre** em kebab-case, idêntico ao filename sem extensão.
- `description` em uma linha — primeiro o **quando usar**, depois o **o que entrega**. Evite jargão interno.
- `allowed-tools` em CSV (ex: `Read, Write, Bash(git *), Agent`), **não** em array YAML. Use padrões do Claude Code (`Bash(*)`, `Bash(git *)`, etc.).
- `model`: use o ID completo (`claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`). Evite shorthand (`sonnet`, `haiku`).
- `effort`: declare `high` quando a skill exigir raciocínio arquitetural ou múltiplas validações. Declare `low` para operações rápidas. Omita se estiver em dúvida.

**Escolha de modelo** (heurística — pode ser ignorada com justificativa inline):

| Natureza da skill                             | Modelo                      |
| --------------------------------------------- | --------------------------- |
| Planejamento, arquitetura, pesquisa profunda  | `claude-opus-4-6`           |
| Implementação guiada, análise estruturada, QA | `claude-sonnet-4-6`         |
| Operações rápidas, health checks, utilities   | `claude-haiku-4-5-20251001` |

---

## 2. Estrutura do corpo

Toda skill segue sete seções, nessa ordem:

```markdown
# Skill: <Título Humano>

## Propósito

<Uma frase. O que essa skill faz, sem rodeios.>

## Quando usar

- <Gatilho 1 — situação concreta>
- <Gatilho 2>

## Quando NÃO usar

- <Anti-gatilho 1 — caso parecido mas fora de escopo>
- <Anti-gatilho 2>

## Pré-requisitos

- <Estado do repo, serviços rodando, variáveis de ambiente, etc.>
- <Artefatos que precisam existir antes>

## Passos obrigatórios

1. <Passo com comando/ferramenta explícita>
2. <…>

## Critérios de aceite

- [ ] <Evidência 1 que o artefato final é válido>
- [ ] <Evidência 2>

## Artefatos gerados

- `<path/ou/padrão>` — <o que é e onde vai parar>
```

**Por que essas 7 seções:**

- **Propósito + Quando usar + Quando NÃO usar** — evita invocação errada e overlap entre skills parecidas.
- **Pré-requisitos** — falha cedo com mensagem útil, não no meio do fluxo.
- **Passos obrigatórios** — torna a skill reproduzível por outro agente (ou pelo humano).
- **Critérios de aceite** — substitui "parece que funcionou" por check binário.
- **Artefatos gerados** — deixa explícito o que fica depois da skill rodar (screenshot, report, commit staged).

Nenhuma seção pode ser omitida. Se não se aplica, diga "N/A" e o motivo em uma linha.

---

## 3. Convenções de nome

- Nome da skill == nome do arquivo (`kebab-case`, sem `skill-` ou `/` prefixos).
- Comando slash correspondente (quando existir) deve ter o mesmo nome.
- Variantes (ex: `visual-qa` com e sem interactive): passe como argumento, não crie skill separada.

---

## 4. Argumentos

Skills que aceitam argumento declaram na primeira linha após `#` título:

```markdown
## Argumento: `/<skill-name> <arg-obrigatorio> [--flag-opcional <val>]`
```

Referencie `$ARGUMENTS` no corpo quando o argumento é posicional — Claude Code substitui em tempo de execução.

---

## 5. Referências cruzadas

- **Política que a skill enforça** → cite `.claude/rules/<dominio>.md` diretamente (não duplique o conteúdo).
- **Framework ou metodologia** → cite documento em `docs/` ou ADR em `docs/decisions/`.
- **Nunca** cite paths fora do repo ativo (ex: diretórios deletados, pastas `@transicao/`). Auditável por `grep` no pre-commit.

---

## 6. Anti-padrões (não fazer)

- **Não** escrever a política dentro da skill — referencie a regra e mantenha a política em `.claude/rules/`.
- **Não** usar `tools:` em formato YAML array (legado) — use `allowed-tools:` CSV.
- **Não** declarar todos os `Bash(*)` se a skill só precisa de `Bash(git *)` — princípio de mínimo privilégio.
- **Não** duplicar skills para variações pequenas — use argumentos.
- **Não** deixar skill sem `Critérios de aceite` — torna impossível auditar se rodou bem.

---

## 7. Checklist para revisar uma skill existente

- [ ] Frontmatter tem `name`, `description`, `allowed-tools` (CSV), `model` (ID completo)
- [ ] Sete seções do corpo presentes e não-vazias
- [ ] Nenhuma referência quebrada (grep `@transicao`, paths deletados)
- [ ] Política não duplicada — apenas referência a `.claude/rules/`
- [ ] Nome do arquivo == `name` no frontmatter
- [ ] Tools listadas são **as mínimas** para o fluxo

---

## 8. Histórico

- **2026-04-16** — criado no bundle P1. Estabelece contrato para as 15 skills existentes e futuras.
