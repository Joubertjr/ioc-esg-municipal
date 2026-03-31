# Comando: /state

Atualiza docs/PROJECT_STATE.md com o estado atual do projeto.

## Execute:

1. Verifique o estado do git:
```bash
git log --oneline -10
git branch
git status
```

2. Leia os arquivos principais do projeto para entender o que está implementado

3. Escreva em `docs/PROJECT_STATE.md`:

```markdown
# Estado do Projeto
Atualizado: [data e hora atual]

## Concluído e funcionando
[lista do que está implementado e testado]

## Em progresso
[o que estava sendo feito]
Branch atual: [nome da branch]
Último commit: [hash e mensagem]

## Próximos passos
1. [primeiro passo concreto]
2. [segundo passo]
3. [terceiro passo]

## Contexto crítico para próxima sessão
[Informações não óbvias: decisões recentes, bugs conhecidos, coisas para não esquecer]

## Comandos úteis para retomar
```bash
[comandos para rodar o projeto, testar, etc]
```
```

4. Confirme ao usuário que o arquivo foi atualizado.
