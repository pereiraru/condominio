# Scripts Reference

All scripts are in the `scripts/` directory. Run with `npx tsx scripts/<name>.ts` or via npm scripts.

## Import Scripts

### import-excel.ts
Basic import from the original Excel spreadsheet.
```bash
npm run import
# or: npx tsx scripts/import-excel.ts
```
Source: `data/contas predio.xlsm`

### import-full.ts
Comprehensive import with hardcoded fee schedule and all 16 unit mappings. Includes fee history creation.
```bash
npm run import:full
# or: npx tsx scripts/import-full.ts
```
Source: `data/contas predio.xlsm`

### import-historical.ts
Imports historical data with Portuguese unit name-to-code mapping (e.g., "6.Andar Direito" -> "6D").
```bash
npx tsx scripts/import-historical.ts
```
Source: `data/Condominio Actual 2023.xlsx`

## Migration Scripts

### migrate-owners.ts
Populates owner period fields (startMonth, endMonth) and links Users to Owners.
```bash
npx tsx scripts/migrate-owners.ts
```

### migrate-month-allocations.ts
Creates TransactionMonth records from transactions that have a `referenceMonth` field. One-time schema migration.
```bash
npx tsx scripts/migrate-month-allocations.ts
```

## Fix Scripts

### fix-garagem.ts
One-time fix: converts "Garagem" creditor into a proper unit with code "Garagem", floor -2.
```bash
npx tsx scripts/fix-garagem.ts
```

### fix-lumpsum-payments.ts
Recalculates lump-sum payments using proper fee history. Re-creates TransactionMonth records with correct amounts per month.
```bash
npx tsx scripts/fix-lumpsum-payments.ts
```

## Setup Scripts

### seed-fee-history.ts
Creates initial FeeHistory records using the earliest transaction month per unit.
```bash
npm run seed:fee-history
# or: npx tsx scripts/seed-fee-history.ts
```

### create-admin.js
Creates an admin user account.
```bash
node scripts/create-admin.js [email] [password]
# Defaults: admin@condominio.pt / admin123
```

## Verification Scripts

### audit-data.ts
Comprehensive data audit checking: fee history coverage, transaction allocations, debt calculations, owner periods.
```bash
npx tsx scripts/audit-data.ts
```

### verify-2024.ts
Verifies 2024 transaction data integrity.
```bash
npx tsx scripts/verify-2024.ts
```

## Cleanup Scripts

### clear-data.ts
Deletes all data except user accounts. Clears in dependency order.
```bash
npm run clear-data
# or: npx tsx scripts/clear-data.ts
```
