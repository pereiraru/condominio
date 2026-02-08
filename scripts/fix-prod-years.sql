-- Fix Production Data: Delete buggy TXT bank extract import
-- The TXT import on 2026-02-08 had a day/month swap bug (M/D/YY parsed as D/M/YY)
-- This caused dates to shift by months/years due to JavaScript Date month overflow
--
-- Original Excel import: 509 transactions (2026-02-04) - CORRECT
-- Manual entries: 3 transactions (2026-02-07) - CORRECT
-- TXT bank extract: 471 transactions (2026-02-08) - BUGGY, to be deleted
--
-- After deletion, the fixed import code can re-import from the TXT file correctly.

-- Step 1: Delete TransactionMonth records linked to buggy transactions
DELETE FROM TransactionMonth
WHERE transactionId IN (
  SELECT id FROM "Transaction"
  WHERE createdAt > 1770508800000  -- 2026-02-08 00:00:00 UTC
);

-- Step 2: Delete the buggy transactions themselves
DELETE FROM "Transaction"
WHERE createdAt > 1770508800000;  -- 2026-02-08 00:00:00 UTC

-- Step 3: Delete buggy bank account snapshot (created with wrong date 2028-06-01)
DELETE FROM BankAccountSnapshot
WHERE createdAt > 1770508800000;  -- Also created during the buggy import

-- Step 4: Also fix Garagem allocations (all at 37.50, should be 45.00 from Jun 2024)
-- Garagem fee changed from 37.50 to 45.00 effective June 2024
UPDATE TransactionMonth
SET amount = 45.0
WHERE id IN (
  SELECT tm.id FROM TransactionMonth tm
  JOIN "Transaction" t ON tm.transactionId = t.id
  JOIN Unit u ON t.unitId = u.id
  WHERE u.code = 'Garagem'
  AND tm.month >= '2024-06'
  AND tm.amount = 37.5
);

-- Verify results
SELECT 'Remaining transactions:' as label, COUNT(*) as cnt FROM "Transaction";
SELECT 'Remaining allocations:' as label, COUNT(*) as cnt FROM TransactionMonth;
SELECT 'Garagem allocations:' as label, tm.month, tm.amount
FROM TransactionMonth tm
JOIN "Transaction" t ON tm.transactionId = t.id
JOIN Unit u ON t.unitId = u.id
WHERE u.code = 'Garagem'
ORDER BY tm.month;
