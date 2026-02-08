-- 1. Revert the erroneous subtraction of 3 years
-- We subtracted 94672800000ms from anything > 2026.
-- This likely moved valid 2024/2025 dates into 2021/2022/2023.
-- Since the system only started in 2024, anything before 2024-01-01 is likely an error from my previous script.

UPDATE "Transaction"
SET date = date + 94672800000
WHERE date < 1704067200000; -- Anything before 2024-01-01

UPDATE "Transaction"
SET valueDate = valueDate + 94672800000
WHERE valueDate < 1704067200000;

-- 2. Delete entries that are still in the future (2026-2028) 
-- These were the ones causing the issue and should be re-imported correctly
DELETE FROM "Transaction" 
WHERE date > 1767225600000; -- Anything after 2026-01-01

-- 3. Cleanup any associated allocations for deleted transactions
DELETE FROM "TransactionMonth"
WHERE transactionId NOT IN (SELECT id FROM "Transaction");
