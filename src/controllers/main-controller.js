
const path = require('path');
const AuxDataRepository = require('../models/aux-data-repository');
const ExpenseRepository = require('../models/expense-repository');
const CsvService = require('../services/csv-service.js');
const CsvRowParser = require('../services/CsvRowParser.js');
const EntityManager = require('../services/EntityManager.js');

class ExpenseManagerServerController {
    constructor(dbManager, app) {
        this.app = app;
        this.dbManager = dbManager;

        this.groupRepository = new AuxDataRepository(this.dbManager, 'expense_groups', 'expense_group_id');
        this.categoryRepository = new AuxDataRepository(this.dbManager, 'expense_categories', 'expense_category_id');
        this.payerRepository = new AuxDataRepository(this.dbManager, 'payers', 'payer_id');
        this.paymentModeRepository = new AuxDataRepository(this.dbManager, 'payment_mode', 'payment_mode_id');
        this.expenseRepository = new ExpenseRepository(this.dbManager);
        this.csvRowParser = new CsvRowParser();
        this.entityManager = new EntityManager(this.dbManager);
        this.csvService = new CsvService(this.dbManager, this.entityManager, this.csvRowParser);

        this._setupRoutes();
    }

    _setupRoutes() {
        this.app.post('/api/db/connect', this._handleDbConnect.bind(this));
        this.app.post('/api/db/disconnect', this._handleDbDisconnect.bind(this));
        this.app.get('/api/db/status', this._handleDbStatus.bind(this));

        this.app.get('/api/init-db', this._handleInitDb.bind(this));

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

        this.app.get('/api/expenses', this._handleGetAllExpenses.bind(this));
        this.app.post('/api/expenses', this._handleAddExpense.bind(this));
        this.app.put('/api/expenses/:id', this._handleUpdateExpense.bind(this));
        this.app.delete('/api/expenses/:id', this._handleDeleteExpense.bind(this));
        this.app.get('/api/expenses/analytics', this._handleGetAnalyticsData.bind(this));
        this.app.post('/api/csv/import', this._handleCsvImport.bind(this));
        this.app.get('/api/csv/export', this._handleCsvExport.bind(this));
    }

