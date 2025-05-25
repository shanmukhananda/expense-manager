// server/server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = 3000;

let db; // Database instance

// Middleware
app.use(bodyParser.json()); // To parse JSON request bodies
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files from the 'public' directory

// --- API Endpoints ---

// Endpoint to initialize/check database (called by frontend on load)
app.get('/api/init-db', async (req, res) => {
    try {
        if (!db) {
            db = await initializeDatabase();
        }
        res.status(200).send({ message: 'Database initialized and ready.' });
    } catch (error) {
        console.error('Failed to initialize database:', error);
        res.status(500).json({ error: 'Failed to initialize database.' });
    }
});

// Generic CRUD functions for master data (Groups, Categories, Payers, Payment Modes)
// These functions abstract the common logic for these tables.

/**
 * Executes a database query and returns results.
 * @param {string} sql - SQL query string.
 * @param {Array<any>} params - Parameters for the SQL query.
 * @returns {Promise<Array<Object>>} Promise resolving to query results.
 */
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Executes a database run command (INSERT, UPDATE, DELETE).
 * @param {string} sql - SQL query string.
 * @param {Array<any>} params - Parameters for the SQL query.
 * @returns {Promise<{ id?: number, changes: number }>} Promise resolving to lastID for inserts, changes for update/delete.
 */
function runCommand(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

/**
 * Checks if an entity is referenced by any expenses.
 * @param {string} fkColumnName - The foreign key column name in the Expenses table (e.g., 'expense_group_id').
 * @param {number} entityId - The ID of the entity to check.
 * @returns {Promise<boolean>} True if referenced, false otherwise.
 */
async function isEntityReferenced(fkColumnName, entityId) {
    const sql = `SELECT COUNT(*) AS count FROM Expenses WHERE ${fkColumnName} = ?`;
    const rows = await runQuery(sql, [entityId]);
    return rows[0].count > 0;
}

// --- Expense Groups Endpoints ---
app.get('/api/groups', async (req, res) => {
    try {
        const groups = await runQuery('SELECT * FROM ExpenseGroups');
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/groups', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Group name is required.' });
    }
    try {
        const result = await runCommand('INSERT INTO ExpenseGroups (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.id, name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Group name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/groups/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'New group name is required.' });
    }
    try {
        const result = await runCommand('UPDATE ExpenseGroups SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Group not found.' });
        }
        res.json({ id: parseInt(id), name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Group name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/groups/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const referenced = await isEntityReferenced('expense_group_id', id);
        if (referenced) {
            return res.status(409).json({ error: 'Cannot delete group: it is associated with existing expenses.' });
        }
        const result = await runCommand('DELETE FROM ExpenseGroups WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Group not found.' });
        }
        res.status(204).send(); // No content
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Expense Categories Endpoints ---
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await runQuery('SELECT * FROM ExpenseCategories');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Category name is required.' });
    }
    try {
        const result = await runCommand('INSERT INTO ExpenseCategories (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.id, name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Category name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'New category name is required.' });
    }
    try {
        const result = await runCommand('UPDATE ExpenseCategories SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Category not found.' });
        }
        res.json({ id: parseInt(id), name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Category name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const referenced = await isEntityReferenced('expense_category_id', id);
        if (referenced) {
            return res.status(409).json({ error: 'Cannot delete category: it is associated with existing expenses.' });
        }
        const result = await runCommand('DELETE FROM ExpenseCategories WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Category not found.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Payers Endpoints ---
app.get('/api/payers', async (req, res) => {
    try {
        const payers = await runQuery('SELECT * FROM Payers');
        res.json(payers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payers', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Payer name is required.' });
    }
    try {
        const result = await runCommand('INSERT INTO Payers (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.id, name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Payer name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/payers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'New payer name is required.' });
    }
    try {
        const result = await runCommand('UPDATE Payers SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Payer not found.' });
        }
        res.json({ id: parseInt(id), name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Payer name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/payers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const referenced = await isEntityReferenced('payer_id', id);
        if (referenced) {
            return res.status(409).json({ error: 'Cannot delete payer: it is associated with existing expenses.' });
        }
        const result = await runCommand('DELETE FROM Payers WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Payer not found.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Payment Modes Endpoints ---
app.get('/api/payment-modes', async (req, res) => {
    try {
        const paymentModes = await runQuery('SELECT * FROM PaymentMode');
        res.json(paymentModes);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/payment-modes', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Payment mode name is required.' });
    }
    try {
        const result = await runCommand('INSERT INTO PaymentMode (name) VALUES (?)', [name]);
        res.status(201).json({ id: result.id, name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Payment mode name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/payment-modes/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'New payment mode name is required.' });
    }
    try {
        const result = await runCommand('UPDATE PaymentMode SET name = ? WHERE id = ?', [name, id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Payment mode not found.' });
        }
        res.json({ id: parseInt(id), name });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: 'Payment mode name already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/payment-modes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const referenced = await isEntityReferenced('payment_mode_id', id);
        if (referenced) {
            return res.status(409).json({ error: 'Cannot delete payment mode: it is associated with existing expenses.' });
        }
        const result = await runCommand('DELETE FROM PaymentMode WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Payment mode not found.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Expenses Endpoints ---
app.get('/api/expenses', async (req, res) => {
    try {
        // Join with other tables to get names for display
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
        const expenses = await runQuery(sql);
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description } = req.body;
    if (!expense_group_id || !expense_category_id || !payer_id || !payment_mode_id || !date || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'All required expense fields must be provided.' });
    }
    try {
        const result = await runCommand(
            'INSERT INTO Expenses (expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description]
        );
        res.status(201).json({ id: result.id, ...req.body });
    } catch (err) {
        // Handle foreign key constraint errors if they occur (though schema.sql should prevent this)
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            res.status(400).json({ error: 'Invalid group, category, payer, or payment mode ID.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description } = req.body;

    if (!expense_group_id || !expense_category_id || !payer_id || !payment_mode_id || !date || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'All required expense fields must be provided for update.' });
    }

    try {
        const result = await runCommand(
            'UPDATE Expenses SET expense_group_id = ?, expense_category_id = ?, payer_id = ?, payment_mode_id = ?, date = ?, amount = ?, expense_description = ? WHERE id = ?',
            [expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount, expense_description, id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found or no changes made.' });
        }
        res.json({ id: parseInt(id), ...req.body });
    } catch (err) {
        if (err.message.includes('FOREIGN KEY constraint failed')) {
            res.status(400).json({ error: 'Invalid group, category, payer, or payment mode ID provided for update.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});


app.delete('/api/expenses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await runCommand('DELETE FROM Expenses WHERE id = ?', [id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Initialize database and start server
initializeDatabase()
    .then((databaseInstance) => {
        db = databaseInstance;
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to start server due to database error:', err);
    });