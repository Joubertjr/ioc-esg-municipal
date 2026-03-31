# Comando: /decisions

Lista e/ou registra decisões técnicas tomadas nesta sessão em docs/DECISIONS.md.

## Uso sem argumentos: `/decisions`
Lista as últimas 5 decisões registradas em docs/DECISIONS.md

## Uso com argumento: `/decisions <título da decisão>`
Registra uma nova decisão. Claude irá perguntar:
- Contexto: por que foi necessário decidir?
- Decisão: o que foi escolhido?
- Alternativas rejeitadas: o que foi considerado?
- Consequências: impacto esperado?

## Formato de registro em docs/DECISIONS.md:

```markdown
## [DATA] [TÍTULO]
**Contexto**: [por que precisávamos decidir isso]
**Decisão**: [o que foi decidido e como será implementado]
**Alternativas rejeitadas**:
- [alternativa 1]: [motivo da rejeição]
- [alternativa 2]: [motivo da rejeição]
**Consequências**: [impacto no projeto, trade-offs aceitos]
---
```

## Exemplo:
`/decisions escolha do banco de dados`
