// src/models/repositories/expense-repository.js

class ExpenseRepository {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Fetches all expenses with joined details.
     * @param {boolean} filterByCurrentMonth - Optional. If true, filters expenses by the current month.
     * @returns {Promise<Array<Object>>}
     */
    async getAllExpenses(filterByCurrentMonth = false) {
        let sql = `
            SELECT
                e.id,
                e.date,
                e.amount,
                e.expense_description,
                eg.name AS group_name,
                ec.name AS category_name,
                p.name AS payer_name,
                pm.name AS payment_mode_name,
                e.expense_group_id,
                e.expense_category_id,
                e.payer_id,
                e.payment_mode_id
            FROM expenses e
            JOIN expense_groups eg ON e.expense_group_id = eg.id
            JOIN expense_categories ec ON e.expense_category_id = ec.id
            JOIN payers p ON e.payer_id = p.id
            JOIN payment_mode pm ON e.payment_mode_id = pm.id
    `;
        const params = [];
        if (filterByCurrentMonth) {
            // Assuming PostgreSQL syntax for current month
            sql += ` WHERE TO_CHAR(e.date, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`;
        }
        sql += ` ORDER BY e.date DESC`;
        return this.dbManager.runQuery(sql, params);
    }

    /**
     * Adds a new expense.
     * @param {Object} expenseData - The expense data.
     * @returns {Promise<Object>} The created expense with its ID.
     */
    async addExpense(expenseData) {
        const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description } = expenseData;
        const sql = `
            INSERT INTO expenses (expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        const result = await this.dbManager.runCommand(sql, [expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description]);
        return { id: result.id, ...expenseData };
    }

    /**
     * Updates an existing expense.
     * @param {number} id - The ID of the expense to update.
     * @param {Object} expenseData - The updated expense data.
     * @returns {Promise<Object>} The updated expense.
     * @throws {Error} If the expense is not found.
     */
    async updateExpense(id, expenseData) {
        const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description } = expenseData;
        const sql = `
            UPDATE expenses SET
                expense_group_id = $1,
                expense_category_id = $2,
                payer_id = $3,
                payment_mode_id = $4,
                date = $5,
                amount = $6,
                expense_description = $7
            WHERE id = $8
        `;
        const result = await this.dbManager.runCommand(sql, [expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description, id]);
        if (result.changes === 0) {
            throw new Error('Expense not found or no changes made.');
        }
        return { id: parseInt(id), ...expenseData };
    }

    /**
     * Deletes an expense.
     * @param {number} id - The ID of the expense to delete.
     * @returns {Promise<void>}
     * @throws {Error} If the expense is not found.
     */
    async deleteExpense(id) {
        const sql = `DELETE FROM expenses WHERE id = $1`;
        const result = await this.dbManager.runCommand(sql, [id]);
        if (result.changes === 0) {
            throw new Error('Expense not found.');
        }
    }

    // --- findOrCreate methods ---

    async findOrCreateCategory(name) {
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.error('Invalid name provided for findOrCreateCategory:', name);
            // In CsvImporter, we return an error object, but here we throw,
            // CsvImporter's _processRow will catch it and form the error object.
            throw new Error('Category name must be a non-empty string.');
        }
        const trimmedName = name.trim();
        try {
            let result = await this.dbManager.runQuery('SELECT id FROM expense_categories WHERE name = $1', [trimmedName]);
            if (result.length > 0) {
                return { id: result[0].id, name: trimmedName };
            } else {
                // Insert if not found
                // runCommand for INSERT/UPDATE/DELETE typically returns { changes: number, lastID: number (for inserts) }
                // or similar based on the db driver wrapper in dbManager.
                // We need the ID. If lastID is not directly returned, RETURNING id is crucial.
                const insertResultRows = await this.dbManager.runQuery('INSERT INTO expense_categories (name) VALUES ($1) RETURNING id', [trimmedName]);
                if (insertResultRows.length > 0 && typeof insertResultRows[0].id !== 'undefined') {
                    return { id: insertResultRows[0].id, name: trimmedName };
                } else {
                    // This block might be hit if RETURNING id is not supported/configured correctly OR if insert failed silently (unlikely for INSERT)
                    console.warn(`Category '${trimmedName}' not found after insert attempt (or ID not returned), re-querying.`);
                    result = await this.dbManager.runQuery('SELECT id FROM expense_categories WHERE name = $1', [trimmedName]);
                    if (result.length > 0) {
                        return { id: result[0].id, name: trimmedName };
                    }
                    throw new Error(`Failed to create or find category '${trimmedName}' after insert attempt.`);
                }
            }
        } catch (error) {
            console.error(`Error in findOrCreateCategory for '${trimmedName}':`, error);
            // Check for unique constraint violation (specific error code depends on DB, e.g., '23505' for PostgreSQL)
            if (error.code === '23505') { // Example for PostgreSQL unique violation
                console.warn(`Unique constraint violation for category '${trimmedName}', attempting to re-fetch.`);
                const result = await this.dbManager.runQuery('SELECT id FROM expense_categories WHERE name = $1', [trimmedName]);
                if (result.length > 0) {
                    return { id: result[0].id, name: trimmedName };
                }
            }
            throw error; // Re-throw if not a known race condition or if re-fetch fails
        }
    }

    async findOrCreateExpenseGroup(name) {
        if (!name || typeof name !== 'string' || name.trim() === '') {
            // For optional fields in CSV importer, this check might be too strict if an empty string implies "no group"
            // CsvImporter handles empty strings by not calling this, or passing null.
            // If it can be called with null/empty for "no entity", it should return null.
            // For now, assuming name is expected if called.
             console.warn('Empty or invalid name provided for findOrCreateExpenseGroup, returning null.');
             return null; // Or throw new Error('Expense Group name must be a non-empty string.');
        }
        const trimmedName = name.trim();
        if (trimmedName === '') return null; // Explicitly return null if trimmed name is empty

        try {
            let result = await this.dbManager.runQuery('SELECT id FROM expense_groups WHERE name = $1', [trimmedName]);
            if (result.length > 0) {
                return { id: result[0].id, name: trimmedName };
            } else {
                const insertResultRows = await this.dbManager.runQuery('INSERT INTO expense_groups (name) VALUES ($1) RETURNING id', [trimmedName]);
                if (insertResultRows.length > 0 && typeof insertResultRows[0].id !== 'undefined') {
                    return { id: insertResultRows[0].id, name: trimmedName };
                } else {
                    console.warn(`Expense Group '${trimmedName}' not found after insert attempt, re-querying.`);
                    result = await this.dbManager.runQuery('SELECT id FROM expense_groups WHERE name = $1', [trimmedName]);
                    if (result.length > 0) {
                        return { id: result[0].id, name: trimmedName };
                    }
                    throw new Error(`Failed to create or find Expense Group '${trimmedName}' after insert attempt.`);
                }
            }
        } catch (error) {
            console.error(`Error in findOrCreateExpenseGroup for '${trimmedName}':`, error);
            if (error.code === '23505') {
                console.warn(`Unique constraint violation for Expense Group '${trimmedName}', attempting to re-fetch.`);
                const result = await this.dbManager.runQuery('SELECT id FROM expense_groups WHERE name = $1', [trimmedName]);
                if (result.length > 0) {
                    return { id: result[0].id, name: trimmedName };
                }
            }
            throw error;
        }
    }

    async findOrCreatePayer(name) {
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.warn('Empty or invalid name provided for findOrCreatePayer, returning null.');
            return null;
        }
        const trimmedName = name.trim();
        if (trimmedName === '') return null;

        try {
            let result = await this.dbManager.runQuery('SELECT id FROM payers WHERE name = $1', [trimmedName]);
            if (result.length > 0) {
                return { id: result[0].id, name: trimmedName };
            } else {
                const insertResultRows = await this.dbManager.runQuery('INSERT INTO payers (name) VALUES ($1) RETURNING id', [trimmedName]);
                if (insertResultRows.length > 0 && typeof insertResultRows[0].id !== 'undefined') {
                    return { id: insertResultRows[0].id, name: trimmedName };
                } else {
                    console.warn(`Payer '${trimmedName}' not found after insert attempt, re-querying.`);
                    result = await this.dbManager.runQuery('SELECT id FROM payers WHERE name = $1', [trimmedName]);
                    if (result.length > 0) {
                        return { id: result[0].id, name: trimmedName };
                    }
                    throw new Error(`Failed to create or find Payer '${trimmedName}' after insert attempt.`);
                }
            }
        } catch (error) {
            console.error(`Error in findOrCreatePayer for '${trimmedName}':`, error);
            if (error.code === '23505') {
                console.warn(`Unique constraint violation for Payer '${trimmedName}', attempting to re-fetch.`);
                const result = await this.dbManager.runQuery('SELECT id FROM payers WHERE name = $1', [trimmedName]);
                if (result.length > 0) {
                    return { id: result[0].id, name: trimmedName };
                }
            }
            throw error;
        }
    }

    async findOrCreatePaymentMode(name) {
        // Table name is 'payment_mode'
        if (!name || typeof name !== 'string' || name.trim() === '') {
            console.warn('Empty or invalid name provided for findOrCreatePaymentMode, returning null.');
            return null;
        }
        const trimmedName = name.trim();
        if (trimmedName === '') return null;

        try {
            let result = await this.dbManager.runQuery('SELECT id FROM payment_mode WHERE name = $1', [trimmedName]);
            if (result.length > 0) {
                return { id: result[0].id, name: trimmedName };
            } else {
                const insertResultRows = await this.dbManager.runQuery('INSERT INTO payment_mode (name) VALUES ($1) RETURNING id', [trimmedName]);
                if (insertResultRows.length > 0 && typeof insertResultRows[0].id !== 'undefined') {
                    return { id: insertResultRows[0].id, name: trimmedName };
                } else {
                    console.warn(`Payment Mode '${trimmedName}' not found after insert attempt, re-querying.`);
                    result = await this.dbManager.runQuery('SELECT id FROM payment_mode WHERE name = $1', [trimmedName]);
                    if (result.length > 0) {
                        return { id: result[0].id, name: trimmedName };
                    }
                    throw new Error(`Failed to create or find Payment Mode '${trimmedName}' after insert attempt.`);
                }
            }
        } catch (error) {
            console.error(`Error in findOrCreatePaymentMode for '${trimmedName}':`, error);
            if (error.code === '23505') {
                console.warn(`Unique constraint violation for Payment Mode '${trimmedName}', attempting to re-fetch.`);
                const result = await this.dbManager.runQuery('SELECT id FROM payment_mode WHERE name = $1', [trimmedName]);
                if (result.length > 0) {
                    return { id: result[0].id, name: trimmedName };
                }
            }
            throw error;
        }
    }

    // --- End of findOrCreate methods ---

    async getAnalyticsData(filters = {}) {
        let overallTotal = 0;
        let totalFilteredCount = 0;
        const categoryBreakdown = [];
        const categoryTotals = {};
        // categoryNames map is no longer needed as category_name is directly available in rows.

        let sql = `
            SELECT
                e.id,
                e.date,
                e.amount,
                e.expense_description,
                eg.name AS group_name,
                ec.name AS category_name,
                p.name AS payer_name,
                pm.name AS payment_mode_name,
                e.expense_group_id,
                e.expense_category_id,
                e.payer_id,
                e.payment_mode_id
            FROM expenses e
            JOIN expense_groups eg ON e.expense_group_id = eg.id
            JOIN expense_categories ec ON e.expense_category_id = ec.id
            JOIN payers p ON e.payer_id = p.id
            JOIN payment_mode pm ON e.payment_mode_id = pm.id
        `;

        const params = [];
        const whereClauses = [];
        let paramIndex = 1;

        // Date filters
        if (filters.startDate && filters.endDate) {
            whereClauses.push(`e.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            params.push(filters.startDate, filters.endDate);
        } else if (filters.startDate) {
            whereClauses.push(`e.date >= $${paramIndex++}`);
            params.push(filters.startDate);
        } else if (filters.endDate) {
            whereClauses.push(`e.date <= $${paramIndex++}`);
            params.push(filters.endDate);
        }

        // Category ID filters
        let categoryIds = filters.categoryIds;
        if (categoryIds) {
            if (typeof categoryIds === 'string') {
                categoryIds = categoryIds.trim() === '' ? [] : categoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                whereClauses.push(`e.expense_category_id IN (${categoryIds.map(() => `$${paramIndex++}`).join(',')})`);
                params.push(...categoryIds);
            }
        }
        
        // Payment Mode ID filters
        let paymentModeIds = filters.paymentModeIds;
        if (paymentModeIds) {
            if (typeof paymentModeIds === 'string') {
                paymentModeIds = paymentModeIds.trim() === '' ? [] : paymentModeIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(paymentModeIds) && paymentModeIds.length > 0) {
                whereClauses.push(`e.payment_mode_id IN (${paymentModeIds.map(() => `$${paramIndex++}`).join(',')})`);
                params.push(...paymentModeIds);
            }
        }

        // Group ID filters
        let groupIds = filters.groupIds;
        if (groupIds) {
            if (typeof groupIds === 'string') {
                groupIds = groupIds.trim() === '' ? [] : groupIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(groupIds) && groupIds.length > 0) {
                whereClauses.push(`e.expense_group_id IN (${groupIds.map(() => `$${paramIndex++}`).join(',')})`);
                params.push(...groupIds);
            }
        }

        // Payer ID filters
        let payerIds = filters.payerIds;
        if (payerIds) {
            if (typeof payerIds === 'string') {
                payerIds = payerIds.trim() === '' ? [] : payerIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(payerIds) && payerIds.length > 0) {
                whereClauses.push(`e.payer_id IN (${payerIds.map(() => `$${paramIndex++}`).join(',')})`);
                params.push(...payerIds);
            }
        }

        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        // Add ORDER BY to make the list of expenses consistent
        sql += ` ORDER BY e.date DESC`;

        const rows = await this.dbManager.runQuery(sql, params);
        const filteredExpenses = rows; // These are the detailed expenses

        if (rows && rows.length > 0) {
            totalFilteredCount = rows.length;
            rows.forEach(row => {
                overallTotal += row.amount;
                // For category breakdown, use expense_category_id and category_name from the row
                const categoryId = row.expense_category_id;
                categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) + row.amount;
                // categoryNames map is no longer needed
            });
        }

        for (const categoryId in categoryTotals) {
            const totalAmount = categoryTotals[categoryId];
            const percentage = overallTotal === 0 ? 0 : (totalAmount / overallTotal) * 100;
            // Find a representative row for the category name
            const representativeRow = rows.find(r => r.expense_category_id == categoryId);
            categoryBreakdown.push({
                categoryId: parseInt(categoryId),
                categoryName: representativeRow ? representativeRow.category_name : 'Unknown Category', // Fallback
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                percentage: parseFloat(percentage.toFixed(2))
            });
        }
        
        categoryBreakdown.sort((a, b) => b.totalAmount - a.totalAmount);

        return {
            overallTotal: parseFloat(overallTotal.toFixed(2)),
            totalFilteredCount,
            categoryBreakdown,
            filteredExpenses // Add the new field
        };
    }
}

module.exports = ExpenseRepository;
