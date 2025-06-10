// import { parse } from 'csv-parse/sync'; // For CSV string parsing
// import { stringify } from 'csv-stringify/sync'; // For CSV string generation
// Note: Using require for now as the project seems to use CommonJS primarily
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const EntityManager = require('./EntityManager.js');
const CsvRowParser = require('./CsvRowParser.js');

class CsvService {
    constructor(dbManager, entityManager, csvRowParser) {
        this.dbManager = dbManager;
        this.entityManager = entityManager; // Expecting an instance of EntityManager
        this.csvRowParser = csvRowParser;   // Expecting an instance of CsvRowParser
        this.processedRows = [];
    }

    // --- Methods adapted from CsvImporter ---

    async _findOrCreateCategory(categoryName) {
        return this.entityManager.findOrCreateEntity('expense_categories', categoryName.trim(), 'name', 'Category');
    }

    async _fetchRelatedEntityIds(parsedRowData) {
        const { categoryStr, groupStr, payerStr, modeStr } = parsedRowData;
        const categoryId = await this._findOrCreateCategory(categoryStr); // Uses injected entityManager
        const expenseGroupId = await this.entityManager.findOrCreateEntity('expense_groups', groupStr, 'name', 'Expense Group');
        const payerId = await this.entityManager.findOrCreateEntity('payers', payerStr, 'name', 'Payer');
        const paymentModeId = await this.entityManager.findOrCreateEntity('payment_mode', modeStr, 'name', 'Payment Mode');
        return { categoryId, expenseGroupId, payerId, paymentModeId };
    }

    async _processRow(rawCsvRowData) {
        // rawCsvRowData is an object representing a row, e.g., { Header1: 'value1', Header2: 'value2' }
        try {
            const parsedRowData = this.csvRowParser.parse(rawCsvRowData); // Uses injected csvRowParser
            if (!parsedRowData) {
                // console.warn('CsvService: Skipping row due to parsing error (logged by CsvRowParser). Original data:', rawCsvRowData);
                return null;
            }

            const { date, amount, descriptionStr, originalRow } = parsedRowData;

            const entityIds = await this._fetchRelatedEntityIds(parsedRowData);
            if (Object.values(entityIds).some(id => id === null)) {
                console.error(`CsvService: Skipping row due to failure in finding/creating one or more linked entities. Original data:`, originalRow);
                return null;
            }

            return {
                date, amount, description: descriptionStr,
                ...entityIds,
                originalRow // Keep originalRow for context if needed for logging in _insertSingleExpense
            };
        } catch (error) {
            console.error('CsvService: Error processing a single row, skipping. Error:', error.message, 'Row data:', rawCsvRowData);
            return null;
        }
    }

