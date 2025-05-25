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
}

module.exports = ExpenseRepository;