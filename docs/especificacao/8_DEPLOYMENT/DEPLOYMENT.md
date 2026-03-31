# GUIA DE DEPLOYMENT - IOC ESG MUNICIPAL

## Ambiente de Desenvolvimento

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- Git

### Iniciar Ambiente Local

```bash
# 1. Clonar repositório
git clone seu-repo
cd IOC_ESG_MUNICIPAL_PROJETO

# 2. Copiar variáveis de ambiente
cp 6_CODIGO/config/env.example .env

# 3. Iniciar containers
docker-compose up -d

# 4. Executar migrations
npm run db:migrate

# 5. Seed de dados (opcional)
npm run db:seed

# 6. Acessar aplicação
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
# Adminer: http://localhost:8080
# Redis Commander: http://localhost:8081
```

### Parar Ambiente Local

```bash
docker-compose down
```

---

## Ambiente de Staging

### Pré-requisitos
- AWS Account (ou outro provedor)
- Terraform (opcional)
- Kubectl (para Kubernetes)

### Deploy com Docker

```bash
# 1. Build da imagem
docker build -t ioc-esg-municipal:latest .

# 2. Tag para registry
docker tag ioc-esg-municipal:latest seu-registry/ioc-esg-municipal:latest

# 3. Push para registry
docker push seu-registry/ioc-esg-municipal:latest

# 4. Deploy em servidor
ssh seu-servidor
docker pull seu-registry/ioc-esg-municipal:latest
docker run -d \
  --name ioc-esg \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  seu-registry/ioc-esg-municipal:latest
```

### Deploy com Kubernetes

```bash
# 1. Criar namespace
kubectl create namespace ioc-esg

# 2. Criar secrets
kubectl create secret generic ioc-secrets \
  --from-literal=DATABASE_URL=postgresql://... \
  --from-literal=REDIS_URL=redis://... \
  -n ioc-esg

# 3. Aplicar manifests
kubectl apply -f 8_DEPLOYMENT/k8s/ -n ioc-esg

# 4. Verificar status
kubectl get pods -n ioc-esg
kubectl get svc -n ioc-esg
```

---

## Ambiente de Produção

### Checklist Pré-Produção

- [ ] SSL/TLS configurado
- [ ] Backup automático de banco de dados
- [ ] Monitoramento ativo
- [ ] Logs centralizados
- [ ] Rate limiting configurado
- [ ] CORS configurado corretamente
- [ ] Variáveis de ambiente seguras
- [ ] Testes de carga executados
- [ ] Plano de disaster recovery
- [ ] Documentação atualizada

### Deploy em Produção

```bash
# 1. Executar testes
npm run test

# 2. Build otimizado
npm run build

# 3. Deploy (exemplo com AWS ECS)
aws ecs update-service \
  --cluster ioc-esg-prod \
  --service ioc-backend \
  --force-new-deployment

# 4. Verificar health
curl https://api.ioc-esg.com.br/health
```

### Monitoramento

```bash
# Logs
docker logs -f ioc-esg

# Métricas
curl http://localhost:3000/metrics

# Health check
curl http://localhost:3000/health
```

---

## CI/CD com GitHub Actions

### Arquivo: .github/workflows/deploy.yml

```yaml
name: Deploy IOC ESG

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: ${{ secrets.REGISTRY }}
          username: ${{ secrets.REGISTRY_USER }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: ${{ secrets.REGISTRY }}/ioc-esg-municipal:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Seu script de deploy aqui
          echo "Deploying..."
```

---

## Backup e Recuperação

### Backup Automático

```bash
# Backup diário do banco de dados
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +%Y%m%d).sql.gz

# Backup para S3
0 3 * * * aws s3 cp /backups/ s3://seu-bucket/backups/ --recursive
```

### Recuperação

```bash
# Restaurar banco de dados
gunzip < /backups/db-20240101.sql.gz | psql $DATABASE_URL
```

---

## Troubleshooting

### Problema: Banco de dados não conecta

```bash
# Verificar status do container
docker ps | grep postgres

# Verificar logs
docker logs ioc_postgres

# Reconectar
docker-compose restart postgres
```

### Problema: Memória insuficiente

```bash
# Aumentar limites no docker-compose.yml
services:
  backend:
    mem_limit: 2g
    memswap_limit: 2g
```

### Problema: Porta já em uso

```bash
# Encontrar processo usando porta
lsof -i :3000

# Matar processo
kill -9 <PID>
```

---

## Escalabilidade

### Horizontal Scaling

```bash
# Com Docker Swarm
docker swarm init
docker service create --replicas 3 ioc-esg-municipal

# Com Kubernetes
kubectl scale deployment ioc-backend --replicas=3
```

### Load Balancing

```nginx
upstream backend {
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

---

## Segurança

### SSL/TLS

```bash
# Gerar certificado Let's Encrypt
certbot certonly --standalone -d api.ioc-esg.com.br

# Renovação automática
0 0 1 * * certbot renew
```

### Secrets Management

```bash
# Usar AWS Secrets Manager
aws secretsmanager create-secret \
  --name ioc-esg/prod \
  --secret-string '{"DATABASE_URL":"...","API_KEY":"..."}'
```

---

## Performance

### Otimizações

- [ ] Ativar compressão GZIP
- [ ] Configurar cache HTTP
- [ ] Implementar CDN para assets
- [ ] Otimizar queries de banco de dados
- [ ] Usar connection pooling
- [ ] Implementar rate limiting

### Benchmarking

```bash
# Teste de carga com Apache Bench
ab -n 1000 -c 10 http://localhost:3000/api/municipalities

# Teste com wrk
wrk -t12 -c400 -d30s http://localhost:3000/api/municipalities
```

---

## Suporte

Para dúvidas sobre deployment, consulte:
1. Documentação do Docker
2. Documentação do Kubernetes
3. Guia de implementação técnica
4. Equipe de DevOps
