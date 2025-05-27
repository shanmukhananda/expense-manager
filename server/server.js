// server/server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const getDatabaseManager = require('./database'); // Import the factory function

const AuxDataRepository = require('./repositories/aux-data-repository');
const ExpenseRepository = require('./repositories/expense-repository');

class ExpenseManagerServer {
    /**
     * Initializes the ExpenseManagerServer.
     * @param {DatabaseManager} dbManager - The pre-instantiated DatabaseManager instance.
     * @param {number} port - The port to run the server on.
     */
    constructor(dbManager, port) {
        this.app = express();
        this.port = port;
        this.dbManager = dbManager; // Assign the passed-in instance to the class property

        // Repositories - these now correctly use the injected dbManager instance
        this.groupRepository = new AuxDataRepository(this.dbManager, 'ExpenseGroups', 'expense_group_id');
        this.categoryRepository = new AuxDataRepository(this.dbManager, 'ExpenseCategories', 'expense_category_id');
        this.payerRepository = new AuxDataRepository(this.dbManager, 'Payers', 'payer_id');
        this.paymentModeRepository = new AuxDataRepository(this.dbManager, 'PaymentMode', 'payment_mode_id');
        this.expenseRepository = new ExpenseRepository(this.dbManager);

        this._setupMiddleware();
        this._setupRoutes();
    }

    _setupMiddleware() {
        this.app.use(bodyParser.json());
        // Serve static files from the 'public' directory
        this.app.use(express.static(path.join(__dirname, '../public')));
    }

    _setupRoutes() {
        // Endpoint to initialize/check database (called by frontend on load)
        this.app.get('/api/init-db', this._handleInitDb.bind(this));

        // Generic CRUD routes for master data using repositories
        this.app.get('/api/groups', this._handleGetAll.bind(this, this.groupRepository));
        this.app.post('/api/groups', this._handleAdd.bind(this, this.groupRepository));
        this.app.put('/api/groups/:id', this._handleUpdate.bind(this, this.groupRepository));
        this.app.delete('/api/groups/:id', this._handleDelete.bind(this, this.groupRepository));

        this.app.get('/api/categories', this._handleGetAll.bind(this, this.categoryRepository));
        this.app.post('/api/categories', this._handleAdd.bind(this, this.categoryRepository));
        this.app.put('/api/categories/:id', this._handleUpdate.bind(this, this.categoryRepository));
        this.app.delete('/api/categories/:id', this._handleDelete.bind(this, this.categoryRepository));

        this.app.get('/api/payers', this._handleGetAll.bind(this, this.payerRepository));
        this.app.post('/api/payers', this._handleAdd.bind(this, this.payerRepository));
        this.app.put('/api/payers/:id', this._handleUpdate.bind(this, this.payerRepository));
        this.app.delete('/api/payers/:id', this._handleDelete.bind(this, this.payerRepository));

        this.app.get('/api/payment-modes', this._handleGetAll.bind(this, this.paymentModeRepository));
        this.app.post('/api/payment-modes', this._handleAdd.bind(this, this.paymentModeRepository));
        this.app.put('/api/payment-modes/:id', this._handleUpdate.bind(this, this.paymentModeRepository));
        this.app.delete('/api/payment-modes/:id', this._handleDelete.bind(this, this.paymentModeRepository));

        // Expense specific routes using ExpenseRepository
        this.app.get('/api/expenses', this._handleGetAllExpenses.bind(this));
        this.app.post('/api/expenses', this._handleAddExpense.bind(this));
        this.app.put('/api/expenses/:id', this._handleUpdateExpense.bind(this));
        this.app.delete('/api/expenses/:id', this._handleDeleteExpense.bind(this));
        this.app.get('/api/expenses/analytics', this._handleGetAnalyticsData.bind(this));
    }

    /**
     * Handles the initial database setup request.
     */
    async _handleInitDb(req, res) {
        try {
            await this.dbManager.initialize();
            res.status(200).send({ message: 'Database initialized and ready.' });
        } catch (error) {
            console.error('Failed to initialize database:', error);
            res.status(500).json({ error: 'Failed to initialize database.' });
        }
    }

