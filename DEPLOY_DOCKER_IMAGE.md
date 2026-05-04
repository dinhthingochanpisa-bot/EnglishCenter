# Deploy bang Docker image file

Huong dan nay dung cho server da cai Docker va Docker Compose plugin.

## 1. Build image o may build

Neu deploy tren IP/domain that, thay `SERVER_HOST` bang host cua server. Gia tri nay se duoc bake vao web image vi `NEXT_PUBLIC_API_URL` la bien public cua Next.js.

```powershell
$env:SERVER_HOST="localhost"
docker build -f apps/api/Dockerfile -t english-center-api:latest .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL="http://$env:SERVER_HOST:8446" -t english-center-web:latest .
```

## 2. Xuat image thanh file tar

```powershell
docker save -o english-center-api.tar english-center-api:latest
docker save -o english-center-web.tar english-center-web:latest
```

Copy 3 file len server:

```text
english-center-api.tar
english-center-web.tar
docker-compose.deploy.yml
```

Copy them `.env.deploy.example` len server va doi ten thanh `.env.deploy`, sau do sua password, JWT secret, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL` theo IP/domain server.

## 3. Load image tren server

```bash
docker load -i english-center-api.tar
docker load -i english-center-web.tar
```

## 4. Chay he thong

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
```

Cong publish mac dinh:

```text
Web:      http://SERVER_HOST:8445
API:      http://SERVER_HOST:8446
Postgres: SERVER_HOST:3002 -> container 5432
```

## 5. Kiem tra

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
curl http://localhost:8446/health
```

## 6. Chay migration database lan dau

Sau khi Postgres va API container da len, chay migration production:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec api npm run migrate:deploy --workspace=database
```

Neu can nap du lieu mau:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec api npm run seed --workspace=database
```

Xem log khi can:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f api
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f web
```
