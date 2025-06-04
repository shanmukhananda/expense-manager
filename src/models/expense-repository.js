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
