# state/

Reservado para **machine-readable projections** da arquitetura Claude Code do IOC ESG Municipal (ex.: `runtime-state.json`, `adoption-status.json`).

## Status atual

**Vazio por desenho.** Nenhum consumidor automatizado existe hoje.

## Quando usar

Criar arquivo aqui **apenas** quando houver:

1. Consumidor automatizado identificado (script de CI, dashboard, agente de monitoring).
2. ADR em `docs/decisions/` justificando a projeção.
3. Mecanismo de atualização claro (quem escreve, quando, com que frequência).

Sem esses três itens, a projeção permanece como projection humana em `docs/ESTADO_ATUAL_SC.md`.

## Por que não deletar o diretório

Referenciado em:

- `docs/architecture/CLAUDE_CODE_ADOCAO_IOC_ESG.md` §2.2 (como "NÃO ADOTAR AGORA")
- `docs/architecture/PHYSICAL_TOPOLOGY.md` §1 e §2.6

Remover agora exigiria editar os dois documentos e reintroduzir no futuro. Custo de manter = este README; custo de remover+reintroduzir = duas edições depois.

## Referências

- `docs/architecture/PHYSICAL_TOPOLOGY.md` — fronteira entre source of truth, estado, trilha, evidência, rascunho
- `docs/ESTADO_ATUAL_SC.md` — única projeção humana de estado atualmente ativa
