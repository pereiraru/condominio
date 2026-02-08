-- Fix transactions with future dates by subtracting 3 years (94672800000 milliseconds)
-- This covers the offset error where 2024 was parsed as 2027, etc.

UPDATE "Transaction" 
SET date = date - 94672800000 
WHERE date > 1767225600000; -- Anything after 2026-01-01

-- Also fix valueDate if it exists
UPDATE "Transaction" 
SET valueDate = valueDate - 94672800000 
WHERE valueDate > 1767225600000;

-- Verify
SELECT id, datetime(date/1000, 'unixepoch'), description FROM "Transaction" WHERE date > 1767225600000;
