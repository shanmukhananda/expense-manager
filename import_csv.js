const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const DatabaseManager = require('./src/models/database.js');
const EntityManager = require('./src/EntityManager.js');
const CsvRowParser = require('./src/CsvRowParser.js'); // Import CsvRowParser
const csv = require('csv-parser');

class CsvImporter {
    constructor() {
        this.argv = null;
        this.dbManager = null;
        this.entityManager = null;
        this.csvRowParser = new CsvRowParser(); // Instantiate CsvRowParser
        this.processedRows = [];
        // this.entityCreationLocks = new Map(); // Moved to EntityManager
    }

    _parseArguments() {
        this.argv = yargs(hideBin(process.argv))
            .option('database_url', {
                alias: 'db',
                type: 'string',
                description: 'PostgreSQL database connection URL',
                demandOption: true,
            })
            .option('csv_path', {
                alias: 'csv',
                type: 'string',
                description: 'Path to the CSV file to import',
                demandOption: true,
            })
            .usage('Usage: $0 --database_url <db_url> --csv_path <path_to_csv>')
            .help('h')
            .alias('h', 'help')
            .epilogue('For more information, find the documentation at a Pinned Google Cloud Project') // Consider updating if not applicable
            .argv;

        if (!fs.existsSync(this.argv.csv_path)) {
            // This error is critical and should stop execution.
            // Throwing an error here will be caught by the global catch block in main().
            throw new Error(`CSV file not found at ${this.argv.csv_path}`);
        }
    }

    async _initializeDatabase() {
        try {
            this.dbManager = new DatabaseManager(this.argv.database_url, path.resolve(__dirname, 'src', 'models', 'schema.sql'));
            await this.dbManager.initialize();
            this.entityManager = new EntityManager(this.dbManager); // Instantiate EntityManager
            console.log('Database and EntityManager initialized successfully.');
        } catch (error) {
            console.error('Error initializing database or EntityManager:', error.message);
            throw error;
        }
    }

    // _findOrCreateEntity, _findEntity, _createEntity are now in EntityManager.js

    async _findOrCreateCategory(categoryName) {
        // Uses the entityManager instance
        return this.entityManager.findOrCreateEntity('expense_categories', categoryName.trim(), 'name', 'Category');
    }

    // _parseDate, _parseAmount, _validateRowData are now in CsvRowParser.js

    async _fetchRelatedEntityIds(parsedRowData) {
        const { categoryStr, groupStr, payerStr, modeStr } = parsedRowData;
        // categoryStr is already trimmed by CsvRowParser in its output
        const categoryId = await this._findOrCreateCategory(categoryStr);
        const expenseGroupId = await this.entityManager.findOrCreateEntity('expense_groups', groupStr, 'name', 'Expense Group');
        const payerId = await this.entityManager.findOrCreateEntity('payers', payerStr, 'name', 'Payer');
        const paymentModeId = await this.entityManager.findOrCreateEntity('payment_mode', modeStr, 'name', 'Payment Mode');
        return { categoryId, expenseGroupId, payerId, paymentModeId };
    }

    async _processRow(rawCsvRow) {
        try {
            const parsedRowData = this.csvRowParser.parse(rawCsvRow);
            if (!parsedRowData) return null; // Error logged by parser

            const { date, amount, descriptionStr, originalRow } = parsedRowData;

            const entityIds = await this._fetchRelatedEntityIds(parsedRowData);
            if (Object.values(entityIds).some(id => id === null)) {
                console.error(`Skipping row due to failure in finding/creating one or more linked entities. One or more IDs were null:`, originalRow);
                return null;
            }

            return {
                date, amount, description: descriptionStr,
                ...entityIds,
                originalRow
            };
        } catch (error) {
            console.error('Error processing a single row in CsvImporter._processRow, skipping:', rawCsvRow, error.message);
            return null;
        }
    }

    _onStreamData(row) {
        // _currentTempProcessedRows will be used by _handleStreamData (now modified)
        // _currentRowProcessingPromises will be populated by this call
        this._currentRowProcessingPromises.push(
            this._handleStreamData(row) // _handleStreamData will use this._currentTempProcessedRows
        );
    }

    async _handleStreamData(row) {
        // This wrapper ensures that if _processRow has an unhandled async error,
        // it doesn't crash the stream data handler.
        try {
            const processed = await this._processRow(row);
            if (processed) {
                this.processedRows.push(processed); // Push directly to instance's processedRows
            }
        } catch (err) {
            // _processRow is designed to return null on error and log its own errors.
            // This catch is for truly unexpected errors from _processRow.
            console.error('Unexpected error in _handleStreamData calling _processRow:', err.message, "Row:", row);
        }
    }

    _onStreamError(rejectPromise, err) {
        console.error('Error during CSV stream processing:', err.message);
        rejectPromise(err);
    }

