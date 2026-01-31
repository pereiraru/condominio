FROM node:20-slim AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client with correct binary target
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy prisma files for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy scripts
COPY --from=builder /app/scripts/migrate-month-allocations.js ./scripts/migrate-month-allocations.js
COPY --from=builder /app/scripts/create-admin.js ./scripts/create-admin.js
COPY --from=builder /app/scripts/clear-data.js ./scripts/clear-data.js
COPY --from=builder /app/scripts/import-data.js ./scripts/import-data.js

# Copy bcrypt for admin creation
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt

# Copy xlsx library for data import
COPY --from=builder /app/node_modules/xlsx ./node_modules/xlsx

# Copy Excel data files for import
COPY --from=builder /app/*.xlsm ./
COPY --from=builder /app/*.xlsx ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node scripts/create-admin.js && node scripts/import-data.js && node server.js"]