    async _handleDbConnect(req, res) {
        const { connectionString } = req.body;
        if (!connectionString) {
            return res.status(400).json({ success: false, message: 'Connection string is required.' });
        }
        try {
            if (this.dbManager.pool) {
                 console.log("DB Connect: Existing pool found, attempting to close before reconnecting.");
                 await this.dbManager.close();
            }
            await this.dbManager.initialize(connectionString);
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
        const isConnected = !!this.dbManager.pool;
        res.json({ connected: isConnected });
    }

    async _handleInitDb(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first via /api/db/connect.' });
        }
        try {
            res.status(200).send({ message: 'Database connection is active and schema should be initialized.' });
        } catch (error) {
            console.error('Database readiness check failed (though pool exists):', error);
            res.status(500).json({ error: 'Database readiness check failed.' });
        }
    }

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
            this._handleEntityAddError(err, repository, res);
        }
    }

    _handleEntityAddError(err, repository, res) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
            const entityName = repository.tableName.endsWith('s') ? repository.tableName.slice(0, -1) : repository.tableName;
            res.status(409).json({ error: `${entityName} with this name already exists.` });
        } else {
            console.error(`Error adding to ${repository.tableName}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    }

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
            this._handleEntityUpdateError(err, repository, res);
        }
    }

    _handleEntityUpdateError(err, repository, res) {
        if (err.message && err.message.includes('not found or no changes made')) {
            res.status(404).json({ error: err.message });
        } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
            const entityName = repository.tableName.endsWith('s') ? repository.tableName.slice(0, -1) : repository.tableName;
            res.status(409).json({ error: `${entityName} with this name already exists.` });
        } else {
            console.error(`Error updating ${repository.tableName}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    }

    async _handleDelete(repository, req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { id } = req.params;
        try {
            await repository.delete(id);
            res.status(204).send();
        } catch (err) {
            this._handleEntityDeleteError(err, repository, res);
        }
    }

    _handleEntityDeleteError(err, repository, res) {
        if (err.message && err.message.includes('not found')) {
            res.status(404).json({ error: err.message });
        } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' ||
                   (err.message && err.message.includes('FOREIGN KEY constraint failed')) ||
                   (err.message && err.message.includes('associated with existing expenses'))) {
            const entityName = repository.tableName.endsWith('s') ? repository.tableName.slice(0, -1) : repository.tableName;
            res.status(400).json({ error: `Cannot delete this ${entityName} as it is associated with existing expenses or other records. Original: ${err.message}` });
        } else {
            console.error(`Error deleting from ${repository.tableName}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    }

    async _handleGetAllExpenses(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        try {
            const expenses = await this.expenseRepository.getAllExpenses(true);
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
            return;
        }
        try {
            const newExpense = await this.expenseRepository.addExpense(expenseData);
            res.status(201).json(newExpense);
        } catch (err) {
            this._handleExpenseForeignKeyError(err, res, 'add');
        }
    }

    _handleExpenseForeignKeyError(err, res, operationType = 'process') {
        if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || (err.message && err.message.includes('FOREIGN KEY constraint failed'))) {
            res.status(400).json({ error: `Invalid ID provided for group, category, payer, or payment mode during ${operationType}.` });
        } else {
            console.error(`Error during expense ${operationType}:`, err.message);
            res.status(500).json({ error: err.message });
        }
    }

    async _handleUpdateExpense(req, res) {
        if (!this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { id } = req.params;
        const expenseData = req.body;
        if (!this._validateExpenseData(expenseData, res, true)) {
            return;
        }
        try {
            const updatedExpense = await this.expenseRepository.updateExpense(id, expenseData);
            res.json(updatedExpense);
        } catch (err) {
            if (err.message && err.message.includes('not found or no changes made')) {
                res.status(404).json({ error: err.message });
            } else {
                this._handleExpenseForeignKeyError(err, res, 'update');
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
            const filters = req.query;
            const analyticsData = await this.expenseRepository.getAnalyticsData(filters);
            res.json(analyticsData);
        } catch (err) {
            console.error('Error fetching analytics data:', err.message);
            res.status(500).json({ error: `Failed to retrieve analytics data: ${err.message}` });
        }
    }

    _validateExpenseData(expenseData, res, isUpdate = false) {
        const { expense_group_id, expense_category_id, payer_id, payment_mode_id, date, amount } = expenseData;
        if (!expense_group_id || !expense_category_id || !payer_id || !payment_mode_id || !date || amount === undefined || amount === null) {
            const message = isUpdate ? 'All required expense fields must be provided for update.' : 'All required expense fields must be provided.';
            res.status(400).json({ error: message });
            return false;
        }
        return true;
    }

    async _handleCsvImport(req, res) {
        if (!this.dbManager || !this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }
        const { csvData } = req.body;
        if (!csvData || typeof csvData !== 'string') {
            return res.status(400).json({ error: 'CSV data string is required in the request body as csvData.' });
        }

        try {
            console.log("MainController: Attempting CSV import...");
            const result = await this.csvService.importCsv(csvData);
            console.log("MainController: CSV import result:", result);
            res.json(result);
        } catch (error) {
            console.error('MainController: Error during CSV import:', error.message, error.stack);
            res.status(500).json({ error: 'Failed to import CSV data.', details: error.message });
        }
    }

    async _handleCsvExport(req, res) {
        if (!this.dbManager || !this.dbManager.pool) {
            return res.status(503).json({ error: 'Database not connected. Please connect to the database first.' });
        }

        try {
            console.log("MainController: Attempting CSV export...");
            const { startDate, endDate, expenseGroupIds } = req.query;
            const filters = { startDate, endDate, expenseGroupIds };

            const csvString = await this.csvService.exportCsv(filters);
            res.header('Content-Type', 'text/csv');
            res.attachment('expenses_export.csv');
            res.send(csvString);
            console.log("MainController: CSV export successful.");
        } catch (error) {
            console.error('MainController: Error during CSV export:', error.message, error.stack);
            res.status(500).json({ error: 'Failed to export CSV data.', details: error.message });
        }
    }
}

module.exports = ExpenseManagerServerController;
