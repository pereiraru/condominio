SELECT t.id, t.date, t.description, t.amount, t.unitId, u.code, tm.month, tm.amount as alloc_amount
FROM "Transaction" t
JOIN "Unit" u ON t.unitId = u.id
LEFT JOIN "TransactionMonth" tm ON t.id = tm.transactionId
WHERE (u.code = '2D' OR u.code = '2E') AND t.description LIKE '%CESAR%'
ORDER BY t.date ASC;