# English Center CRM

A comprehensive, modular Management Information System (MIS) for English language centers.

## 🚀 Quick Start (Docker)

```bash
# Start and seed in Docker
docker compose up -d
docker exec -it english-center-api npm run db:seed

# Verify in Docker
verify-docker.bat
```
Access the web UI at `http://localhost:3001` (Super Admin: `superadmin@example.com` / `password123`).

## ✅ Local Verification

Before committing or hand-over, ensure all tests pass locally:
```bash
verify.bat
```

## 📚 Documentation

For detailed instructions, please refer to the following guides:

- **[Developer & Setup Guide](./docs/DEVELOPER_GUIDE.md)**: Installation, local development, and Docker configuration.
- **[Admin & Operations Guide](./docs/ADMIN_GUIDE.md)**: Managing branding, feature toggles, roles, and users.
- **[UAT Checklist](./docs/UAT_CHECKLIST.md)**: Steps to verify the system's core business flows.
- **[Acceptance Report](./ACCEPTANCE_REPORT.md)**: Current status of all implemented modules.

## 🛠 Tech Stack

- **Frontend**: Next.js 16.2.4 (App Router), TailwindCSS, Radix UI.
- **Backend**: NestJS 11, Prisma ORM, Passport (JWT).
- **Database**: PostgreSQL 16.
- **Operations**: TurboRepo, Docker, GitHub-style Audit Logs.

## 🌟 Key Features

- **Multi-Center Isolation**: Strict data scoping per center.
- **Dynamic Branding**: Real-time theme customization.
- **Modular Architecture**: Feature toggles for granular control.
- **Commercial Backbone**: Contracts, partial payments (FIFO), and renewals.
- **Dashboards**: Operational insights for Sales, Academic, and Management roles.
- **Audit Logging**: Full traceability for every critical data mutation.

---
© 2026 English Center CRM Project. Hardened for UAT and Go-Live.
