const fs = require('fs');
const { Readable } = require('stream');
const CsvImporter = require('./csv-importer'); // Assuming CsvImporter is exported with module.exports

// Mock dependencies
jest.mock('fs');

describe('CsvImporter', () => {
  let mockExpenseRepository;
  let mockDatabaseManager;
  let csvImporter;

  beforeEach(() => {
    mockExpenseRepository = {
      findOrCreateCategory: jest.fn(),
      findOrCreateExpenseGroup: jest.fn(),
      findOrCreatePayer: jest.fn(),
      findOrCreatePaymentMode: jest.fn(),
      addExpense: jest.fn(),
    };
    mockDatabaseManager = {}; // Not directly used by methods we're testing if ExpenseRepository is well-mocked
    csvImporter = new CsvImporter(mockDatabaseManager, mockExpenseRepository);

    // Reset mocks before each test
    fs.createReadStream.mockReset();
    fs.existsSync.mockReset();
  });

  const validCsvHeader = "Date,Amount,Expense Category,Expense Description,Expense Group,Payer,Payment mode";
  const validCsvRow1 = "2023-01-15,100.50,Groceries,Weekly shopping,Household,John Doe,Credit Card";
  const validCsvRow2 = "2023-01-16,25.00,Transport,Bus fare,,Jane Doe,Cash"; // Optional fields empty

  const mockRepositorySuccess = () => {
    mockExpenseRepository.findOrCreateCategory.mockImplementation(name => Promise.resolve({ id: `cat_${name.toLowerCase().replace(' ', '_')}`, name }));
    mockExpenseRepository.findOrCreateExpenseGroup.mockImplementation(name => Promise.resolve(name ? { id: `grp_${name.toLowerCase().replace(' ', '_')}`, name } : null));
    mockExpenseRepository.findOrCreatePayer.mockImplementation(name => Promise.resolve(name ? { id: `pay_${name.toLowerCase().replace(' ', '_')}`, name } : null));
    mockExpenseRepository.findOrCreatePaymentMode.mockImplementation(name => Promise.resolve(name ? { id: `pm_${name.toLowerCase().replace(' ', '_')}`, name } : null));
    mockExpenseRepository.addExpense.mockResolvedValue({ id: 'new_expense_id' });
  };

  describe('importCsv with file path', () => {
    it('should import valid CSV data successfully from a file path', async () => {
      const csvContent = `${validCsvHeader}\n${validCsvRow1}\n${validCsvRow2}`;
      const mockStream = Readable.from([csvContent]);
      fs.existsSync.mockReturnValue(true);
      fs.createReadStream.mockReturnValue(mockStream);
      mockRepositorySuccess();

      const result = await csvImporter.importCsv('dummy/path.csv');

      expect(result.message).toBe('CSV imported successfully. 2 expenses added.');
      expect(result.importedCount).toBe(2);
      expect(mockExpenseRepository.addExpense).toHaveBeenCalledTimes(2);
      expect(mockExpenseRepository.addExpense).toHaveBeenCalledWith({
        date: '2023-01-15',
        amount: 100.50,
        categoryId: 'cat_groceries',
        description: 'Weekly shopping',
        groupId: 'grp_household',
        payerId: 'pay_john_doe',
        paymentModeId: 'pm_credit_card',
      });
      expect(mockExpenseRepository.addExpense).toHaveBeenCalledWith({
        date: '2023-01-16',
        amount: 25.00,
        categoryId: 'cat_transport',
        description: 'Bus fare',
        groupId: null,
        payerId: 'pay_jane_doe',
        paymentModeId: 'pm_cash',
      });
    });

    it('should reject if file path does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      await expect(csvImporter.importCsv('nonexistent/path.csv'))
        .rejects.toMatchObject({
          message: "CSV import failed.",
          errors: ["File not found: nonexistent/path.csv"],
        });
    });
  });

  describe('importCsv with File object', () => {
    it('should import valid CSV data successfully from a File object', async () => {
      const csvContent = `${validCsvHeader}\n${validCsvRow1}`;
      const mockFile = {
        name: 'test.csv',
        type: 'text/csv',
        text: jest.fn().mockResolvedValue(csvContent),
      };
      mockRepositorySuccess();

      const result = await csvImporter.importCsv(mockFile);

      expect(result.message).toBe('CSV imported successfully. 1 expenses added.');
      expect(result.importedCount).toBe(1);
      expect(mockExpenseRepository.addExpense).toHaveBeenCalledTimes(1);
      expect(mockExpenseRepository.addExpense).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 'cat_groceries',
      }));
      expect(mockFile.text).toHaveBeenCalled();
    });

    it('should reject if File object text() method fails', async () => {
        const mockFile = {
            name: 'test.csv',
            type: 'text/csv',
            text: jest.fn().mockRejectedValue(new Error('Read error')),
        };
        await expect(csvImporter.importCsv(mockFile))
            .rejects.toMatchObject({
                message: "CSV import failed.",
                errors: ["Error reading file object: Read error"],
            });
    });
  });

  it('should reject with invalid argument if neither path nor File object is provided', async () => {
    await expect(csvImporter.importCsv(null))
        .rejects.toMatchObject({
            message: "CSV import failed.",
            errors: ["Invalid argument: Expected a file path (string) or a File object."],
        });
    await expect(csvImporter.importCsv({})) // Empty object
        .rejects.toMatchObject({
            message: "CSV import failed.",
            errors: ["Invalid argument: Expected a file path (string) or a File object."],
        });
  });

  it('should handle empty CSV file', async () => {
    const csvContent = `${validCsvHeader}\n`; // Only header
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();

    const result = await csvImporter.importCsv('dummy/empty.csv');
    expect(result.message).toBe('CSV imported successfully. No data rows found to import.');
    expect(result.importedCount).toBe(0);
    expect(mockExpenseRepository.addExpense).not.toHaveBeenCalled();
  });

  it('should return errors for rows with missing required fields', async () => {
    const csvContent = `${validCsvHeader}\n2023-01-15,,Category,Description`; // Missing Amount
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();

    await expect(csvImporter.importCsv('dummy/invalid.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        errors: [expect.stringContaining("Missing required fields (Date, Amount, 'Expense Category')")],
        importedCount: 0,
      });
    expect(mockExpenseRepository.addExpense).not.toHaveBeenCalled();
  });

  it('should return errors for rows with invalid Amount', async () => {
    const csvContent = `${validCsvHeader}\n2023-01-15,NotANumber,Category,Description`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();

    await expect(csvImporter.importCsv('dummy/invalid_amount.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        errors: [expect.stringContaining("Invalid or non-positive Amount")],
        importedCount: 0,
      });
  });

  it('should return errors for rows with invalid Date', async () => {
    const csvContent = `${validCsvHeader}\nNotADate,100,Category,Description`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();

    await expect(csvImporter.importCsv('dummy/invalid_date.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        errors: [expect.stringContaining("Invalid Date format")],
        importedCount: 0,
      });
  });

  it('should report error if findOrCreateCategory fails for a required category', async () => {
    const csvContent = `${validCsvHeader}\n${validCsvRow1}`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);

    mockRepositorySuccess(); // Base success
    mockExpenseRepository.findOrCreateCategory.mockImplementationOnce(name => Promise.resolve(null)); // Fail for 'Groceries'

    await expect(csvImporter.importCsv('dummy/cat_fail.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        errors: [expect.stringContaining('Failed to find or create Expense Category: "Groceries"')],
        importedCount: 0,
      });
    expect(mockExpenseRepository.addExpense).not.toHaveBeenCalled();
  });

  it('should report error if addExpense fails', async () => {
    const csvContent = `${validCsvHeader}\n${validCsvRow1}`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();
    mockExpenseRepository.addExpense.mockRejectedValueOnce(new Error('DB insertion error'));

    await expect(csvImporter.importCsv('dummy/add_fail.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        errors: [expect.stringContaining("Database insertion error for row")],
        importedCount: 0,
      });
  });

  it('should handle partial success: some rows imported, some fail', async () => {
    const failingCsvRow = "2023-01-17,fifty,BadCategory,This will fail"; // Invalid amount
    const csvContent = `${validCsvHeader}\n${validCsvRow1}\n${failingCsvRow}\n${validCsvRow2}`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);
    mockRepositorySuccess();

    await expect(csvImporter.importCsv('dummy/partial_fail.csv'))
        .rejects.toMatchObject({
            message: "CSV import completed with 2 successful imports and errors.",
            errors: [expect.stringContaining("Invalid or non-positive Amount")],
            importedCount: 2,
        });
    expect(mockExpenseRepository.addExpense).toHaveBeenCalledTimes(2);
     // Check that it was called with data from validCsvRow1 and validCsvRow2
    expect(mockExpenseRepository.addExpense).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat_groceries' }));
    expect(mockExpenseRepository.addExpense).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat_transport' }));
  });

  it('should report error if ExpenseRepository methods are missing', async () => {
    csvImporter = new CsvImporter(mockDatabaseManager, {}); // Empty repository
    const csvContent = `${validCsvHeader}\n${validCsvRow1}`;
    const mockStream = Readable.from([csvContent]);
    fs.existsSync.mockReturnValue(true);
    fs.createReadStream.mockReturnValue(mockStream);

    await expect(csvImporter.importCsv('dummy/repo_missing_methods.csv'))
      .rejects.toMatchObject({
        message: "CSV import failed with errors.",
        // The error message will be "ExpenseRepository or its required methods are not available."
        // which is caught by the generic catch block in _processRow
        errors: [expect.stringContaining("Error processing entities for row")],
        importedCount: 0,
      });
  });

});
