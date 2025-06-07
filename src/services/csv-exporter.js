const { format } = require('date-fns'); // Using date-fns for robust date formatting

class CsvExporter {
  constructor(expenseRepository) {
    this.expenseRepository = expenseRepository;
  }

  async exportCsv() {
    try {
      const expenses = await this.expenseRepository.getAllExpenses();
      if (!expenses || expenses.length === 0) {
        return "Date,Amount,Expense Category,Expense Description,Expense Group,Payer,Payment mode\n"; // Header only for no data
      }

      const header = "Date,Amount,Expense Category,Expense Description,Expense Group,Payer,Payment mode";

      // Assuming expenses are objects with direct values or resolved entity names.
      // If entities are IDs, we'd need to fetch their names here,
      // possibly by adding methods to ExpenseRepository like `getCategoryNameById`, etc.
      // For now, this assumes expense objects have fields like:
      // expense.date, expense.amount, expense.categoryName, expense.description,
      // expense.groupName, expense.payerName, expense.paymentModeName
      // If they have IDs like categoryId, then a lookup is needed.

      const csvRows = expenses.map(expense => {
        // Ensure data is properly formatted and quoted if it contains commas or quotes
        const formatDate = (date) => {
            try {
                // Attempt to format, assuming date is a Date object or a string parseable by new Date()
                return format(new Date(date), 'yyyy-MM-dd');
            } catch (e) {
                // Fallback for invalid dates or if date is already a string in the correct format
                return date ? String(date).split('T')[0] : '';
            }
        };

        const escapeCsvCell = (cellData) => {
          const stringData = cellData === null || typeof cellData === 'undefined' ? '' : String(cellData);
          if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
            return `"${stringData.replace(/"/g, '""')}"`; // Escape quotes and wrap in double quotes
          }
          return stringData;
        };

        // These fields might need adjustment based on the actual structure of 'expense' objects
        // from getAllExpenses(). For example, if category is an object expense.category.name
        // or if it's an ID, e.g. expense.categoryId that needs to be resolved to a name.
        // The current placeholder assumes direct or easily resolvable names.
        const category = expense.categoryName || (expense.Category ? expense.Category.name : '');
        const group = expense.groupName || (expense.ExpenseGroup ? expense.ExpenseGroup.name : '');
        const payer = expense.payerName || (expense.Payer ? expense.Payer.name : '');
        const paymentMode = expense.paymentModeName || (expense.PaymentMode ? expense.PaymentMode.name : '');


        return [
          formatDate(expense.date),
          expense.amount,
          escapeCsvCell(category),
          escapeCsvCell(expense.description),
          escapeCsvCell(group),
          escapeCsvCell(payer),
          escapeCsvCell(paymentMode)
        ].join(',');
      });

      return [header, ...csvRows].join('\n');
    } catch (error) {
      console.error("Error exporting CSV:", error);
      // Depending on desired error handling, could throw error or return an error message/status
      throw new Error(`Failed to export CSV: ${error.message}`);
    }
  }
}

module.exports = CsvExporter;
