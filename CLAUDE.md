# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Condominium management web application for tracking expenses, resident payments, and documents. Built to replace the original Excel spreadsheet (`contas predio.xlsm`).

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: SQLite with Prisma ORM
- **Styling**: Tailwind CSS
- **Deployment**: Docker

## Commands

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
npx prisma generate
npx prisma db push

# Import data from Excel
npm run import

# Development
npm run dev

# Production (Docker)
docker compose up --build
```

## Architecture

```
src/
  app/
    api/              # API routes (stats, transactions, units, documents)
    dashboard/        # Admin dashboard pages
    page.tsx          # Login page
  components/         # Reusable UI components
  lib/
    prisma.ts         # Prisma client singleton
    types.ts          # TypeScript interfaces
prisma/
  schema.prisma       # Database schema
scripts/
  import-excel.ts     # Excel data import script
```

## Data Model

- **Unit**: Apartment/fraction (code like "1D", "2E", "RCE")
- **Transaction**: Financial movement (payments, expenses, fees)
- **Document**: Uploaded files (invoices, receipts, minutes)
- **User**: Admin or resident with optional unit assignment

## Key Patterns

- All API routes in `src/app/api/` use Next.js Route Handlers
- Prisma client is a singleton in `src/lib/prisma.ts`
- Dashboard pages share the `Sidebar` component for navigation
- Transaction categorization logic is in `scripts/import-excel.ts`
