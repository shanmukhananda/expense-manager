const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
// Assuming DatabaseManager will be used, prepare its import path
const DatabaseManager = require('./src/models/database.js');
const csv = require('csv-parser'); // For CSV parsing

const DEFAULT_GROUP_NAME = 'CSV Imports Default Group';
const DEFAULT_PAYER_NAME = 'CSV Imports Default Payer';
const DEFAULT_MODE_NAME = 'CSV Imports Default Mode';

async function findOrCreateDefaultEntity(dbManager, tableName, entityNameColumn, entityName) {
    try {
        // Try to find the entity
        let result = await dbManager.query(`SELECT id FROM ${tableName} WHERE ${entityNameColumn} = $1`, [entityName]);
        if (result.rows.length > 0) {
            return result.rows[0].id;
        } else {
            // If not found, insert it
            result = await dbManager.query(`INSERT INTO ${tableName} (${entityNameColumn}) VALUES ($1) RETURNING id`, [entityName]);
            return result.rows[0].id;
        }
    } catch (error) {
        console.error(`Error finding or creating default entity in ${tableName} with name ${entityName}:`, error);
        throw error; // Re-throw the error to be caught by the main catch block
    }
}

async function findOrCreateCategory(dbManager, categoryName) {
    try {
        const queryResult = await dbManager.query("SELECT id FROM expense_categories WHERE name = $1", [categoryName]);
        if (queryResult.rows.length > 0) {
            console.log(`Found category '${categoryName}' with ID: ${queryResult.rows[0].id}`);
            return queryResult.rows[0].id;
        } else {
            const insertResult = await dbManager.query("INSERT INTO expense_categories (name) VALUES ($1) RETURNING id", [categoryName]);
            console.log(`Created category '${categoryName}' with ID: ${insertResult.rows[0].id}`);
            return insertResult.rows[0].id;
        }
    } catch (error) {
        console.error(`Error finding or creating category '${categoryName}':`, error);
        throw error; // Re-throw to be caught by the main CSV processing catch block
    }
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('database_url', {
            alias: 'db',
            type: 'string',
            description: 'PostgreSQL database connection URL',
            demandOption: true, // Makes this argument required
        })
        .option('csv_path', {
            alias: 'csv',
            type: 'string',
            description: 'Path to the CSV file to import',
            demandOption: true, // Makes this argument required
        })
        .usage('Usage: $0 --database_url <db_url> --csv_path <path_to_csv>')
        .help('h')
        .alias('h', 'help')
        .epilogue('For more information, find the documentation at a Pinned Google Cloud Project')
        .argv;

    console.log('Starting CSV import process...');
    console.log('Database URL:', argv.database_url);
    console.log('CSV File Path:', argv.csv_path);

    // Basic validation for CSV file existence
    if (!fs.existsSync(argv.csv_path)) {
        console.error(`Error: CSV file not found at ${argv.csv_path}`);
        process.exit(1);
    }

    // Placeholder for database connection and processing
    const dbManager = new DatabaseManager(argv.database_url, path.resolve(__dirname, 'src', 'models', 'schema.sql'));
    try {
        await dbManager.initialize();
        console.log('Database initialized successfully.');

        // Find or create default entities
        const defaultGroupId = await findOrCreateDefaultEntity(dbManager, 'expense_groups', 'name', DEFAULT_GROUP_NAME);
        console.log(`Using Expense Group ID: ${defaultGroupId}`);

        const defaultPayerId = await findOrCreateDefaultEntity(dbManager, 'payers', 'name', DEFAULT_PAYER_NAME);
        console.log(`Using Payer ID: ${defaultPayerId}`);

        const defaultModeId = await findOrCreateDefaultEntity(dbManager, 'payment_mode', 'name', DEFAULT_MODE_NAME);
        console.log(`Using Payment Mode ID: ${defaultModeId}`);

        // CSV Reading and Processing Logic
        let processedRows = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(argv.csv_path)
                .pipe(csv())
                .on('data', async (row) => { // Made this async
                    try {
                        // Destructure with guards for missing columns
                        const { Date: dateStr, Amount: amountStr, Category: categoryStr, Description: descriptionStr = '' } = row;

                        if (!dateStr || !amountStr || !categoryStr) {
                            console.error('Skipping row due to missing Date, Amount, or Category:', row);
                            return; // Skip this row
                        }

                        // Date Conversion (e.g., "1-Jun-2025" to "YYYY-MM-DD")
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
                                console.error(`Skipping row due to invalid date components: ${dateStr}`, row);
                                return;
                            }
                        } else {
                            console.error(`Skipping row due to invalid date format: ${dateStr}`, row);
                            return;
                        }

                        // Amount Conversion
                        const numericAmount = parseFloat(amountStr);
                        if (isNaN(numericAmount)) {
                            console.error(`Skipping row due to invalid amount: ${amountStr}`, row);
                            return;
                        }

                        const categoryId = await findOrCreateCategory(dbManager, categoryStr);

                        processedRows.push({
                            date: formattedDate,
                            amount: numericAmount,
                            categoryId: categoryId,
                            description: descriptionStr,
                            defaultGroupId: defaultGroupId,
                            defaultPayerId: defaultPayerId,
                            defaultModeId: defaultModeId,
                            originalRow: row // For logging/debugging if needed
                        });

                    } catch (err) {
                        console.error("Error processing a row, skipping:", row, err);
                        // Decide if you want to stop the whole import or just skip the row
                        // For now, it just skips. If 'reject(err)' was called, it would stop.
                    }
                })
                .on('end', () => {
                    console.log(`Finished processing CSV. Found ${processedRows.length} valid rows. Ready for expense insertion.`);
                    // console.log('Processed rows data:', JSON.stringify(processedRows, null, 2)); // Optional: log data for debugging
                    resolve();
                })
                .on('error', (error) => {
                    console.error('Error reading or processing CSV file:', error);
                    reject(error); // This will make the outer Promise reject
                });
        });

        // Insert expenses into the database
        let successfulInserts = 0;
        let failedInserts = 0;

        if (processedRows.length === 0) {
            console.log('No processed rows available to insert into expenses.');
        } else {
            console.log(`Attempting to insert ${processedRows.length} expenses...`);
            for (const row of processedRows) {
                const {
                    date: formattedDate,
                    amount: numericAmount,
                    categoryId,
                    description,
                    defaultGroupId,
                    defaultPayerId,
                    defaultModeId,
                    originalRow
                } = row;

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
                    defaultGroupId,
                    categoryId,
                    defaultPayerId,
                    defaultModeId,
                    formattedDate,
                    numericAmount,
                    description || null
                ];

                try {
                    const result = await dbManager.query(sql, params); // Assuming query can handle RETURNING id
                    if (result.rows.length > 0) {
                         console.log(`Successfully inserted expense for date ${formattedDate}, amount ${numericAmount}. Expense ID: ${result.rows[0].id}`);
                        successfulInserts++;
                    } else {
                        // This case should ideally not happen if RETURNING id is used and insert is successful without error
                        console.warn(`Expense insertion for date ${formattedDate} did not return an ID, but no error was thrown. Original row:`, originalRow);
                        failedInserts++; // Or handle as a success if your DB doesn't always return ID but doesn't error
                    }
                } catch (insertError) {
                    console.error(`Failed to insert expense for date ${formattedDate}, amount ${numericAmount}. Error:`, insertError.message, "Original row:", originalRow);
                    failedInserts++;
                }
            }
            console.log(`Expense Insertion Summary: ${successfulInserts} succeeded, ${failedInserts} failed.`);
        }

        await dbManager.close();
        console.log('Database connection closed.');
    } catch (error) {
        console.error('Critical error during CSV import process:', error.message, error.stack ? `\nStack: ${error.stack}` : '');
        if (dbManager && dbManager.pool) { // Ensure pool exists before trying to close
            try {
                await dbManager.close();
                console.log('Database connection closed during error handling.');
            } catch (closeError) {
                console.error('Failed to close database connection during error handling:', closeError.message);
            }
        }
        process.exit(1);
    }

    console.log('CSV import process finished.');
}

main().catch(error => {
    // This outer catch is for errors thrown synchronously by main() itself before its own try/catch
    // or if main() is not async and something it calls (not awaited) rejects.
    // Given main is async, most errors should be caught by its internal try/catch.
    console.error('Unhandled error in main execution:', error.message, error.stack ? `\nStack: ${error.stack}` : '');
    process.exit(1);
});
