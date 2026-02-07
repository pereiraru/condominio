#!/bin/bash
# Fix production database - apply all manual data fixes
# Run from local machine with SSH access to docker-condominio
#
# Usage: bash scripts/fix-prod-data.sh

set -e

SSH_HOST="docker-condominio"
DB_CMD="docker exec condominio-app-1 sqlite3 /app/data/condominio.db"

echo "=== Production Database Fix Script ==="
echo ""

# Test connection
echo "1. Testing SSH connection..."
ssh -o ConnectTimeout=10 $SSH_HOST "echo 'Connected to prod server'" || { echo "ERROR: Cannot connect to $SSH_HOST"; exit 1; }

# Show current state before fixes
echo ""
echo "2. Current state of affected data..."
echo ""
echo "--- Cesar 2D transaction (should be 450, need to change to 322.50) ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, amount, unitId, description FROM 'Transaction' WHERE id = 'cml89n7k40059ztjsflvsf951';\""

echo ""
echo "--- Cesar 2D allocations (before fix) ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, month, amount FROM TransactionMonth WHERE transactionId = 'cml89n7k40059ztjsflvsf951' ORDER BY month;\""

echo ""
echo "--- Cesar 2E split transaction (should not exist yet in prod) ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, amount, unitId, description FROM 'Transaction' WHERE id = 'cesar_2e_split';\"" || true

echo ""
echo "--- Garagem 2nd transaction allocations (before fix) ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, month, amount FROM TransactionMonth WHERE transactionId = 'cml89n7s800r7ztjs88pedru3' ORDER BY month;\""

echo ""
echo "--- FeeHistory count (should delete pre-2024) ---"
ssh $SSH_HOST "$DB_CMD \"SELECT COUNT(*) as total FROM FeeHistory;\""
ssh $SSH_HOST "$DB_CMD \"SELECT COUNT(*) as pre2024 FROM FeeHistory WHERE effectiveTo IS NOT NULL AND effectiveTo < '2024-01';\""

echo ""
read -p "3. Apply fixes? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "4. Applying fixes..."

# === FIX 1: Delete pre-2024 FeeHistory records ===
echo ""
echo "--- Fix 1: Delete pre-2024 FeeHistory records ---"
ssh $SSH_HOST "$DB_CMD \"DELETE FROM FeeHistory WHERE effectiveTo IS NOT NULL AND effectiveTo < '2024-01';\""
echo "Done. Remaining FeeHistory:"
ssh $SSH_HOST "$DB_CMD \"SELECT COUNT(*) FROM FeeHistory;\""

# === FIX 2: Cesar 2D/2E payment split ===
echo ""
echo "--- Fix 2: Cesar payment split (2D: 322.50, new 2E split: 127.50) ---"

# 2a. Change original 450 transaction to 322.50 and move to unit 2D
ssh $SSH_HOST "$DB_CMD \"UPDATE 'Transaction' SET amount = 322.5, unitId = 'cml24ruw6000af5lpllugo2nt' WHERE id = 'cml89n7k40059ztjsflvsf951';\""
echo "Updated transaction to 322.50 on 2D"

# 2b. Delete old allocation for this transaction
ssh $SSH_HOST "$DB_CMD \"DELETE FROM TransactionMonth WHERE transactionId = 'cml89n7k40059ztjsflvsf951';\""
echo "Deleted old allocations"

# 2c. Create correct allocations for 2D (Jan-Aug 2024)
ssh $SSH_HOST "$DB_CMD \"
INSERT INTO TransactionMonth (id, transactionId, month, amount, createdAt) VALUES
  ('alloc_2d_jan', 'cml89n7k40059ztjsflvsf951', '2024-01', 37.5, datetime('now')),
  ('alloc_2d_feb', 'cml89n7k40059ztjsflvsf951', '2024-02', 37.5, datetime('now')),
  ('alloc_2d_mar', 'cml89n7k40059ztjsflvsf951', '2024-03', 37.5, datetime('now')),
  ('alloc_2d_apr', 'cml89n7k40059ztjsflvsf951', '2024-04', 37.5, datetime('now')),
  ('alloc_2d_may', 'cml89n7k40059ztjsflvsf951', '2024-05', 37.5, datetime('now')),
  ('alloc_2d_jun', 'cml89n7k40059ztjsflvsf951', '2024-06', 45.0, datetime('now')),
  ('alloc_2d_jul', 'cml89n7k40059ztjsflvsf951', '2024-07', 45.0, datetime('now')),
  ('alloc_2d_aug', 'cml89n7k40059ztjsflvsf951', '2024-08', 45.0, datetime('now'));
