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
        // Removed defaultGroupId, defaultPayerId, defaultModeId initializations
        this.processedRows = []; // To store rows processed from CSV

        // Removed DEFAULT_GROUP_NAME, DEFAULT_PAYER_NAME, DEFAULT_MODE_NAME definitions
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
        try {
            let result = await this.dbManager.query(`SELECT id FROM ${tableName} WHERE ${entityNameColumn} = $1`, [entityName]);
            if (result.rows.length > 0) {
                console.log(`${logPrefix} '${entityName}' found with ID: ${result.rows[0].id}`);
                return result.rows[0].id;
            } else {
                // Using query for INSERT ... RETURNING id, as runCommand might not be suited for RETURNING.
                // If DatabaseManager.runCommand is specifically designed for INSERTs returning ID, that could be used.
                // Based on prior usage (findOrCreateCategory), .query was used for INSERT...RETURNING.
                result = await this.dbManager.query(`INSERT INTO ${tableName} (${entityNameColumn}) VALUES ($1) RETURNING id`, [entityName]);
                console.log(`${logPrefix} '${entityName}' created with ID: ${result.rows[0].id}`);
                return result.rows[0].id;
            }
        } catch (error) {
            console.error(`Error finding or creating ${logPrefix.toLowerCase()} in ${tableName} with name ${entityName}:`, error.message);
            throw error; // Re-throw to be handled by the calling method or run()'s catch block
        }
    }

    // Removed _ensureDefaultEntities method

    async _findOrCreateCategory(categoryName) {
        // This method is a specific use case of _findOrCreateEntity
        return this._findOrCreateEntity('expense_categories', categoryName, 'name', 'Category');
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

            const requiredFields = {
                'Date': dateStr,
                'Amount': amountStr,
                'Expense Category': categoryStr,
                'Expense Group': groupStr,
                'Payer': payerStr,
                'Payment mode': modeStr
            };

            for (const fieldName in requiredFields) {
                // Check for null, undefined, or empty string after trimming
                if (requiredFields[fieldName] == null || String(requiredFields[fieldName]).trim() === '') {
                    console.warn(`Skipping row due to missing or empty required field '${fieldName}':`, row);
                    return null;
                }
            }

            let formattedDate;
            const dateParts = dateStr.split('-');
            if (dateParts.length === 3) {
                const day = dateParts[0].padStart(2, '0');
                const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
                const month = monthNames[dateParts[1]];
                const year = dateParts[2];
                if (month && day.length === 2 && year.length === 4) {
                    formattedDate = `${year}-${month}-${day}`;
                } else {
                    console.warn(`Skipping row due to invalid date components: ${dateStr}`, row);
                    return null;
                }
            } else {
                console.warn(`Skipping row due to invalid date format: ${dateStr}`, row);
                return null;
            }

            const numericAmount = parseFloat(amountStr);
            if (isNaN(numericAmount)) {
                console.warn(`Skipping row due to invalid amount: ${amountStr}`, row);
                return null;
            }

            const categoryId = await this._findOrCreateCategory(categoryStr); // Uses 'Expense Category'
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

    _handleStreamError(error, reject) {
        console.error('Error during CSV stream processing:', error.message);
        reject(error);
    }

    async _handleStreamData(row, tempProcessedRows) {
        // This wrapper is to ensure that if _processRow itself has an unhandled async error,
        // it doesn't crash the stream data handler directly.
        try {
            const processed = await this._processRow(row);
            if (processed) {
                tempProcessedRows.push(processed);
            }
        } catch (err) {
            // This catch is for unexpected errors from _processRow if it wasn't fully catching its own errors.
            // _processRow is designed to return null on error, so this should be rare.
            console.error('Unhandled error in _handleStreamData calling _processRow:', err.message, "Row:", row);
        }
    }

    _handleStreamEnd(resolve, tempProcessedRows) {
        this.processedRows = tempProcessedRows; // Assign to the class property
        console.log(`Finished CSV parsing. Found ${this.processedRows.length} valid rows to import.`);
        resolve();
    }

    async _processCsvFile() {
        return new Promise((resolve, reject) => {
            const tempProcessedRows = [];
            fs.createReadStream(this.argv.csv_path)
                .pipe(csv())
                .on('data', (row) => {
                    // Intentionally not awaiting _handleStreamData here to process rows concurrently
                    // as much as the stream provides them. _handleStreamData itself is async.
                    // Errors within _handleStreamData (and thus _processRow) are caught and logged there.
                    // If one row processing fails, it logs and skips, doesn't stop the stream.
                    this._handleStreamData(row, tempProcessedRows).catch(streamDataError => {
                        // This catch is for errors if _handleStreamData itself throws an unhandled exception,
                        // which is unlikely given its internal try/catch.
                        console.error('Unexpected error from _handleStreamData in stream pipeline:', streamDataError.message);
                        // Optionally, could call reject(streamDataError) here if such an error should stop all processing.
                    });
                })
                .on('error', (err) => this._handleStreamError(err, reject))
                .on('end', () => this._handleStreamEnd(resolve, tempProcessedRows));
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
                // Using .query as established for operations that return data (like RETURNING id)
                const result = await this.dbManager.query(sql, params);
                if (result.rows && result.rows.length > 0 && result.rows[0].id) {
                    console.log(`Successfully inserted expense ID: ${result.rows[0].id} for original date ${originalRow.Date}, amount ${originalRow.Amount}`);
                    successfulInserts++;
                } else {
                    // This case might occur if RETURNING id is not supported/configured correctly or if the insert somehow succeeds without error but returns no rows.
                    console.warn(`Expense insertion for original row ${JSON.stringify(originalRow)} may have succeeded but did not return an ID. Consider it failed for accounting.`);
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
