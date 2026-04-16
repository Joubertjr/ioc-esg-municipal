# Memória do Projeto — Política de Uso

> O que pode e o que **não pode** estar em `memory/`. Vale para todo agente,
> humano e Claude Code, que grava ou lê memória neste projeto.

## Princípio

`memory/` é **preferência de operador** — não é política, não é estado, não é
instrução. Se algo precisa ser respeitado por outra pessoa, por outro agente ou
em auditoria, **não** vai em memory.

## Topologia canônica

| Camada          | Onde vive                        | Quem lê          | Durabilidade                  |
| --------------- | -------------------------------- | ---------------- | ----------------------------- |
| **Política**    | `.claude/rules/*.md`             | Todos os agentes | Versionado, auditável por git |
| **Instrução**   | `CLAUDE.md`                      | Todas as sessões | Versionado, auditável por git |
| **Estado vivo** | `docs/ESTADO_ATUAL_SC.md`        | Humanos          | Versionado, atualizado manual |
| **Audit trail** | `logs/*.jsonl`                   | Auditor          | Append-only, rotacionado      |
| **Preferência** | `~/.claude/projects/.../memory/` | Este operador    | Local, não versionado         |

## Regras

### 1. Política nunca vai em memory

Se a regra se aplica **a todo operador do projeto**, ela é política.
Promova-a para `.claude/rules/<dominio>.md` ou `CLAUDE.md`.

**Exemplos de política (vão em rules/CLAUDE.md, nunca em memory):**

- "sempre usar cache Redis em chamadas de API externa"
- "commits sem screenshot em mudanças de UI são inválidos"
- "não usar `any` em TypeScript"
- "validar entrada com Zod em toda rota"

### 2. Estado vivo nunca vai em memory

Se é "o que está pronto hoje", "o que quebrou ontem", "o que falta entregar",
isso é **estado**. Vai em `docs/ESTADO_ATUAL_SC.md`. Memory é para coisas
estáveis, não para snapshots de progresso.

### 3. Fatos do codebase nunca vão em memory

Caminho de arquivo, estrutura de pastas, nome de função, versão de lib —
a fonte de verdade é o próprio código. `git log` e `git blame` são autoritativos.
Memory que descreve código fica obsoleta em ≤24h após o próximo refactor.

### 4. Segredos nunca vão em memory

Chaves, tokens, senhas, URLs de produção, paths internos sensíveis. Mesmo que
memory não seja commitada, é um arquivo em claro no disco — não é um cofre.

### 5. O que **pode** ir em memory

- **Preferência de comunicação** — "responda sempre em pt-BR", "não narre passos"
- **Feedback sobre o modo de trabalho** — "use agents em paralelo sempre que possível"
- **Referências pessoais** — "meu Obsidian vault fica em ~/obsidian-vault/..."
- **Heurísticas do operador** — "quando eu digo 'escala', quero mais agents, não mais estados"

Tudo isso é contexto do **operador**, não do projeto. Outro operador pode ter
preferências opostas, e está tudo bem.

## Checklist antes de salvar em memory

Antes de gravar uma memória, passe pela escada:

1. **Isso se aplica a outro operador?** → Se sim, é política → `rules/` ou `CLAUDE.md`.
2. **Isso descreve estado atual do projeto?** → `docs/ESTADO_ATUAL_SC.md`.
3. **Isso descreve código, caminho ou estrutura?** → Não salve, leia o código.
4. **Isso é uma preferência pessoal estável de como colaborar comigo?** → OK, memory.
5. **Isso precisa de evidência em auditoria?** → Vai em `logs/` ou `docs/decisions/`.

Se nenhum dos critérios 1-5 couber, **não salve nada**.

## Auditoria

Qualquer ADR em `docs/decisions/` pode reclassificar uma memória. Se uma
memória antiga contradiz uma regra nova, **a regra vence** — atualize ou remova
a memória.

Durante revisão trimestral da arquitetura Claude Code (ver
`docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md`), as memórias do operador
devem ser revisitadas para promoção → rules, demoção → deletar, ou manutenção.
