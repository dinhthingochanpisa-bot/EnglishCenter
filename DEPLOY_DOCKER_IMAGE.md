# Deploy tu Git tren server

Huong dan nay dung cho server da cai Docker, Docker Compose plugin va Git.

## 1. Lay code tren server

```bash
git clone https://github.com/dinhthingochanpisa-bot/EnglishCenter.git
cd EnglishCenter
```

Neu server da clone repo:

```bash
cd EnglishCenter
git pull
```

## 2. Tao file env

```bash
cp .env.deploy.example .env.deploy
```

Sua `.env.deploy` theo server. Với server hien tai:

```env
FRONTEND_URL=http://27.71.229.14:3002
NEXT_PUBLIC_API_URL=http://27.71.229.14:3100
POSTGRES_USER=admin
POSTGRES_PASSWORD=doi-mat-khau-db
POSTGRES_DB=english_center_db
JWT_SECRET=doi-jwt-secret
JWT_REFRESH_SECRET=doi-refresh-secret
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
UPLOAD_DIR=uploads/branding
```

`NEXT_PUBLIC_API_URL` se duoc bake vao web image khi build, nen moi lan doi IP/domain/API port can build lai web.

## 3. Chuan bi data dump

Repo co `local-data-dump.sql`. Neu can tao lai tu local, dung:

```powershell
docker exec -e PGPASSWORD=password english-center-postgres pg_dump -U admin -d english_center_db --data-only --no-owner --no-privileges --exclude-table-data=_prisma_migrations -f /tmp/local-data-dump.sql
docker cp english-center-postgres:/tmp/local-data-dump.sql local-data-dump.sql
```

Khong dung PowerShell redirect `>` de tao file dump vi co the lam sai encoding cua file SQL.

## 4. Build va chay tren server

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build
```

Compose se tu dong:

- build `english-center-api:latest` tu `apps/api/Dockerfile`
- build `english-center-web:latest` tu `apps/web/Dockerfile`
- chay `api-migrate` de migrate database
- chay `db-seed` de seed logo vao volume `branding_data` va import `local-data-dump.sql` neu database con trong
- start API va Web

Cong publish:

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

Xem log khi can:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs api-migrate
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs db-seed
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f api
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs -f web
```

## 6. Reset database neu migration/import bi loi tren server moi

Chi dung lenh nay khi server chua co data can giu:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml down -v
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d --build
```

## 7. Import data thu cong

Neu muon import thu cong thay vi de compose tu chay:

```bash
docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec api npm run migrate:deploy --workspace=database
cat local-data-dump.sql | docker compose --env-file .env.deploy -f docker-compose.deploy.yml exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Chi import vao database rong. Neu server da co data/seed, lenh import co the bi loi duplicate key.