    /**
     * Generic handler for fetching all records from a repository.
     */
    async _handleGetAll(repository, req, res) {
        try {
            const data = await repository.getAll();
            res.json(data);
        } catch (err) {
            console.error(`Error fetching from ${repository.tableName}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    }

    /**
     * Generic handler for adding a new record via a repository.
     */
    async _handleAdd(repository, req, res) {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        try {
            const newEntity = await repository.add(name);
            res.status(201).json(newEntity);
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ error: `${repository.tableName.slice(0, -1)} with this name already exists.` });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    /**
     * Generic handler for updating an existing record via a repository.
     */
    async _handleUpdate(repository, req, res) {
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        try {
            const updatedEntity = await repository.update(id, name);
            res.json(updatedEntity);
        } catch (err) {
            if (err.message.includes('not found or no changes made')) {
                res.status(404).json({ error: err.message });
            } else if (err.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ error: `${repository.tableName.slice(0, -1)} with this name already exists.` });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    /**
     * Generic handler for deleting a record via a repository.
     */
    async _handleDelete(repository, req, res) {
        const { id } = req.params;
        try {
            await repository.delete(id);
            res.status(204).send(); // No content for successful deletion
        } catch (err) {
            if (err.message.includes('not found')) {
                res.status(404).json({ error: err.message });
            } else if (err.message.includes('associated with existing expenses')) {
                res.status(400).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    // Expense specific handlers, utilizing ExpenseRepository
    async _handleGetAllExpenses(req, res) {
        try {
            const expenses = await this.expenseRepository.getAllExpenses();
            res.json(expenses);
        } catch (err) {
            console.error('Error fetching expenses:', err.message);
            res.status(500).json({ error: err.message });
        }
    }

    async _handleAddExpense(req, res) {
        const expenseData = req.body;
        if (!this._validateExpenseData(expenseData, res)) {
            return; // Validation failed, response sent by _validateExpenseData
        }
        try {
            const newExpense = await this.expenseRepository.addExpense(expenseData);
            res.status(201).json(newExpense);
        } catch (err) {
            if (err.message.includes('FOREIGN KEY constraint failed')) {
                res.status(400).json({ error: 'Invalid group, category, payer, or payment mode ID provided.' });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    async _handleUpdateExpense(req, res) {
        const { id } = req.params;
        const expenseData = req.body;
        if (!this._validateExpenseData(expenseData, res, true)) {
            return; // Validation failed, response sent by _validateExpenseData
        }
        try {
            const updatedExpense = await this.expenseRepository.updateExpense(id, expenseData);
            res.json(updatedExpense);
        } catch (err) {
            if (err.message.includes('not found or no changes made')) {
                res.status(404).json({ error: err.message });
            } else if (err.message.includes('FOREIGN KEY constraint failed')) {
                res.status(400).json({ error: 'Invalid group, category, payer, or payment mode ID provided for update.' });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    async _handleDeleteExpense(req, res) {
        const { id } = req.params;
        try {
            await this.expenseRepository.deleteExpense(id);
            res.status(204).send();
        } catch (err) {
            if (err.message.includes('not found')) {
                res.status(404).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    async _handleGetAnalyticsData(req, res) {
        try {
            // req.query contains the filter parameters from the frontend
            // These are already strings, including comma-separated strings for IDs
            const filters = req.query; 
            
            const analyticsData = await this.expenseRepository.getAnalyticsData(filters);
            res.json(analyticsData);
        } catch (err) {
            console.error('Error fetching analytics data:', err.message);
            res.status(500).json({ error: `Failed to retrieve analytics data: ${err.message}` });
        }
    }

    /**
     * Validates expense data for both creation and update operations.
     * @private
     */
    _validateExpenseData(expenseData, res, isUpdate = false) {
        const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount } = expenseData;
        if (!expense_group_id || !expense_category_id || !payer_id || !payment_mode_id || !date || amount === undefined || amount === null) {
            const message = isUpdate ? 'All required expense fields must be provided for update.' : 'All required expense fields must be provided.';
            res.status(400).json({ error: message });
            return false;
        }
        return true;
    }

    /**
     * Starts the Express server.
     */
    async start() {
        try {
            await this.dbManager.initialize(); // Initialize the database using the injected instance
            this.app.listen(this.port, () => {
                console.log(`Server running on http://localhost:${this.port}`);
            });
        } catch (err) {
            console.error('Failed to start server due to database error:', err);
            process.exit(1);
        }
    }
}

/**
 * Initializes and starts the Expense Manager server.
 */
async function main() {
    const dbManager = getDatabaseManager(); // Create a DatabaseManager instance
    const PORT = 3000;

    const server = new ExpenseManagerServer(dbManager, PORT);

    try {
        await server.start(); // server.start() itself handles db initialization and listening
    } catch (error) {
        // This catch is a fallback, server.start() has its own process.exit on critical failure
        console.error('Critical error during server startup:', error);
        process.exit(1);
    }
}

main();