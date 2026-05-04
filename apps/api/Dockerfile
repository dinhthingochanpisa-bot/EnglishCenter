FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy all package.json files to allow npm to resolve workspaces
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json

RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables for build time (if needed by Prisma)
ENV DATABASE_URL="postgresql://admin:password@localhost:5432/english_center_db?schema=public"

# Generate Prisma Client
RUN npx turbo run generate --filter=database

# Build the app
RUN npx turbo run build --filter=api

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Create the uploads directory structure at the root level /app/uploads
# This ensures consistency regardless of where the process is running from
RUN mkdir -p /app/uploads/branding && chown -R nestjs:nodejs /app/uploads

# Copy essential files for workspace resolution
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

# Copy build artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database

USER nestjs

EXPOSE 3000

# Start using production command in workspace
CMD ["npm", "run", "start:prod", "--workspace=api"]
