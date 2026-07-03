# Release Checklist — IOC ESG Municipal

Antes de declarar qualquer release como pronta para produção, TODOS os itens abaixo devem ser verificados.

## Fitness Functions (obrigatórias)

- [ ] `bash quality/fitness-functions/typecheck.sh` — PASS
- [ ] `bash quality/fitness-functions/no-circular-deps.sh` — PASS
- [ ] `bash quality/fitness-functions/no-secrets.sh` — PASS
- [ ] `bash quality/fitness-functions/docker-build.sh` — PASS
- [ ] `bash quality/fitness-functions/login-smoke.sh` — PASS

## Testes

- [ ] `pnpm test` — todos passando (unitários + integração)
- [ ] Novos testes escritos para nova funcionalidade
- [ ] Nenhum teste flaky introduzido

## Segurança

- [ ] Nenhuma credencial hardcoded
- [ ] `.env` não rastreado pelo git
- [ ] `pnpm audit` sem vulnerabilidades críticas

## Docker e Infraestrutura

- [ ] `docker build` concluído com sucesso
- [ ] Stack de produção sobe sem erros
- [ ] Login funciona end-to-end no browser
- [ ] Variáveis de ambiente documentadas no compose

## Dados

- [ ] 295 municípios SC carregam no dashboard
- [ ] 17 ODS com scores calculados para Florianópolis
- [ ] Coletores com dados atualizados (verificar `__meta.referenceYear`)

## Observabilidade

- [ ] Prometheus coletando métricas
- [ ] Grafana dashboards acessíveis
- [ ] Health endpoint respondendo

## Documentação

- [ ] `docs/ESTADO_ATUAL_SC.md` atualizado
- [ ] Commits seguem convenção `tipo(escopo): descrição`
