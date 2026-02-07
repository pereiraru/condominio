# New Year Setup

## Annual Tasks

At the start of each year (or after the annual assembly):

### 1. Update Fee Amounts (if changed)

If the assembly approved a fee change:
- Go to `/dashboard/units/[id]` for each unit
- Use the Fee History Manager to add a new fee record
- Set `effectiveFrom` to the month the new fee starts
- Set `effectiveTo` on the previous fee record

### 2. Add Extra Charges (if approved)

If the assembly approved extra charges (repairs, improvements):
- Go to `/dashboard/units/[id]`
- Use the Extra Charges Manager
- Set the period and monthly amount

### 3. Upload Assembly Minutes

- Go to `/dashboard/documents`
- Upload the acta (meeting minutes) PDF
- Category: "minutes"

### 4. Update Owner Records

If any apartments changed owners:
- Set `endMonth` on the previous owner
- Create new Owner record with `startMonth`
- Update the User account if the new owner needs app access

### 5. Import New Bank Statements

When new bank statements are available:
- Place the Excel file in `data/`
- Run the appropriate import script
- Check description mappings for new transaction patterns

### 6. Verify Data

```bash
npx tsx scripts/audit-data.ts
```

Review the audit output for any inconsistencies.

## Historical Fee Schedule

| Period | Monthly Fee |
|--------|-------------|
| Until May 2024 | 37.50 |
| From June 2024 | 45.00 |

## Assembly Decisions to Track

From each annual assembly (acta), record:
- Fee changes
- Extra charges approved
- New administrators
- Debtor information
- Maintenance decisions
