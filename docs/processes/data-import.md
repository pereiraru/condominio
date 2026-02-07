# Data Import Process

## Full Import (from scratch)

When setting up the database from scratch or after a `clear-data`:

```bash
# 1. Clear existing data (keeps user accounts)
npm run clear-data

# 2. Import transactions from Excel
npm run import:full

# 3. Seed fee history records
npm run seed:fee-history

# 4. Set up owner periods
npx tsx scripts/migrate-owners.ts

# 5. Verify data integrity
npx tsx scripts/audit-data.ts
```

## Excel File Sources

| File | Location | Content |
|------|----------|---------|
| `contas predio.xlsm` | `data/` | Original spreadsheet with bank transactions |
| `Condominio Actual 2023.xlsx` | `data/` | Updated data with historical records |
| `extrato.xlsx` | `data/` | Bank statement extract |

## Import Scripts Comparison

| Script | Source File | Units | Fee History | Use Case |
|--------|-----------|-------|-------------|----------|
| `import-excel.ts` | contas predio.xlsm | Basic mapping | No | Quick import |
| `import-full.ts` | contas predio.xlsm | All 16 units | Yes (hardcoded) | Full setup |
| `import-historical.ts` | Condominio Actual 2023.xlsx | Portuguese name mapping | No | Historical data |

## After Import

1. Check the audit: `npx tsx scripts/audit-data.ts`
2. Review units in the dashboard: `/dashboard/units`
3. Verify transaction counts and balances
4. Check for unmapped transactions in `/dashboard/transactions`
