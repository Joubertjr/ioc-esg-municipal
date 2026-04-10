# Comando: /verify-fix

Verificacao dirigida de um achado especifico apos fix manual.

## Execute:

Use o agente `fix-verifier` para verificar o achado indicado em $ARGUMENTS.

O fix-verifier deve:

1. Localizar o achado no audit report mais recente
2. Verificar se os arquivos indicados foram modificados (git diff)
3. Rodar tsc, vitest e grep especificos para o achado
4. Reportar PASS/PARTIAL/FAIL

## Argumentos:

- `/verify-fix C1` — verifica achado C1
- `/verify-fix C1 C2 W3` — verifica multiplos achados
- `/verify-fix all` — verifica todos os achados do ultimo dispatch
