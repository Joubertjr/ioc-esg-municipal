---
name: Salvar evidências de testes no projeto
description: Sempre commitar screenshots, logs e scripts de teste em docs/evidence/ — nunca deixar só em /tmp/
type: feedback
---

Sempre salvar evidências de testes (screenshots, scripts de captura, logs) dentro do repositório em `docs/evidence/<feature>/` e commitar + push junto com a feature.

**Why:** O usuário quer rastreabilidade completa — evidências temporárias em /tmp/ não servem pois se perdem entre sessões.

**How to apply:** Após qualquer validação visual ou teste relevante, copiar artefatos para `docs/evidence/`, criar VALIDATION.md com análise, e commitar antes de reportar conclusão.
