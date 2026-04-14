# Smoke Test Final SC — 2026-04-14

**Veredicto: GO**

| Métrica       | Valor                 |
| ------------- | --------------------- |
| Total testes  | 21                    |
| Passed        | 21                    |
| Failed        | 0                     |
| Duracão total | 676.4s                |
| Base URL      | http://localhost:3000 |

## Resultados

| #   | Teste                       | Status | Detalhe                                     | Tempo    |
| --- | --------------------------- | ------ | ------------------------------------------- | -------- |
| 1   | health                      | PASS   | HTTP 200                                    | 59ms     |
| 2   | login                       | PASS   | role=admin                                  | 342ms    |
| 3   | 295 municipalities          | PASS   | total=295                                   | 46ms     |
| 4   | ods/4205407                 | PASS   | score=75 geometric=null src=database ods=17 | 30ms     |
| 5   | peers/4205407               | PASS   | count=5 self=false                          | 4ms      |
| 6   | history/4205407 odsNumber=0 | PASS   | entries=2 allOds0=true hasScore=true        | 23ms     |
| 7   | ods/4209102                 | PASS   | score=89 geometric=89 src=database ods=17   | 14ms     |
| 8   | peers/4209102               | PASS   | count=5 self=false                          | 3ms      |
| 9   | ods/4209300                 | PASS   | score=85 geometric=85 src=database ods=17   | 13ms     |
| 10  | peers/4209300               | PASS   | count=5 self=false                          | 4ms      |
| 11  | ods/4202453                 | PASS   | score=53 geometric=53 src=database ods=17   | 15ms     |
| 12  | peers/4202453               | PASS   | count=5 self=false                          | 2ms      |
| 13  | ods/4204202                 | PASS   | score=81 geometric=81 src=database ods=17   | 10ms     |
| 14  | peers/4204202               | PASS   | count=5 self=false                          | 3ms      |
| 15  | benchmark count             | PASS   | count=10                                    | 21ms     |
| 16  | benchmark names 10/10       | PASS   | all match                                   | 27ms     |
| 17  | fetch all codes             | PASS   | got=295                                     | 7ms      |
| 18  | benchmark 295 response      | PASS   | HTTP 200 count=295                          | 529ms    |
| 19  | 295 globalScore coverage    | PASS   | withScore=295/295 missing=0                 | 529ms    |
| 20  | peers 295 coverage          | PASS   | pass=295 fail=0 failCodes=                  | 674698ms |
| 21  | ingestion status            | PASS   | runs=10 completed=10 scheduled=true         | 38ms     |