\""
echo "Created 8 allocations for 2D (Jan-Aug 2024, total 322.50)"

# 2d. Create new split transaction for 2E (127.50)
ssh $SSH_HOST "$DB_CMD \"
INSERT INTO 'Transaction' (id, date, amount, description, type, unitId, creditorId, createdAt, updatedAt)
SELECT 'cesar_2e_split', date, 127.5, 'TR-CESAR DAVID SANTOS SA (2E)', type, 'cml24ruwa000ff5lppdhcjvaf', creditorId, datetime('now'), datetime('now')
FROM 'Transaction' WHERE id = 'cml89n7k40059ztjsflvsf951';
\""
echo "Created 2E split transaction (127.50)"

# 2e. Create allocation for 2E split
ssh $SSH_HOST "$DB_CMD \"
INSERT INTO TransactionMonth (id, transactionId, month, amount, createdAt) VALUES
  ('alloc_2e_split', 'cesar_2e_split', '2024-05', 127.5, datetime('now'));
\""
echo "Created allocation for 2E split (2024-05, 127.50)"

# === FIX 3: Garagem 2nd transaction allocations ===
echo ""
echo "--- Fix 3: Garagem 2nd transaction (Jan-Oct 2025 instead of wrong split) ---"

# 3a. Delete wrong allocations
ssh $SSH_HOST "$DB_CMD \"DELETE FROM TransactionMonth WHERE transactionId = 'cml89n7s800r7ztjs88pedru3';\""
echo "Deleted old Garagem allocations"

# 3b. Create correct allocations (Jan-Oct 2025)
ssh $SSH_HOST "$DB_CMD \"
INSERT INTO TransactionMonth (id, transactionId, month, amount, createdAt) VALUES
  ('alloc_gar_2025_01', 'cml89n7s800r7ztjs88pedru3', '2025-01', 45.0, datetime('now')),
  ('alloc_gar_2025_02', 'cml89n7s800r7ztjs88pedru3', '2025-02', 45.0, datetime('now')),
  ('alloc_gar_2025_03', 'cml89n7s800r7ztjs88pedru3', '2025-03', 45.0, datetime('now')),
  ('alloc_gar_2025_04', 'cml89n7s800r7ztjs88pedru3', '2025-04', 45.0, datetime('now')),
  ('alloc_gar_2025_05', 'cml89n7s800r7ztjs88pedru3', '2025-05', 45.0, datetime('now')),
  ('alloc_gar_2025_06', 'cml89n7s800r7ztjs88pedru3', '2025-06', 45.0, datetime('now')),
  ('alloc_gar_2025_07', 'cml89n7s800r7ztjs88pedru3', '2025-07', 45.0, datetime('now')),
  ('alloc_gar_2025_08', 'cml89n7s800r7ztjs88pedru3', '2025-08', 45.0, datetime('now')),
  ('alloc_gar_2025_09', 'cml89n7s800r7ztjs88pedru3', '2025-09', 45.0, datetime('now')),
  ('alloc_gar_2025_10', 'cml89n7s800r7ztjs88pedru3', '2025-10', 45.0, datetime('now'));
\""
echo "Created 10 allocations for Garagem (Jan-Oct 2025, total 450.00)"

# === VERIFY ===
echo ""
echo "5. Verifying fixes..."
echo ""
echo "--- Cesar 2D transaction ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, amount, unitId FROM 'Transaction' WHERE id = 'cml89n7k40059ztjsflvsf951';\""

echo "--- Cesar 2D allocations ---"
ssh $SSH_HOST "$DB_CMD \"SELECT month, amount FROM TransactionMonth WHERE transactionId = 'cml89n7k40059ztjsflvsf951' ORDER BY month;\""

echo "--- Cesar 2E split transaction ---"
ssh $SSH_HOST "$DB_CMD \"SELECT id, amount, unitId FROM 'Transaction' WHERE id = 'cesar_2e_split';\""

echo "--- Cesar 2E split allocation ---"
ssh $SSH_HOST "$DB_CMD \"SELECT month, amount FROM TransactionMonth WHERE transactionId = 'cesar_2e_split';\""

echo "--- Garagem allocations ---"
ssh $SSH_HOST "$DB_CMD \"SELECT month, amount FROM TransactionMonth WHERE transactionId = 'cml89n7s800r7ztjs88pedru3' ORDER BY month;\""

echo "--- FeeHistory count ---"
ssh $SSH_HOST "$DB_CMD \"SELECT COUNT(*) FROM FeeHistory;\""

echo ""
echo "=== All fixes applied successfully! ==="
