// server/repositories/ExpenseRepository.js
class ExpenseRepository {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Fetches all expenses with joined details.
     * @returns {Promise<Array<Object>>}
     */
    async getAllExpenses() {
        const sql = `
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
            FROM Expenses e
            JOIN ExpenseGroups eg ON e.expense_group_id = eg.id
            JOIN ExpenseCategories ec ON e.expense_category_id = ec.id
            JOIN Payers p ON e.payer_id = p.id
            JOIN PaymentMode pm ON e.payment_mode_id = pm.id
            ORDER BY e.date DESC
        `;
        return this.dbManager.runQuery(sql);
    }

    /**
     * Adds a new expense.
     * @param {Object} expenseData - The expense data.
     * @returns {Promise<Object>} The created expense with its ID.
     */
    async addExpense(expenseData) {
        const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description } = expenseData;
        const sql = `
            INSERT INTO Expenses (expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
            UPDATE Expenses SET
                expense_group_id = ?,
                expense_category_id = ?,
                payer_id = ?,
                payment_mode_id = ?,
                date = ?,
                amount = ?,
                expense_description = ?
            WHERE id = ?
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
        const sql = `DELETE FROM Expenses WHERE id = ?`;
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
        const categoryNames = {};

        let sql = `
            SELECT
                e.amount,
                ec.id AS category_id,
                ec.name AS category_name
            FROM Expenses e
            JOIN ExpenseCategories ec ON e.expense_category_id = ec.id
        `;

        const params = [];
        const whereClauses = [];

        // Date filters
        if (filters.startDate && filters.endDate) {
            whereClauses.push('e.date BETWEEN ? AND ?');
            params.push(filters.startDate, filters.endDate);
        } else if (filters.startDate) {
            whereClauses.push('e.date >= ?');
            params.push(filters.startDate);
        } else if (filters.endDate) {
            whereClauses.push('e.date <= ?');
            params.push(filters.endDate);
        }

        // Category ID filters
        let categoryIds = filters.categoryIds;
        if (categoryIds) {
            if (typeof categoryIds === 'string') {
                categoryIds = categoryIds.trim() === '' ? [] : categoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id) && id !== null);
            }
            if (Array.isArray(categoryIds) && categoryIds.length > 0) {
                whereClauses.push(`e.expense_category_id IN (${categoryIds.map(() => '?').join(',')})`);
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
                whereClauses.push(`e.payment_mode_id IN (${paymentModeIds.map(() => '?').join(',')})`);
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
                whereClauses.push(`e.expense_group_id IN (${groupIds.map(() => '?').join(',')})`);
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
                whereClauses.push(`e.payer_id IN (${payerIds.map(() => '?').join(',')})`);
                params.push(...payerIds);
            }
        }

        if (whereClauses.length > 0) {
            sql += ' WHERE ' + whereClauses.join(' AND ');
        }

        const rows = await this.dbManager.runQuery(sql, params);

        if (rows && rows.length > 0) {
            totalFilteredCount = rows.length; 
            rows.forEach(row => {
                overallTotal += row.amount;
                categoryTotals[row.category_id] = (categoryTotals[row.category_id] || 0) + row.amount;
                if (!categoryNames[row.category_id]) { 
                    categoryNames[row.category_id] = row.category_name;
                }
            });
        }

        for (const categoryId in categoryTotals) {
            const totalAmount = categoryTotals[categoryId];
            const percentage = overallTotal === 0 ? 0 : (totalAmount / overallTotal) * 100;
            categoryBreakdown.push({
                categoryId: parseInt(categoryId),
                categoryName: categoryNames[categoryId],
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
}

module.exports = ExpenseRepository;