    async _onStreamEnd(resolvePromise, rejectPromise) {
        try {
            await Promise.all(this._currentRowProcessingPromises); // Wait for all row processing
            // this.processedRows is already populated by _handleStreamData
            console.log(`Finished CSV parsing. Found ${this.processedRows.length} valid rows to import.`);
            resolvePromise();
        } catch (error) {
            console.error('Critical error during Promise.all for row processing:', error.message);
            rejectPromise(error);
        } finally {
            // Cleanup instance properties
            this._currentRowProcessingPromises = []; // Clear promises array
            // this._currentTempProcessedRows is no longer used.
            console.log("DEBUG: Temporary stream processing promise array has been cleared.");
        }
    }

    async _processCsvFile() {
        this._currentRowProcessingPromises = []; // Stores promises from _handleStreamData
        this.processedRows = []; // Initialize processedRows for direct population

        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(this.argv.csv_path).pipe(csv());
            stream.on('data', this._onStreamData.bind(this));
            stream.on('error', this._onStreamError.bind(this, reject)); // Pass reject from new Promise
            stream.on('end', this._onStreamEnd.bind(this, resolve, reject)); // Pass resolve, reject
        });
    }

    async run() {
        try {
            this._parseArguments(); // This will throw if CSV path is invalid.
            console.log('Starting CSV import process...');
            console.log('Database URL:', this.argv.database_url);
            console.log('CSV File Path:', this.argv.csv_path);

            await this._initializeDatabase();
            // Removed call to await this._ensureDefaultEntities();
            await this._processCsvFile();
            await this._insertProcessedExpenses(); // Renamed for clarity

            console.log('CSV import process completed successfully.');

        } catch (error) {
            // This catch block handles errors from _parseArguments, _initializeDatabase,
            // _processCsvFile, _insertProcessedExpenses, etc.
            // Specific error messages are logged by the methods where they occur.
            console.error('Aborting CSV import process due to error. See details above. Error message:', error.message);
            throw error;
        } finally {
            if (this.dbManager && this.dbManager.pool) {
                try {
                    await this.dbManager.close();
                    console.log('Database connection closed.');
                } catch (closeError) {
                    console.error('Error closing database connection:', closeError.message);
                }
            }
        }
    }

    async _insertProcessedExpenses() { // Renamed from _insertExpenses
        let successfulInserts = 0;
        let failedInserts = 0;

        if (this.processedRows.length === 0) {
            console.log('No processed rows available to insert into expenses.');
            return;
        }

        console.log(`Attempting to insert ${this.processedRows.length} processed expenses...`);

        for (const processedRow of this.processedRows) {
            try {
                const insertedId = await this._insertSingleExpense(processedRow);
                if (insertedId !== null) { // _insertSingleExpense returns null on failure to get ID
                    successfulInserts++;
                } else {
                    failedInserts++;
                    // Warning already logged by _insertSingleExpense if ID wasn't returned
                }
            } catch (error) {
                // Error already logged by _insertSingleExpense, just count failure
                failedInserts++;
            }
        }

        console.log(`Expense Insertion Summary: ${successfulInserts} succeeded, ${failedInserts} failed.`);
        if (failedInserts > 0) {
            throw new Error(`${failedInserts} expenses failed to insert. See logs for details.`);
        }
    }

    async _insertSingleExpense(processedRowData) {
        const {
            date: formattedDate,
            amount: numericAmount,
            categoryId,
            description,
            expenseGroupId,
            payerId,
            paymentModeId,
            originalRow // For logging context
        } = processedRowData;

        const sql = `
            INSERT INTO expenses (
                expense_group_id, expense_category_id, payer_id, payment_mode_id,
                date, amount, expense_description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
        `;
        const params = [
            expenseGroupId, categoryId, payerId, paymentModeId,
            formattedDate, numericAmount, description || null
        ];

        try {
            const insertResult = await this.dbManager.runCommand(sql, params);
            if (insertResult && insertResult.id !== undefined) {
                console.log(`Successfully inserted expense ID: ${insertResult.id} for original date ${originalRow.Date}, amount ${originalRow.Amount}`);
                return insertResult.id;
            } else {
                console.warn(`Expense insertion for original row ${JSON.stringify(originalRow)} did not return an ID. Consider it failed.`);
                return null; // Indicate failure to get an ID
            }
        } catch (error) {
            console.error(`Error inserting expense for original row ${JSON.stringify(originalRow)}: ${error.message}`);
            throw error; // Re-throw to be caught by the loop in _insertProcessedExpenses
        }
    }
}

// Main execution
async function main() {
    const importer = new CsvImporter();
    await importer.run();
}

main().catch(error => {
    // This global catch block is now simpler.
    // It primarily handles logging the error message from importer.run() and exiting.
    console.error('Critical error during CSV import process. See details above. Error message:', error.message);
    if (error.stack && !error.message.includes(error.stack.split('\n')[1])) { // Avoid redundant stack if message contains it
        // Stacks are useful for debugging, so log them if available and not redundant.
        console.error("Stacktrace:", error.stack);
    }
    process.exit(1);
});
