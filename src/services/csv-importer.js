const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');

class CsvImporter {
  constructor(databaseManager, expenseRepository) {
    this.databaseManager = databaseManager;
    this.expenseRepository = expenseRepository;
  }

  async importCsv(fileObjectOrPath) {
    const results = [];
    const errors = [];

    return new Promise(async (resolve, reject) => {
      let inputStream;

      if (typeof fileObjectOrPath === 'string') {
        // Argument is a file path
        if (!fs.existsSync(fileObjectOrPath)) {
          return reject({ message: "CSV import failed.", errors: [`File not found: ${fileObjectOrPath}`] });
        }
        inputStream = fs.createReadStream(fileObjectOrPath);
      } else if (fileObjectOrPath && typeof fileObjectOrPath.text === 'function') {
        // Argument is a File object (from browser)
        try {
          const csvString = await fileObjectOrPath.text();
          inputStream = Readable.from([csvString]);
        } catch (error) {
          return reject({ message: "CSV import failed.", errors: [`Error reading file object: ${error.message}`] });
        }
      } else {
        return reject({ message: "CSV import failed.", errors: ["Invalid argument: Expected a file path (string) or a File object."] });
      }

      inputStream
        .pipe(csv({
          headers: [
            'Date', 'Amount', 'Expense Category', 'Expense Description',
            'Expense Group', 'Payer', 'Payment mode'
          ],
          skipHeader: true, // Use skipHeader instead of skipLines if headers array is also mapping
          mapHeaders: ({ header, index }) => ['Date', 'Amount', 'Expense Category', 'Expense Description', 'Expense Group', 'Payer', 'Payment mode'][index] || null,
        }))
        .on('data', (row) => {
          // Filter out rows that might be all empty due to trailing newlines in some CSVs
          if (Object.values(row).every(val => val === null || val === '')) {
            return;
          }
          results.push(this._processRow(row));
        })
        .on('end', async () => {
          const processedResults = await Promise.all(results);
          let importedCount = 0;

          for (const processedRow of processedResults) {
            if (processedRow && processedRow.validatedData) {
              try {
                await this.expenseRepository.addExpense(processedRow.validatedData);
                importedCount++;
              } catch (dbError) {
                errors.push(`Database insertion error for row ${JSON.stringify(processedRow.originalRow || '')}: ${dbError.message}`);
              }
            } else if (processedRow && processedRow.error) {
              errors.push(processedRow.error);
            }
          }

          if (errors.length > 0) {
            if (importedCount > 0) {
              reject({ message: `CSV import completed with ${importedCount} successful imports and errors.`, errors, importedCount });
            } else {
              reject({ message: "CSV import failed with errors.", errors, importedCount });
            }
          } else if (importedCount === 0 && results.length === 0) { // results.length check for empty CSV file
             resolve({ message: "CSV imported successfully. No data rows found to import.", importedCount });
          }
          else {
            resolve({ message: `CSV imported successfully. ${importedCount} expenses added.`, importedCount });
          }
        })
        .on('error', (error) => {
          // This error listener on the stream is for stream-level errors (e.g., file access issues not caught by existsSync)
          errors.push(`File reading or CSV parsing stream error: ${error.message}`);
          reject({ message: "CSV import failed.", errors, importedCount: 0 });
        });
    });
  }

  async _processRow(row) {
    // Basic validation for required fields
    if (!row.Date || !row.Amount || !row['Expense Category']) {
      return { error: `Missing required fields (Date, Amount, 'Expense Category') in row: ${JSON.stringify(row)}`, originalRow: row };
    }

    const amount = parseFloat(row.Amount);
    if (isNaN(amount) || amount <= 0) { // Expenses should typically be positive
      return { error: `Invalid or non-positive Amount in row: ${JSON.stringify(row)}`, originalRow: row };
    }

    // Date validation (basic) - Expects YYYY-MM-DD or parseable by Date
    const date = new Date(row.Date);
    if (isNaN(date.getTime())) {
        return { error: `Invalid Date format in row: ${JSON.stringify(row)}. Expected a parseable date format (e.g., YYYY-MM-DD).`, originalRow: row };
    }
    const formattedDate = date.toISOString().split('T')[0]; // Standardize to YYYY-MM-DD

    try {
      // Ensure expenseRepository and its methods exist
      if (!this.expenseRepository ||
          typeof this.expenseRepository.findOrCreateCategory !== 'function' ||
          typeof this.expenseRepository.findOrCreateExpenseGroup !== 'function' ||
          typeof this.expenseRepository.findOrCreatePayer !== 'function' ||
          typeof this.expenseRepository.findOrCreatePaymentMode !== 'function' ||
          typeof this.expenseRepository.addExpense !== 'function') {
        // This is a programming error/setup issue, should ideally not happen at runtime if configured correctly
        throw new Error("ExpenseRepository or its required methods are not available.");
      }

      // Use specific findOrCreate methods from ExpenseRepository
      // These methods should return an object with an 'id' property, or null/throw if not found/creatable.
      const category = row['Expense Category'] ? await this.expenseRepository.findOrCreateCategory(row['Expense Category']) : null;
      if (!category || !category.id) {
        return { error: `Failed to find or create Expense Category: "${row['Expense Category']}" for row: ${JSON.stringify(row)}`, originalRow: row };
      }

      const group = row['Expense Group'] ? await this.expenseRepository.findOrCreateExpenseGroup(row['Expense Group']) : null;
      // Group is optional, so group.id might be null if row['Expense Group'] is empty/null

      const payer = row.Payer ? await this.expenseRepository.findOrCreatePayer(row.Payer) : null;
      // Payer can be optional depending on requirements

      const paymentMode = row['Payment mode'] ? await this.expenseRepository.findOrCreatePaymentMode(row['Payment mode']) : null;
      // Payment Mode can be optional

      const validatedData = {
        date: formattedDate,
        amount: amount,
        categoryId: category.id, // Must have category
        description: row['Expense Description'] || '',
        groupId: group ? group.id : null, // Optional: ID or null
        payerId: payer ? payer.id : null, // Optional: ID or null
        paymentModeId: paymentMode ? paymentMode.id : null, // Optional: ID or null
      };
      return { validatedData, originalRow: row };
    } catch (error) {
      // Catch errors from repository calls or other unexpected issues
      return { error: `Error processing entities for row ${JSON.stringify(row)}: ${error.message}`, originalRow: row };
    }
  }
}

module.exports = CsvImporter;
