Reset the database and re-import all data.

WARNING: This will delete ALL data except user accounts.

Steps:
1. Confirm with the user before proceeding
2. Run `npm run clear-data` to clear the database
3. Run `npm run import:full` to re-import from Excel
4. Run `npx tsx scripts/seed-fee-history.ts` to seed fee history
5. Run `npx tsx scripts/migrate-owners.ts` to set up owner periods
6. Run `npx tsx scripts/audit-data.ts` to verify data integrity
7. Report results

$ARGUMENTS
