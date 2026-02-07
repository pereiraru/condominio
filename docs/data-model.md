# Data Model

## Entity Relationship Diagram

```
User ──────┐
           │ 1:1
Owner ────Unit ────── Transaction ────── TransactionMonth
  │         │              │                    │
  │         ├── FeeHistory │                    └── ExtraCharge
  │         ├── ExtraCharge│
  │         └── DescriptionMapping
  │                        │
  └────────────────────────├── Creditor ── CreditorAttachment
                           │              ── DescriptionMapping
                           │              ── FeeHistory
                           └── Document
```

## Entities

### Unit
An apartment/fraction in the building. Identified by a code (e.g., "1D" = 1st floor right, "RCE" = ground floor left).

| Code | Description | Floor |
|------|-------------|-------|
| 1D, 2D, 3D, 4D, 5D, 6D | Right-side apartments | 1-6 |
| 1E, 2E, 3E, 4E, 5E, 6E | Left-side apartments | 1-6 |
| RCD | Ground floor right | 0 |
| RCE | Ground floor left | 0 |
| CV | Storage room (cave) | -1 |
| Garagem | Garage (cave -2) | -2 |

### Owner
A person who owns a unit during a specific period. A unit can have multiple owners over time, tracked by `startMonth`/`endMonth` (YYYY-MM format). The current owner has `endMonth = null`.

`previousDebt` stores debt carried over from a previous owner that the new owner inherited.

### Transaction
A financial movement: income (positive amount) or expense (negative amount).

**Types:**
- `payment` — Resident paying their quota
- `expense` — Building expense (electricity, elevator maintenance, etc.)
- `fee` — Bank fees
- `transfer` — Internal transfers

**Categories (for expenses):**
`electricity`, `elevator`, `maintenance`, `bank_fee`, `savings`, `cleaning`, `insurance`, `water`, `gas`, `other`

### TransactionMonth
Links a transaction to one or more months. A single payment can be split across multiple months (e.g., a lump sum covering Jan-Mar).

- `month` — "YYYY-MM" the payment covers
- `amount` — portion allocated to this month
- `extraChargeId` — null for base fee, or links to an ExtraCharge

### FeeHistory
Tracks monthly fee changes over time. Both units and creditors can have fee history.

- `effectiveFrom` — when this fee started (YYYY-MM)
- `effectiveTo` — when it ended (YYYY-MM, null = ongoing)

Historical fee schedule: 37.50/month until June 2024, then 45.00/month.

### ExtraCharge
Temporary additional charges on top of the regular monthly fee (e.g., building repairs).

- Can apply to a specific unit (`unitId` set) or all units (`unitId = null`)
- Has a period (`effectiveFrom`/`effectiveTo`)
- `amount` is the extra monthly charge

### Creditor
External suppliers/service providers (electricity company, elevator maintenance, etc.).

### Document
Uploaded files: invoices, receipts, meeting minutes, contracts.

### DescriptionMapping
Pattern matching rules to auto-assign imported bank transactions to units or creditors based on the transaction description text.

### User
App users with login credentials. Can be `admin` (full access) or `user` (view only). Optionally linked to a unit.

## Business Logic

### Debt Calculation
For each unit, debt is calculated as:
```
debt = sum(expected monthly fees) - sum(payments received)
```

Expected fees are determined by `FeeHistory` + `ExtraCharge` records for each month. Payments are tracked via `TransactionMonth` allocations.

### Fee Lookup
`src/lib/feeHistory.ts` provides `getEffectiveFee(unitId, month)` which looks up the correct fee for a given month based on the fee history chain.

### Owner Periods
`src/lib/ownerPeriod.ts` determines which owner is responsible for a given month, used to separate debt by owner.
