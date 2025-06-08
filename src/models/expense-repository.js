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

    _buildAnalyticsQuery(filters = {}) {
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

        // Helper function to process and add ID-based filters
        const addIdFilter = (filterValue, columnName) => {
            let ids = filterValue;
            if (typeof ids === 'string') {
                ids = ids.trim() === '' ? [] : ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(ids) && ids.length > 0) {
                whereClauses.push(`${columnName} IN (${ids.map(() => `$${paramIndex++}`).join(',')})`);
                params.push(...ids);
            }
        };

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

        addIdFilter(filters.categoryIds, 'e.expense_category_id');
        addIdFilter(filters.paymentModeIds, 'e.payment_mode_id');
        addIdFilter(filters.groupIds, 'e.expense_group_id');
        addIdFilter(filters.payerIds, 'e.payer_id');

        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }
        sql += ` ORDER BY e.date DESC`;
        return { sql, params };
    }

    _aggregateAnalyticsData(rows) {
        let overallTotal = 0;
        const categoryTotals = {};
        const categoryBreakdown = [];

        if (!rows || rows.length === 0) {
            return {
                overallTotal: 0,
                totalFilteredCount: 0,
                categoryBreakdown: []
            };
        }

        const totalFilteredCount = rows.length;
        rows.forEach(row => {
            overallTotal += row.amount;
            const categoryId = row.expense_category_id;
            categoryTotals[categoryId] = (categoryTotals[categoryId] || 0) + row.amount;
        });

        for (const categoryId in categoryTotals) {
            const totalAmount = categoryTotals[categoryId];
            const percentage = overallTotal === 0 ? 0 : (totalAmount / overallTotal) * 100;
            const representativeRow = rows.find(r => r.expense_category_id == categoryId); // Safe due to rows.length check
            categoryBreakdown.push({
                categoryId: parseInt(categoryId),
                categoryName: representativeRow ? representativeRow.category_name : 'Unknown Category',
                totalAmount: parseFloat(totalAmount.toFixed(2)),
                percentage: parseFloat(percentage.toFixed(2))
            });
        }
        
        categoryBreakdown.sort((a, b) => b.totalAmount - a.totalAmount);

        return {
            overallTotal: parseFloat(overallTotal.toFixed(2)),
            totalFilteredCount,
            categoryBreakdown
        };
    }

    async getAnalyticsData(filters = {}) {
        const { sql, params } = this._buildAnalyticsQuery(filters);
        const rows = await this.dbManager.runQuery(sql, params);

        const aggregatedData = this._aggregateAnalyticsData(rows);

        return {
            ...aggregatedData,
            filteredExpenses: rows // The raw rows are the filtered expenses
        };
    }
}

module.exports = ExpenseRepository;