    async _insertProcessedExpenses(processedRows) {
        let successfulInserts = 0;
        let failedInserts = 0;
        const insertedIds = [];

        if (!processedRows || processedRows.length === 0) {
            console.log('CsvService: No processed rows available to insert into expenses.');
            return { successfulInserts, failedInserts, insertedIds };
        }

        console.log(`CsvService: Attempting to insert ${processedRows.length} processed expenses...`);

        for (const processedRow of processedRows) {
            try {
                const insertedId = await this._insertSingleExpense(processedRow);
                if (insertedId !== null) {
                    successfulInserts++;
                    insertedIds.push(insertedId);
                } else {
                    failedInserts++;
                }
            } catch (error) {
                // Error already logged by _insertSingleExpense or _processRow
                failedInserts++;
            }
        }

        console.log(`CsvService: Expense Insertion Summary: ${successfulInserts} succeeded, ${failedInserts} failed.`);
        if (failedInserts > 0) {
            // Don't throw an error here, let the caller decide based on counts
            console.warn(`CsvService: ${failedInserts} expenses failed to insert. See logs for details.`);
        }
        return { successfulInserts, failedInserts, insertedIds };
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
            // Ensure dbManager is available
            if (!this.dbManager) {
                console.error('CsvService: dbManager is not initialized in _insertSingleExpense.');
                throw new Error('Database manager not available for inserting expense.');
            }
            const insertResult = await this.dbManager.runCommand(sql, params);
            if (insertResult && insertResult.id !== undefined) {
                console.log(`CsvService: Successfully inserted expense ID: ${insertResult.id} for original data:`, originalRow);
                return insertResult.id;
            } else {
                console.warn(`CsvService: Expense insertion for original data ${JSON.stringify(originalRow)} did not return an ID.`);
                return null;
            }
        } catch (error) {
            console.error(`CsvService: Error inserting expense for original data ${JSON.stringify(originalRow)}: ${error.message}`);
            throw error;
        }
    }

    // --- New public methods for UI interaction ---

    /**
     * Imports expenses from a CSV file content.
     * @param {string} fileContents - The CSV data as a string.
     * @returns {Promise<Object>} An object with { successfulInserts, failedInserts, totalRows, insertedIds, errors }
     */
    async importCsv(fileContents) {
        let parseErrors = [];
        let processedRowsForDb = [];
        let totalRows = 0;

        if (!this.dbManager || !this.entityManager || !this.csvRowParser) {
            throw new Error("CsvService is not properly initialized with dbManager, entityManager, or csvRowParser.");
        }

        console.log("CsvService: Starting CSV import process...");

        try {
            const records = parse(fileContents, {
                columns: true, // Assumes first row is header
                skip_empty_lines: true,
                trim: true,
            });
            totalRows = records.length;
            console.log(`CsvService: Parsed ${totalRows} records from CSV string.`);

            for (const record of records) {
                const processed = await this._processRow(record); // processRow expects an object
                if (processed) {
                    processedRowsForDb.push(processed);
                } else {
                    // Error/skip already logged by _processRow or CsvRowParser
                    // We could collect specific errors from CsvRowParser if it returned them
                    parseErrors.push({ message: "Row processing failed or skipped", data: record });
                }
            }

            console.log(`CsvService: Successfully processed ${processedRowsForDb.length} rows for database insertion.`);

        } catch (error) {
            console.error('CsvService: Error parsing CSV string:', error.message);
            // If parsing itself fails, we can't proceed to insert.
            return {
                successfulInserts: 0,
                failedInserts: totalRows, // All rows failed if parsing bombs
                totalRows,
                insertedIds: [],
                errors: [{ message: `CSV parsing failed: ${error.message}` }]
            };
        }

        const insertResults = await this._insertProcessedExpenses(processedRowsForDb);

        return {
            successfulInserts: insertResults.successfulInserts,
            failedInserts: (totalRows - insertResults.successfulInserts), // More accurate failed count
            totalRows,
            insertedIds: insertResults.insertedIds,
            errors: parseErrors // Add errors encountered during row processing (if any)
        };
    }

    /**
     * Exports all expenses to a CSV string, optionally filtered.
     * @param {Object} [filters={}] - Optional filters for exporting data.
     * @param {string} [filters.startDate] - Start date for filtering (YYYY-MM-DD).
     * @param {string} [filters.endDate] - End date for filtering (YYYY-MM-DD).
     * @param {string} [filters.expenseGroupId] - Expense group ID for filtering.
     * @returns {Promise<string>} The CSV data as a string.
     */
    async exportCsv(filters = {}) {
        if (!this.dbManager) {
            throw new Error("CsvService is not properly initialized with dbManager.");
        }

        console.log("CsvService: Starting CSV export process with filters:", filters);

        let whereClauses = [];
        let queryParams = [];
        let paramIndex = 1;

        if (filters.startDate && filters.endDate) {
            whereClauses.push(`e.date BETWEEN $${paramIndex++} AND $${paramIndex++}`);
            queryParams.push(filters.startDate, filters.endDate);
        } else if (filters.startDate) {
            whereClauses.push(`e.date >= $${paramIndex++}`);
            queryParams.push(filters.startDate);
        } else if (filters.endDate) {
            whereClauses.push(`e.date <= $${paramIndex++}`);
            queryParams.push(filters.endDate);
        }

        if (filters.expenseGroupId && filters.expenseGroupId !== '') {
            whereClauses.push(`e.expense_group_id = $${paramIndex++}`);
            queryParams.push(parseInt(filters.expenseGroupId));
        }

        let whereStatement = '';
        if (whereClauses.length > 0) {
            whereStatement = 'WHERE ' + whereClauses.join(' AND ');
        }

        const query = `
            SELECT
                e.date,
                e.amount,
                eg.name AS "Expense Group",
                ec.name AS "Expense Category",
                p.name AS "Payer",
                pm.name AS "Payment mode",
                e.expense_description AS "Expense Description"
            FROM expenses e
            LEFT JOIN expense_groups eg ON e.expense_group_id = eg.id
            LEFT JOIN expense_categories ec ON e.expense_category_id = ec.id
            LEFT JOIN payers p ON e.payer_id = p.id
            LEFT JOIN payment_mode pm ON e.payment_mode_id = pm.id
            ${whereStatement}
            ORDER BY e.date DESC;
        `;

        try {
            console.log("CsvService: Executing query:", query, "with params:", queryParams);
            const expensesData = await this.dbManager.runQuery(query, queryParams);
            if (!expensesData || expensesData.length === 0) {
                console.log("CsvService: No expenses found to export with the given filters.");
                // Return CSV header even if no data
                return stringify([], { header: true, columns: ['Date', 'Amount', 'Expense Category', 'Expense Description', 'Expense Group', 'Payer', 'Payment mode'] });
            }

            // Format date to DD-Mon-YYYY for export consistency with expected import format (if any)
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const formattedData = expensesData.map(row => {
                const dateObj = new Date(row.date);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = monthNames[dateObj.getMonth()];
                const year = dateObj.getFullYear();
                return {
                    ...row,
                    date: `${day}-${month}-${year}`
                };
            });

            const csvString = stringify(formattedData, {
                header: true,
                columns: [ // Define column order and headers explicitly
                    { key: 'date', header: 'Date' },
                    { key: 'amount', header: 'Amount' },
                    { key: 'Expense Category', header: 'Expense Category' },
                    { key: 'Expense Description', header: 'Expense Description' },
                    { key: 'Expense Group', header: 'Expense Group' },
                    { key: 'Payer', header: 'Payer' },
                    { key: 'Payment mode', header: 'Payment mode' }
                ]
            });
            console.log("CsvService: CSV export process completed successfully.");
            return csvString;
        } catch (error) {
            console.error('CsvService: Error exporting CSV data:', error.message);
            throw error; // Re-throw to be handled by the caller
        }
    }
}

module.exports = CsvService;
