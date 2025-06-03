// src/controllers/main_controller.js

const path = require('path'); // Kept for now, though its main use in _setupMiddleware is removed.
const AuxDataRepository = require('../models/aux-data-repository');
const ExpenseRepository = require('../models/expense-repository');
// getDatabaseManager is not used here as dbManager is injected
// express and bodyParser are not required here as app is injected and middleware is handled in the main server file.

class ExpenseManagerServerController {
    constructor(dbManager, app) {
        this.app = app;
        this.dbManager = dbManager;

        this.groupRepository = new AuxDataRepository(this.dbManager, 'expense_groups', 'expense_group_id');
        this.categoryRepository = new AuxDataRepository(this.dbManager, 'expense_categories', 'expense_category_id');
        this.payerRepository = new AuxDataRepository(this.dbManager, 'payers', 'payer_id');
        this.paymentModeRepository = new AuxDataRepository(this.dbManager, 'payment_mode', 'payment_mode_id');
        this.expenseRepository = new ExpenseRepository(this.dbManager);

        this._setupRoutes();
    }

    _setupRoutes() {
        // --- Database Connection Routes ---
        this.app.post('/api/db/connect', this._handleDbConnect.bind(this));
        this.app.post('/api/db/disconnect', this._handleDbDisconnect.bind(this));
        this.app.get('/api/db/status', this._handleDbStatus.bind(this));

        // Endpoint to initialize/check database (called by frontend on load)
        // This might be deprecated or behave differently now. For now, keep it but guard it.
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

    // --- New Database Control Handlers ---
    async _handleDbConnect(req, res) {
        const { connectionString } = req.body;
        if (!connectionString) {
            return res.status(400).json({ success: false, message: 'Connection string is required.' });
        }
        try {
            // If already connected, this.dbManager.initialize should handle closing the old pool
            // and opening a new one. This depends on DatabaseManager's implementation.
            // For safety, one might explicitly call this.dbManager.close() first if defined.
            if (this.dbManager.pool) {
                 console.log("DB Connect: Existing pool found, attempting to close before reconnecting.");
                 await this.dbManager.close(); // Assuming close is graceful if no pool exists
            }
            await this.dbManager.initialize(connectionString); // Assumes initialize can take a string
            res.json({ success: true, message: 'Database connected successfully.' });
        } catch (err) {
            console.error('Failed to connect to database:', err);
            res.status(500).json({ success: false, message: 'Failed to connect to database.', error: err.message });
        }
    }

    async _handleDbDisconnect(req, res) {
        try {
            if (this.dbManager.pool) {
                await this.dbManager.close();
            }
            res.json({ success: true, message: 'Database disconnected successfully.' });
        } catch (err) {
            console.error('Failed to disconnect from database:', err);
            res.status(500).json({ success: false, message: 'Failed to disconnect from database.', error: err.message });
        }
    }

    async _handleDbStatus(req, res) {
        // Check if dbManager.pool is not null and has some indication of being active.
        // The exact check might depend on the pg library's pool object structure.
        // A simple check for pool existence is a starting point.
        const isConnected = !!this.dbManager.pool;
        res.json({ connected: isConnected });
    }

    /**
     * Handles the initial database setup request.
     * NOTE: This endpoint's role might change. If the DB is connected via /api/db/connect,
     * this might just be a status check or be deprecated.
     */
    async _handleInitDb(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first via /api/db/connect.' });
        }
        try {
            // If dbManager.pool exists, assume it's initialized.
            res.status(200).send({ message: 'Database connection is active and schema should be initialized.' });
        } catch (error) {
            console.error('Database readiness check failed (though pool exists):', error);
            res.status(500).json({ error: 'Database readiness check failed.' });
        }
    }

    /**
     * Generic handler for fetching all records from a repository.
     */
    async _handleGetAll(repository, req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
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
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        try {
            const newEntity = await repository.add(name);
            res.status(201).json(newEntity);
        } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) { // Fallback for safety
            res.status(409).json({ error: `${repository.tableName.slice(0, -1)} with this name already exists.` }); // Consider singularizing tableName more robustly
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    /**
     * Generic handler for updating an existing record via a repository.
     */
    async _handleUpdate(repository, req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { id } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        try {
            const updatedEntity = await repository.update(id, name);
            res.json(updatedEntity);
        } catch (err) {
        if (err.message && err.message.includes('not found or no changes made')) { // Custom error from repository
                res.status(404).json({ error: err.message });
        } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
            res.status(409).json({ error: `${repository.tableName.slice(0, -1)} with this name already exists.` }); // Consider singularizing tableName
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    /**
     * Generic handler for deleting a record via a repository.
     */
    async _handleDelete(repository, req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { id } = req.params;
        try {
            await repository.delete(id);
            res.status(204).send(); // No content for successful deletion
        } catch (err) {
            if (err.message && err.message.includes('not found')) { // Custom error from repository
                res.status(404).json({ error: err.message });
            } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (err.message && err.message.includes('FOREIGN KEY constraint failed')) || (err.message && err.message.includes('associated with existing expenses'))) { // More robust check
                res.status(400).json({ error: err.message });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    // Expense specific handlers, utilizing ExpenseRepository
    async _handleGetAllExpenses(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        try {
            const expenses = await this.expenseRepository.getAllExpenses();
            res.json(expenses);
        } catch (err) {
            console.error('Error fetching expenses:', err.message);
            res.status(500).json({ error: err.message });
        }
    }

    async _handleAddExpense(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const expenseData = req.body;
        if (!this._validateExpenseData(expenseData, res)) {
            return; // Validation failed, response sent by _validateExpenseData
        }
        try {
            const newExpense = await this.expenseRepository.addExpense(expenseData);
            res.status(201).json(newExpense);
        } catch (err) {
            if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (err.message && err.message.includes('FOREIGN KEY constraint failed'))) {
                res.status(400).json({ error: 'Invalid ID provided for group, category, payer, or payment mode.' });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    async _handleUpdateExpense(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { id } = req.params;
        const expenseData = req.body;
        if (!this._validateExpenseData(expenseData, res, true)) {
            return; // Validation failed, response sent by _validateExpenseData
        }
        try {
            const updatedExpense = await this.expenseRepository.updateExpense(id, expenseData);
            res.json(updatedExpense);
        } catch (err) {
            if (err.message && err.message.includes('not found or no changes made')) { // Custom error from repository
                res.status(404).json({ error: err.message });
            } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (err.message && err.message.includes('FOREIGN KEY constraint failed'))) {
                res.status(400).json({ error: 'Invalid ID provided for group, category, payer, or payment mode during update.' });
            } else {
                res.status(500).json({ error: err.message });
            }
        }
    }

    async _handleDeleteExpense(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
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
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
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
}

module.exports = ExpenseManagerServerController;
