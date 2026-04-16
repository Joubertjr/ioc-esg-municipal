---
scope: global
applies_to: frontend
---

# Visual QA — Regras de Evidências Visuais

> Aplicar em todo commit que modifica componentes, páginas ou estilos no frontend.

## Regras

### Commit inválido sem screenshot

- **Nenhum commit** que altere arquivos em `frontend/pages/` ou `frontend/components/` é válido sem evidências visuais
- A evidência deve existir em `docs/evidence/` antes do commit — não após
- Agentes de frontend devem capturar screenshots como parte do fluxo de implementação, não como etapa separada

### Estrutura de evidências

- Diretório: `docs/evidence/YYYY-MM-DD-<feature>/`
- Arquivos obrigatórios por mudança de UI:
  - `desktop-light.png` — viewport 1440×900, tema claro
  - `desktop-dark.png` — viewport 1440×900, tema escuro
  - `mobile-light.png` — viewport 390×844, tema claro (iPhone 14)
- Arquivos opcionais: `tablet.png`, `interaction-state.png` (hover, loading, erro)

### Dark mode obrigatório

- Todo componente novo deve funcionar corretamente no dark mode do Tailwind (`dark:` classes)
- Screenshot de dark mode é obrigatório — não é opcional mesmo que o componente "pareça funcionar"
- Testar com `prefers-color-scheme: dark` e com toggle manual do tema

### Checklist Visual QA (antes de commitar UI)

- [ ] Não há texto truncado inesperadamente
- [ ] Não há overflow horizontal em nenhum viewport
- [ ] Skeleton loaders visíveis durante carregamento (não tela em branco)
- [ ] Estados de erro exibem mensagem útil ao usuário
- [ ] Contraste de texto adequado em light e dark mode
- [ ] Componente funciona sem dados (estado vazio)
- [ ] Responsividade: mobile 390px, tablet 768px, desktop 1440px

### Skill de captura

- Usar `/visual-qa <feature>` para ciclo automatizado: screenshots + auditoria + staging atômico
- Usar `/screenshot <feature>` para captura rápida sem auditoria completa
- Evidências geradas por Playwright headless — nunca capturas manuais de tela

### Referência

- Skill operacional: `.claude/skills/visual-qa.md` (ciclo screenshot + auditoria + staging)
- Agente auditor: `.claude/agents/visual-qa-auditor.md` (checklist dos 11 critérios)
