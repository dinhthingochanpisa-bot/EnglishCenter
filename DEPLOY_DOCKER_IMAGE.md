# Deploy bang Docker image file

Huong dan nay dung cho server da cai Docker va Docker Compose plugin.

## 1. Build image o may build

Neu deploy tren IP/domain that, thay `SERVER_HOST` bang host cua server. Gia tri nay se duoc bake vao web image vi `NEXT_PUBLIC_API_URL` la bien public cua Next.js.

```powershell
$env:SERVER_HOST="localhost"
docker build -f apps/api/Dockerfile -t english-center-api:latest .
docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL="http://$env:SERVER_HOST:3100" -t english-center-web:latest .
```

## 2. Xuat image thanh file tar

```powershell
docker save -o english-center-api.tar english-center-api:latest
docker save -o english-center-web.tar english-center-web:latest
```

Copy cac file sau len server:

```text
english-center-api.tar
english-center-web.tar
docker-compose.deploy.yml
docker/postgres/import-local-data.sh
local-data-dump.sql
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
Web:      http://SERVER_HOST:3002
API:      http://SERVER_HOST:3100
Postgres: SERVER_HOST:5432 -> container 5432
Redis:    SERVER_HOST:6380 -> container 6379
```

## 5. Kiem tra

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
curl http://localhost:3100/health
```

## 6. Migration va data tu dong khi compose moi

`docker-compose.deploy.yml` co san 2 service init:

- `api-migrate`: chay Prisma migration.
- `db-seed`: import `local-data-dump.sql` neu database con trong.

Khi chay:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
```

API se cho migration va import data xong moi start.

Xem log init khi can:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs api-migrate
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs db-seed
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f api
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f web
```

## 7. Tao lai file data dump

File data dump local duoc tao bang:

```powershell
docker exec -e PGPASSWORD=password english-center-postgres pg_dump -U admin -d english_center_db --data-only --no-owner --no-privileges --exclude-table-data=_prisma_migrations > local-data-dump.sql
```

Neu muon import thu cong thay vi de compose tu chay, tren server chay migration truoc:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec api npm run migrate:deploy --workspace=database
```

Sau do import data:

```bash
cat local-data-dump.sql | docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Chi import vao database rong. Neu server da co data/seed, lenh import co the bi loi duplicate key.
