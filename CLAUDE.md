# CLAUDE.md

Project instructions for Claude Code. This file is the primary context for AI-assisted development.

## Project Overview

Condominium management app for **Rua Vieira da Silva, n.6 - Monte Abraao, Queluz**. Tracks unit payments, expenses, creditors, documents, and debt. Replaces the original Excel spreadsheet.

**Live at**: `condominio.pereiraru.com`

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: SQLite + Prisma ORM
- **Styling**: Tailwind CSS
- **Auth**: NextAuth.js (credentials provider)
- **Deployment**: Docker on Proxmox (self-hosted GitHub Actions runner)

## Quick Commands

```bash
npm install                           # Install dependencies
npm run dev                           # Development server
npm run build                         # Production build
npm run import:full                   # Import data from Excel
npm run seed:fee-history              # Seed fee history records
npm run clear-data                    # Clear all data (keeps users)
npx tsx scripts/audit-data.ts         # Run data audit
node scripts/create-admin.js          # Create admin user
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="<secret>"
NEXTAUTH_URL="http://localhost:3000"
```

## Project Structure

```
condominio/
├── .claude/commands/         # Slash commands: /deploy, /import, /audit, /db-reset
├── .github/workflows/        # deploy.yml (auto-deploy on push to main)
├── data/                     # Source Excel files (gitignored)
├── docs/                     # Architecture, data model, scripts, processes
├── prisma/schema.prisma      # Database schema
├── scripts/                  # Import, migration, fix, verification scripts
├── src/
│   ├── app/
│   │   ├── api/              # 20+ API route groups (Route Handlers)
│   │   ├── dashboard/        # Admin pages (units, transactions, reports, etc.)
│   │   └── login/            # Login page
│   ├── components/           # 9 React components (Sidebar, MonthCalendar, etc.)
│   ├── lib/                  # Shared logic (auth, prisma, feeHistory, types)
│   └── middleware.ts         # Auth middleware
├── CLAUDE.md                 # This file
├── Dockerfile
└── docker-compose.yml
```

## Data Model

16 units in the building (1D-6D, 1E-6E, RCD, RCE, CV, Garagem). Each unit has owners, transactions, fee history, and extra charges.

| Entity | Purpose |
|--------|---------|
| **Unit** | Apartment/fraction (code: "1D", "RCE", etc.) |
| **Owner** | Unit owner with period (startMonth/endMonth) |
| **Transaction** | Financial movement (+income, -expense) |
| **TransactionMonth** | Allocates a transaction to specific months and categories |
| **FeeHistory** | Monthly fee changes over time (37.50 until Jun 2024, then 45.00) |
| **ExtraCharge** | Temporary additional monthly charges (repairs, etc.) |
| **Creditor** | Supplier (electricity, elevator maintenance, etc.) |
| **Document** | Uploaded files (actas, invoices, receipts) |
| **DescriptionMapping** | Auto-assign bank transactions by description pattern |
| **User** | App login (admin or user role) |

## Key Business Logic

- **Debt = expected fees - payments received**, calculated per month using FeeHistory + ExtraCharge records
- **Fee lookup**: `src/lib/feeHistory.ts` — `getEffectiveFee(unitId, month)` returns correct fee for any month
- **Owner periods**: `src/lib/ownerPeriod.ts` — separates debt by owner tenure
- **Month allocations**: A single payment can be split across multiple months via TransactionMonth
- **Description mappings**: Auto-categorize imported bank transactions

## API Routes (key groups)

| Route | Purpose |
|-------|---------|
| `/api/units/[id]/payment-history` | Payment history grid data |
| `/api/units/[id]/month-transactions` | Monthly breakdown (expected vs paid) |
| `/api/units/[id]/debt` | Debt calculation |
| `/api/reports/debt-summary` | All units debt summary |
| `/api/reports/overview` | Financial overview |
| `/api/documents/file?name=` | Serve uploaded documents |
| `/api/mappings` | Description pattern mappings |
| `/api/import` | Trigger data import |

## Scripts

See `docs/scripts.md` for full reference. Key scripts:

| Script | npm command | Purpose |
|--------|-------------|---------|
| `import-full.ts` | `npm run import:full` | Full data import with fee schedule |
| `audit-data.ts` | — | Comprehensive data verification |
| `clear-data.ts` | `npm run clear-data` | Database cleanup |
| `seed-fee-history.ts` | `npm run seed:fee-history` | Create fee history records |

## Deployment

Push to `main` auto-deploys via GitHub Actions to Docker on Proxmox.

- SSH: `ssh docker-condominio` (alias for root@10.0.3.244)
- Container: `condominio-app-1`
- Manual deploy: `gh workflow run "Deploy to Proxmox" --ref main`

See `docs/processes/deployment.md` for details.

## Coding Conventions

- All API routes use Next.js Route Handlers (`export async function GET/POST/PUT/DELETE`)
- Prisma client singleton in `src/lib/prisma.ts`
- Dashboard pages use shared `Sidebar` component
- Portuguese labels in UI (Fracoes, Transacoes, Relatorios, etc.)
- Dates stored as "YYYY-MM" strings for month references
- Financial amounts: positive = income, negative = expense
- All uploaded files served via API routes (not static paths) for Docker compatibility

## Documentation

Detailed documentation in `docs/`:
- `docs/access.md` — SSH, GitHub, Docker, credentials reference
- `docs/architecture.md` — System architecture and full directory tree
- `docs/data-model.md` — Database entities and relationships
- `docs/scripts.md` — All scripts with usage
- `docs/processes/deployment.md` — Deployment guide
- `docs/processes/data-import.md` — Data import procedures
- `docs/processes/new-year-setup.md` — Annual setup tasks
