const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const DatabaseManager = require('./src/models/database.js');
const csv = require('csv-parser');

class CsvImporter {
    constructor() {
        this.argv = null;
        this.dbManager = null;
        this.processedRows = []; // To store rows processed from CSV
        this.entityCreationLocks = new Map(); // For concurrency control
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
            console.log('Database initialized successfully.');
        } catch (error) {
            // Log the specific error and re-throw to be caught by run()'s catch block
            console.error('Error initializing database:', error.message);
            throw error;
        }
    }

    async _findOrCreateEntity(tableName, entityName, entityNameColumn = 'name', logPrefix = 'Entity') {
        const lockKey = `${tableName}-${entityNameColumn}-${entityName}`;

        if (this.entityCreationLocks.has(lockKey)) {
            console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) operation already pending, awaiting existing promise.`);
            return this.entityCreationLocks.get(lockKey);
        }

        let promiseResolver, promiseRejector;
        const newPromise = new Promise((resolve, reject) => {
            promiseResolver = resolve;
            promiseRejector = reject;
        });
        this.entityCreationLocks.set(lockKey, newPromise);
        console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) - new promise lock SET.`);

        (async () => {
            let successfullyResolved = false;
            try {
                console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) locked: performing initial SELECT.`);
                const rows = await this.dbManager.runQuery(`SELECT id FROM ${tableName} WHERE ${entityNameColumn} = $1`, [entityName]);
                if (rows.length > 0) {
                    console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) found on initial SELECT with ID: ${rows[0].id}.`);
                    successfullyResolved = true;
                    promiseResolver(rows[0].id);
                    return;
                }

                console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) not found on initial SELECT, proceeding to INSERT.`);
                const insertResult = await this.dbManager.runCommand(`INSERT INTO ${tableName} (${entityNameColumn}) VALUES ($1)`, [entityName]);
                if (insertResult && insertResult.id !== undefined) {
                    console.log(`${logPrefix} '${entityName}' (key: ${lockKey}) created with ID: ${insertResult.id}`);
                    successfullyResolved = true;
                    promiseResolver(insertResult.id);
                } else {
                    throw new Error(`${logPrefix} '${entityName}' (key: ${lockKey}) creation did not return an ID.`);
                }
            } catch (error) {
                if (error.code === '23505' || (error.message && error.message.includes('duplicate key value violates unique constraint'))) {
                    console.warn(`Warn: ${logPrefix} '${entityName}' (key: ${lockKey}) INSERT failed due to duplicate key. Attempting final SELECT.`);
                    try {
                        const finalRows = await this.dbManager.runQuery(`SELECT id FROM ${tableName} WHERE ${entityNameColumn} = $1`, [entityName]);
                        if (finalRows.length > 0) {
                            console.log(`DEBUG: ${logPrefix} '${entityName}' (key: ${lockKey}) found on final SELECT with ID: ${finalRows[0].id}.`);
                            successfullyResolved = true;
                            promiseResolver(finalRows[0].id);
                        } else {
                            throw new Error(`Failed to re-fetch ${logPrefix} '${entityName}' (key: ${lockKey}) after duplicate key error during insert.`);
                        }
                    } catch (refetchError) {
                        console.error(`Error in ${logPrefix} '${entityName}' (key: ${lockKey}) final select after duplicate: ${refetchError.message}`);
                        promiseRejector(refetchError);
                    }
                } else {
                    console.error(`Error in ${logPrefix} '${entityName}' (key: ${lockKey}) creation process: ${error.message}`);
                    promiseRejector(error);
                }
            } finally {
                // Only delete the lock if this specific promise instance failed AND it's still the one in the map
                if (!successfullyResolved && this.entityCreationLocks.get(lockKey) === newPromise) {
                    this.entityCreationLocks.delete(lockKey);
                    console.log(`DEBUG: Lock for ${logPrefix} '${entityName}' (key: ${lockKey}) released due to failure or error.`);
                } else if (successfullyResolved) {
                    console.log(`DEBUG: Lock for ${logPrefix} '${entityName}' (key: ${lockKey}) effectively cached with resolved ID.`);
                }
                // If successfullyResolved is true, the promise (newPromise) remains in the map, acting as a cache.
                // If successfullyResolved is false, but the promise in map is different, it means a new promise for the same key
                // was created (which shouldn't happen with this logic), so we don't delete that newer one.
            }
        })();

        return newPromise;
    }

    // Removed _ensureDefaultEntities method

    async _findOrCreateCategory(categoryName) {
        // This method is a specific use case of _findOrCreateEntity
        return this._findOrCreateEntity('expense_categories', categoryName, 'name', 'Category');
    }

    _parseDate(dateStr, originalRowForRowContext) { // Added originalRow for context in logging
        if (!dateStr || String(dateStr).trim() === '') { // Handle empty or null date strings early
            console.warn(`Skipping row due to missing or empty Date field:`, originalRowForRowContext);
            return null; // Or throw new Error('Date field is missing');
        }
        const dateParts = String(dateStr).split('-'); // Ensure dateStr is a string
        if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
            const month = monthNames[dateParts[1]];
            const year = dateParts[2];
            if (month && day.length === 2 && /^\d{4}$/.test(year) && /^\d{2}$/.test(day) && parseInt(day, 10) > 0 && parseInt(day, 10) <= 31 && parseInt(month, 10) > 0 && parseInt(month, 10) <=12 ) {
                return `${year}-${month}-${day}`;
            } else {
                console.warn(`Skipping row due to invalid date components: ${dateStr}`, originalRowForRowContext);
                return null;
            }
        } else {
            console.warn(`Skipping row due to invalid date format (expected DD-Mon-YYYY): ${dateStr}`, originalRowForRowContext);
            return null;
        }
    }

    _parseAmount(amountStr, originalRowForRowContext) { // Added originalRow for context
        if (!amountStr || String(amountStr).trim() === '') { // Handle empty or null amount strings
            console.warn(`Skipping row due to missing or empty Amount field:`, originalRowForRowContext);
            return null; // Or throw an error
        }
        const numericAmount = parseFloat(String(amountStr).trim()); // Ensure string and trim
        if (isNaN(numericAmount)) {
            console.warn(`Skipping row due to invalid amount: ${amountStr}`, originalRowForRowContext);
            return null;
        }
        return numericAmount;
    }

    async _processRow(row) {
        try {
            // Adjust to new CSV column names
            const dateStr = row['Date'];
            const amountStr = row['Amount'];
            const categoryStr = row['Expense Category'];
            const descriptionStr = row['Expense Description'] || ''; // Default to empty string if undefined
            const groupStr = row['Expense Group'];
            const payerStr = row['Payer'];
            const modeStr = row['Payment mode'];

            // Preliminary check for presence of required column headers
            // Specific parsing methods will handle content validation (empty, format)
            const requiredFields = {
                'Date': dateStr,
                'Amount': amountStr,
                'Expense Category': categoryStr,
                'Expense Group': groupStr,
                'Payer': payerStr,
                'Payment mode': modeStr
            };
            for (const fieldName in requiredFields) {
                if (requiredFields[fieldName] === undefined) { // Check if header itself is missing
                    console.warn(`Skipping row due to missing column header '${fieldName}':`, row);
                    return null;
                }
            }

            const formattedDate = this._parseDate(dateStr, row);
            if (!formattedDate) return null;

            const numericAmount = this._parseAmount(amountStr, row);
            if (numericAmount === null) return null; // 0 is a valid amount

            // Check for other required string fields after attempting to parse date/amount
            // as parseDate/parseAmount handle their own missing/empty logging.
             if (!categoryStr || String(categoryStr).trim() === '') {
                console.warn(`Skipping row due to missing or empty required field 'Expense Category':`, row);
                return null;
            }
            if (!groupStr || String(groupStr).trim() === '') {
                console.warn(`Skipping row due to missing or empty required field 'Expense Group':`, row);
                return null;
            }
            if (!payerStr || String(payerStr).trim() === '') {
                console.warn(`Skipping row due to missing or empty required field 'Payer':`, row);
                return null;
            }
            if (!modeStr || String(modeStr).trim() === '') {
                console.warn(`Skipping row due to missing or empty required field 'Payment mode':`, row);
                return null;
            }


            const categoryId = await this._findOrCreateCategory(categoryStr);
            const expenseGroupId = await this._findOrCreateEntity('expense_groups', groupStr, 'name', 'Expense Group');
            const payerId = await this._findOrCreateEntity('payers', payerStr, 'name', 'Payer');
            const paymentModeId = await this._findOrCreateEntity('payment_mode', modeStr, 'name', 'Payment Mode');

            // Check if any entity creation failed (they throw on error, caught by general catch)
            // but as an additional safeguard if they were changed to return null:
            if (!categoryId || !expenseGroupId || !payerId || !paymentModeId) {
                 console.error(`Skipping row due to failure in finding/creating one or more linked entities (Category, Group, Payer, Mode):`, row);
                 return null;
            }

            return {
                date: formattedDate,
                amount: numericAmount,
                categoryId: categoryId,
                description: descriptionStr,
                expenseGroupId: expenseGroupId,
                payerId: payerId,
                paymentModeId: paymentModeId,
                originalRow: row
            };
        } catch (error) {
            console.error('Error processing a single row, skipping:', row, error.message);
            return null; // Ensure null is returned on any error within this method
        }
    }

    _onStreamData(row) {
        // _currentTempProcessedRows will be used by _handleStreamData (now modified)
        // _currentRowProcessingPromises will be populated by this call
        this._currentRowProcessingPromises.push(
            this._handleStreamData(row) // _handleStreamData will use this._currentTempProcessedRows
        );
    }

    async _handleStreamData(row) { // Removed tempProcessedRows parameter
        // This wrapper is to ensure that if _processRow itself has an unhandled async error,
        // it doesn't crash the stream data handler directly.
        try {
            const processed = await this._processRow(row);
            if (processed) {
                this._currentTempProcessedRows.push(processed); // Use instance property
            }
        } catch (err) {
            // This catch is for unexpected errors from _processRow if it wasn't fully catching its own errors.
            // _processRow is designed to return null on error, so this should be rare.
            console.error('Unhandled error in _handleStreamData calling _processRow:', err.message, "Row:", row);
        }
    }

    _onStreamError(rejectPromise, err) { // Parameters order convention: bound args first, then event args
        console.error('Error during CSV stream processing:', err.message);
        rejectPromise(err);
    }

    async _onStreamEnd(resolvePromise, rejectPromise) { // Renamed parameters for clarity
        try {
            await Promise.all(this._currentRowProcessingPromises); // Use instance property
            this.processedRows = this._currentTempProcessedRows; // Assign after all promises resolved & use instance property
            console.log(`Finished CSV parsing. Found ${this.processedRows.length} valid rows to import.`);
            resolvePromise();
        } catch (error) {
            console.error('Critical error during Promise.all for row processing:', error.message);
            rejectPromise(error);
        } finally {
            // Cleanup instance properties
            this._currentRowProcessingPromises = [];
            this._currentTempProcessedRows = [];
            console.log("DEBUG: Temporary stream processing arrays have been cleared.");
        }
    }

    async _processCsvFile() {
        this._currentRowProcessingPromises = []; // Initialize instance property
        this._currentTempProcessedRows = [];   // Initialize instance property

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
            await this._insertExpenses();

            console.log('CSV import process completed successfully.');

        } catch (error) {
            // This catch block handles errors from _parseArguments, _initializeDatabase, _ensureDefaultEntities, _processCsvFile, _insertExpenses
            // and any future errors from CSV processing or insertions if they are not caught more locally.
            // Specific error messages are logged by the methods where they occur.
            // This logs a general message and then re-throws for main().catch() to handle exit.
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

    async _insertExpenses() {
        let successfulInserts = 0;
        let failedInserts = 0;

        if (this.processedRows.length === 0) {
            console.log('No processed rows available to insert into expenses.');
            return;
        }

        console.log(`Attempting to insert ${this.processedRows.length} expenses...`);

        for (const row of this.processedRows) {
            const {
                date: formattedDate, // This is the formattedDate from _processRow
                amount: numericAmount, // This is the numericAmount from _processRow
                categoryId,
                description,
                expenseGroupId,
                payerId,
                paymentModeId,
                originalRow
            } = row; // 'row' here is an object from this.processedRows

            const sql = `
                INSERT INTO expenses (
                    expense_group_id,
                    expense_category_id,
                    payer_id,
                    payment_mode_id,
                    date,
                    amount,
                    expense_description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;
            `;
            const params = [
                expenseGroupId,
                categoryId,
                payerId,
                paymentModeId,
                formattedDate,
                numericAmount,
                description || null
            ];

            try {
                // Use runCommand for INSERT statements. The 'sql' variable already includes 'RETURNING id'.
                // runCommand should handle this and return { id: newId, changes: ... }
                const insertResult = await this.dbManager.runCommand(sql, params);
                if (insertResult && insertResult.id !== undefined) {
                    console.log(`Successfully inserted expense ID: ${insertResult.id} for original date ${originalRow.Date}, amount ${originalRow.Amount}`);
                    successfulInserts++;
                } else {
                    console.warn(`Expense insertion for original row ${JSON.stringify(originalRow)} may have succeeded but did not return an ID (or id was undefined). Consider it failed for accounting.`);
                    failedInserts++;
                }
            } catch (error) {
                console.error(`Error inserting expense for original row ${JSON.stringify(originalRow)}: ${error.message}`);
                failedInserts++;
            }
        }
        console.log(`Expense Insertion Summary: ${successfulInserts} succeeded, ${failedInserts} failed.`);
        if (failedInserts > 0) {
             // Ensure the overall process indicates failure if any insertions fail.
            throw new Error(`${failedInserts} expenses failed to insert. See logs for details.`);
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
