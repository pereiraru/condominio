# Architecture

## System Overview

```
Browser → Next.js App (Docker) → SQLite Database
                ↓
         Prisma ORM → prisma/dev.db
```

The app runs as a Docker container on a Proxmox server (10.0.3.244), deployed via GitHub Actions from the `main` branch.

## Directory Structure

```
condominio/
├── .claude/                  # Claude Code config
│   ├── commands/             # Slash commands (/deploy, /audit, etc.)
│   └── settings.local.json   # Local permissions
├── .github/workflows/        # CI/CD
│   └── deploy.yml            # Auto-deploy on push to main
├── data/                     # Source Excel files (gitignored)
├── docs/                     # Documentation
│   └── processes/            # Process guides
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── dev.db                # SQLite database (gitignored)
├── public/uploads/           # Uploaded documents (Docker volume)
├── scripts/                  # Data import/migration/fix scripts
├── src/
│   ├── app/
│   │   ├── api/              # API routes (Next.js Route Handlers)
│   │   ├── dashboard/        # Admin dashboard pages
│   │   ├── login/            # Login page
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Root redirect
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   ├── lib/                  # Shared utilities
│   │   ├── auth.ts           # NextAuth configuration
│   │   ├── feeHistory.ts     # Fee calculation logic
│   │   ├── ownerPeriod.ts    # Owner period utilities
│   │   ├── prisma.ts         # Prisma client singleton
│   │   └── types.ts          # TypeScript interfaces
│   ├── types/                # Type declarations
│   │   └── next-auth.d.ts    # NextAuth type extensions
│   └── middleware.ts         # Auth middleware
├── CLAUDE.md                 # Project instructions for Claude Code
├── Dockerfile                # Docker build config
├── docker-compose.yml        # Docker orchestration
└── package.json              # Dependencies and scripts
```

## API Routes

All routes use Next.js Route Handlers in `src/app/api/`.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | GET, POST | Authentication (NextAuth) |
| `/api/stats` | GET | Dashboard statistics |
| `/api/units` | GET | List all units |
| `/api/units/[id]` | GET, PUT | Unit details and updates |
| `/api/units/[id]/debt` | GET | Unit debt calculation |
| `/api/units/[id]/fee-history` | GET | Unit fee history |
| `/api/units/[id]/month-transactions` | GET | Monthly payment breakdown |
| `/api/units/[id]/payment-history` | GET | Payment history grid |
| `/api/transactions` | GET, POST | List/create transactions |
| `/api/transactions/[id]` | PUT, DELETE | Update/delete transaction |
| `/api/monthly-status` | GET | Monthly payment status overview |
| `/api/creditors` | GET, POST | List/create creditors |
| `/api/creditors/[id]` | GET, PUT, DELETE | Creditor CRUD |
| `/api/creditors/[id]/attachments` | POST | Upload creditor attachments |
| `/api/documents` | GET, POST | List/upload documents |
| `/api/documents/file` | GET | Serve uploaded document files |
| `/api/documents/attachment` | GET | Serve creditor attachment files |
| `/api/extra-charges` | GET, POST | List/create extra charges |
| `/api/extra-charges/[id]` | PUT, DELETE | Update/delete extra charges |
| `/api/fee-history/[id]` | DELETE | Delete fee history records |
| `/api/import` | POST | Trigger data import |
| `/api/mappings` | GET, POST | Description mappings |
| `/api/mappings/[id]` | DELETE | Delete mapping |
| `/api/mappings/match-count` | GET | Count matching transactions |
| `/api/reports/overview` | GET | Financial overview report |
| `/api/reports/debt-summary` | GET | Debt summary by unit |

## Dashboard Pages

| Path | Page | Description |
|------|------|-------------|
| `/dashboard` | Main | Overview with stats cards and charts |
| `/dashboard/units` | Units | List of all units with payment status |
| `/dashboard/units/[id]` | Unit Detail | Payment history grid, fee management |
| `/dashboard/transactions` | Transactions | Transaction list with filters |
| `/dashboard/payments` | Payments | Payment recording interface |
| `/dashboard/creditors` | Creditors | Supplier management |
| `/dashboard/creditors/[id]` | Creditor Detail | Creditor details and attachments |
| `/dashboard/documents` | Documents | Document upload and management |
| `/dashboard/reports` | Reports | Financial reports and debt summary |
| `/dashboard/admin/users` | Users | User management (admin only) |

## Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Navigation sidebar for all dashboard pages |
| `StatsCard` | Dashboard metric card |
| `TransactionList` | Paginated transaction table |
| `TransactionEditPanel` | Slide-out panel for editing transactions |
| `HistoryEditPanel` | Monthly payment allocation editor |
| `MonthCalendar` | Payment history calendar grid |
| `FeeHistoryManager` | Fee history CRUD interface |
| `ExtraChargesManager` | Extra charges CRUD interface |
| `AuthProvider` | NextAuth session provider wrapper |

## Deployment

```
Push to main → GitHub Actions → Self-hosted runner (Proxmox)
                                    ↓
                              docker compose build
                              docker compose up -d
```

- Container: `condominio-app-1`
- Host: `10.0.3.244` (SSH alias: `docker-condominio`)
- Domain: `condominio.pereiraru.com`
- Database: SQLite in Docker volume
- Uploads: Docker volume at `/app/public/uploads/`
