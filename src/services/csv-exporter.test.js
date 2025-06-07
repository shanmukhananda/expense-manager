const CsvExporter = require('./csv-exporter'); // Assuming CsvExporter is exported with module.exports

describe('CsvExporter', () => {
  let mockExpenseRepository;
  let csvExporter;

  beforeEach(() => {
    mockExpenseRepository = {
      getAllExpenses: jest.fn(),
    };
    csvExporter = new CsvExporter(mockExpenseRepository);
  });

  const headerRow = "Date,Amount,Expense Category,Expense Description,Expense Group,Payer,Payment mode";

  it('should export valid expense data to CSV string', async () => {
    const expensesData = [
      {
        date: new Date(2023, 0, 15), // Month is 0-indexed
        amount: 150.75,
        categoryName: 'Food',
        description: 'Dinner with friends, includes "quotes" and commas',
        groupName: 'Social',
        payerName: 'Alice',
        paymentModeName: 'Credit Card',
      },
      {
        date: '2023-01-16', // String date
        amount: 25.00,
        categoryName: 'Transport',
        description: 'Bus ticket',
        groupName: '', // Empty group name
        payerName: 'Bob',
        paymentModeName: 'Cash',
      },
      { // Test with nested entity structure
        date: '2023-01-17',
        amount: 50.00,
        Category: { name: 'Utilities' },
        description: 'Electricity Bill',
        ExpenseGroup: { name: 'Household' },
        Payer: { name: 'Charlie' },
        PaymentMode: { name: 'Online' },
      }
    ];
    mockExpenseRepository.getAllExpenses.mockResolvedValue(expensesData);

    const csvString = await csvExporter.exportCsv();

    const expectedRows = [
      headerRow,
      '2023-01-15,150.75,Food,"Dinner with friends, includes ""quotes"" and commas",Social,Alice,Credit Card',
      '2023-01-16,25.00,Transport,Bus ticket,,Bob,Cash',
      '2023-01-17,50.00,Utilities,Electricity Bill,Household,Charlie,Online'
    ];
    const expectedCsvString = expectedRows.join('\n');

    expect(csvString).toBe(expectedCsvString);
    expect(mockExpenseRepository.getAllExpenses).toHaveBeenCalledTimes(1);
  });

  it('should return only header row if no expenses are found', async () => {
    mockExpenseRepository.getAllExpenses.mockResolvedValue([]);
    const csvString = await csvExporter.exportCsv();
    expect(csvString).toBe(`${headerRow}\n`);
  });

  it('should return only header row if expenses is null', async () => {
    mockExpenseRepository.getAllExpenses.mockResolvedValue(null);
    const csvString = await csvExporter.exportCsv();
    expect(csvString).toBe(`${headerRow}\n`);
  });

  it('should handle undefined or null values in optional fields gracefully', async () => {
    const expensesData = [
      {
        date: '2023-02-01',
        amount: 10.00,
        categoryName: 'Snacks',
        description: undefined, // undefined description
        groupName: null,       // null groupName
        payerName: 'Dave',
        paymentModeName: 'Debit Card',
      },
    ];
    mockExpenseRepository.getAllExpenses.mockResolvedValue(expensesData);

    const csvString = await csvExporter.exportCsv();
    const expectedCsvString = `${headerRow}\n2023-02-01,10.00,Snacks,,Dave,Debit Card`;
    expect(csvString).toBe(expectedCsvString);
  });

  it('should re-throw error if getAllExpenses fails', async () => {
    const errorMessage = "Database connection lost";
    mockExpenseRepository.getAllExpenses.mockRejectedValue(new Error(errorMessage));

    await expect(csvExporter.exportCsv()).rejects.toThrow(`Failed to export CSV: ${errorMessage}`);
  });

  it('should correctly format dates even if they are already strings in YYYY-MM-DD format', async () => {
    const expensesData = [
      {
        date: '2024-03-20', // Already a string
        amount: 99.99,
        categoryName: 'Test',
        description: 'Test Desc',
        groupName: 'Test Group',
        payerName: 'Test Payer',
        paymentModeName: 'Test Mode',
      },
    ];
    mockExpenseRepository.getAllExpenses.mockResolvedValue(expensesData);
    const csvString = await csvExporter.exportCsv();
    expect(csvString).toContain('2024-03-20,99.99');
  });

  it('should return empty string for date if date is invalid or unparseable in expense data', async () => {
    const expensesData = [
      {
        date: 'Invalid Date String',
        amount: 10.00,
        categoryName: 'Test',
        description: 'Test',
        groupName: 'Test',
        payerName: 'Test',
        paymentModeName: 'Test',
      },
      {
        date: null, // null date
        amount: 20.00,
        categoryName: 'Another Test',
        description: 'Test 2',
        groupName: 'Test 2',
        payerName: 'Test 2',
        paymentModeName: 'Test 2',
      }
    ];
    mockExpenseRepository.getAllExpenses.mockResolvedValue(expensesData);
    const csvString = await csvExporter.exportCsv();
    const rows = csvString.split('\n');
    expect(rows[1].startsWith(',10.00')).toBe(true); // Date becomes empty
    expect(rows[2].startsWith(',20.00')).toBe(true); // Date becomes empty
  });

});
