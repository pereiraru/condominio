Import data from Excel files into the database.

Available import scripts:
- `npm run import` — Basic import from `data/contas predio.xlsm`
- `npm run import:full` — Full import with fee schedule and unit mapping from `data/contas predio.xlsm`
- `npx tsx scripts/import-historical.ts` — Historical import from `data/Condominio Actual 2023.xlsx`

Steps:
1. Ask which import to run if not specified in arguments
2. Run the selected import script
3. After import, run `npx tsx scripts/audit-data.ts` to verify data integrity
4. Report results

$ARGUMENTS
