const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const EntityManager = require('./EntityManager.js');
const CsvRowParser = require('./CsvRowParser.js');

class CsvService {
    constructor(dbManager, entityManager, csvRowParser) {
        this.dbManager = dbManager;
        this.entityManager = entityManager;
        this.csvRowParser = csvRowParser;
        this.processedRows = [];
    }

    async _findOrCreateCategory(categoryName) {
        return this.entityManager.findOrCreateEntity('expense_categories', categoryName.trim(), 'name', 'Category');
    }

    async _fetchRelatedEntityIds(parsedRowData) {
        const { categoryStr, groupStr, payerStr, modeStr } = parsedRowData;
        const categoryId = await this._findOrCreateCategory(categoryStr);
        const expenseGroupId = await this.entityManager.findOrCreateEntity('expense_groups', groupStr, 'name', 'Expense Group');
        const payerId = await this.entityManager.findOrCreateEntity('payers', payerStr, 'name', 'Payer');
        const paymentModeId = await this.entityManager.findOrCreateEntity('payment_mode', modeStr, 'name', 'Payment Mode');
        return { categoryId, expenseGroupId, payerId, paymentModeId };
    }

    async _processRow(rawCsvRowData) {
        try {
            const parsedRowData = this.csvRowParser.parse(rawCsvRowData);
            if (!parsedRowData) {
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
                originalRow
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
                failedInserts++;
            }
        }

        console.log(`CsvService: Expense Insertion Summary: ${successfulInserts} succeeded, ${failedInserts} failed.`);
        if (failedInserts > 0) {
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
            originalRow
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
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
            totalRows = records.length;
            console.log(`CsvService: Parsed ${totalRows} records from CSV string.`);

            for (const record of records) {
                const processed = await this._processRow(record);
                if (processed) {
                    processedRowsForDb.push(processed);
                } else {
                    parseErrors.push({ message: "Row processing failed or skipped", data: record });
                }
            }

            console.log(`CsvService: Successfully processed ${processedRowsForDb.length} rows for database insertion.`);

        } catch (error) {
            console.error('CsvService: Error parsing CSV string:', error.message);
            return {
                successfulInserts: 0,
                failedInserts: totalRows,
                totalRows,
                insertedIds: [],
                errors: [{ message: `CSV parsing failed: ${error.message}` }]
            };
        }

        const insertResults = await this._insertProcessedExpenses(processedRowsForDb);

        return {
            successfulInserts: insertResults.successfulInserts,
            failedInserts: (totalRows - insertResults.successfulInserts),
            totalRows,
            insertedIds: insertResults.insertedIds,
            errors: parseErrors
        };
    }

    /**
     * Exports all expenses to a CSV string, optionally filtered.
     * @param {Object} [filters={}] - Optional filters for exporting data.
     * @param {string} [filters.startDate] - Start date for filtering (YYYY-MM-DD).
     * @param {string} [filters.endDate] - End date for filtering (YYYY-MM-DD).
     * @param {string} [filters.expenseGroupIds] - Comma-separated string of expense group IDs for filtering.
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

        if (filters.expenseGroupIds && typeof filters.expenseGroupIds === 'string' && filters.expenseGroupIds.trim() !== '') {
            const groupIds = filters.expenseGroupIds.split(',')
                .map(id => parseInt(id.trim()))
                .filter(id => !isNaN(id));

            if (groupIds.length > 0) {
                const placeholders = groupIds.map(() => `$${paramIndex++}`).join(',');
                whereClauses.push(`e.expense_group_id IN (${placeholders})`);
                queryParams.push(...groupIds);
            }
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
                return stringify([], { header: true, columns: ['Date', 'Amount', 'Expense Category', 'Expense Description', 'Expense Group', 'Payer', 'Payment mode'] });
            }

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
                columns: [
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
            throw error;
        }
    }
}

module.exports = CsvService;
