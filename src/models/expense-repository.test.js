const ExpenseRepository = require('./expense-repository');

describe('ExpenseRepository', () => {
  describe('_aggregateAnalyticsData', () => {
    let repo;

    beforeEach(() => {
      repo = new ExpenseRepository(null); // dbManager is not used by _aggregateAnalyticsData
    });

    it('Test 1: should return zeros and empty breakdown for an empty input array', () => {
      const rows = [];
      const expectedOutput = {
        overallTotal: 0,
        totalFilteredCount: 0,
        categoryBreakdown: [],
        totalAfterRefunds: 0,
      };
      expect(repo._aggregateAnalyticsData(rows)).toEqual(expectedOutput);
    });

    it('Test 2: should correctly calculate totals and breakdown with no refund transactions', () => {
      const rows = [
        { amount: 100, category_name: 'Food', expense_category_id: 1 },
        { amount: 50, category_name: 'Transport', expense_category_id: 2 },
      ];
      const expectedOutput = {
        overallTotal: 150.00,
        totalFilteredCount: 2,
        categoryBreakdown: [
          { categoryId: 1, categoryName: 'Food', totalAmount: 100.00, percentage: parseFloat(((100/150)*100).toFixed(2)) },
          { categoryId: 2, categoryName: 'Transport', totalAmount: 50.00, percentage: parseFloat(((50/150)*100).toFixed(2)) },
        ],
        totalAfterRefunds: 150.00,
      };
      const result = repo._aggregateAnalyticsData(rows);
      expect(result.overallTotal).toBeCloseTo(expectedOutput.overallTotal);
      expect(result.totalFilteredCount).toBe(expectedOutput.totalFilteredCount);
      expect(result.totalAfterRefunds).toBeCloseTo(expectedOutput.totalAfterRefunds);
      expect(result.categoryBreakdown).toEqual(expect.arrayContaining([
        expect.objectContaining(expectedOutput.categoryBreakdown[0]),
        expect.objectContaining(expectedOutput.categoryBreakdown[1]),
      ]));
      // Check sorting
      expect(result.categoryBreakdown[0].totalAmount).toBeGreaterThanOrEqual(result.categoryBreakdown[1].totalAmount);
    });

    it('Test 3: should correctly calculate totals and breakdown with refund transactions', () => {
      const rows = [
        { amount: 100, category_name: 'Salary', expense_category_id: 1 },
        { amount: 20, category_name: 'Refund', expense_category_id: 2 }, // This is a refund
        { amount: 30, category_name: 'Food', expense_category_id: 3 },
      ];
      const expectedOutput = {
        overallTotal: 150.00, // 100 + 20 + 30
        totalFilteredCount: 3,
        categoryBreakdown: [
          { categoryId: 1, categoryName: 'Salary', totalAmount: 100.00, percentage: parseFloat(((100/150)*100).toFixed(2)) },
          { categoryId: 3, categoryName: 'Food', totalAmount: 30.00, percentage: parseFloat(((30/150)*100).toFixed(2)) },
          { categoryId: 2, categoryName: 'Refund', totalAmount: 20.00, percentage: parseFloat(((20/150)*100).toFixed(2)) },
        ],
        totalAfterRefunds: 110.00, // 100 - 20 + 30
      };
      const result = repo._aggregateAnalyticsData(rows);
      expect(result.overallTotal).toBeCloseTo(expectedOutput.overallTotal);
      expect(result.totalFilteredCount).toBe(expectedOutput.totalFilteredCount);
      expect(result.totalAfterRefunds).toBeCloseTo(expectedOutput.totalAfterRefunds);
      // Sort expected breakdown for comparison as order might differ before sorting in function
      const sortedExpectedCategoryBreakdown = expectedOutput.categoryBreakdown.sort((a,b) => b.totalAmount - a.totalAmount);
      result.categoryBreakdown.forEach((item, index) => {
        expect(item.categoryId).toBe(sortedExpectedCategoryBreakdown[index].categoryId);
        expect(item.categoryName).toBe(sortedExpectedCategoryBreakdown[index].categoryName);
        expect(item.totalAmount).toBeCloseTo(sortedExpectedCategoryBreakdown[index].totalAmount);
        expect(item.percentage).toBeCloseTo(sortedExpectedCategoryBreakdown[index].percentage);
      });
    });

    it('Test 4: should correctly calculate totals when all transactions are refunds', () => {
      const rows = [
        { amount: 50, category_name: 'Refund', expense_category_id: 1 },
        { amount: 30, category_name: 'Refund', expense_category_id: 1 }, // Note: same category_id for refunds
      ];
      const expectedOutput = {
        overallTotal: 80.00,
        totalFilteredCount: 2,
        categoryBreakdown: [
          { categoryId: 1, categoryName: 'Refund', totalAmount: 80.00, percentage: 100.00 },
        ],
        totalAfterRefunds: -80.00,
      };
      const result = repo._aggregateAnalyticsData(rows);
      expect(result.overallTotal).toBeCloseTo(expectedOutput.overallTotal);
      expect(result.totalFilteredCount).toBe(expectedOutput.totalFilteredCount);
      expect(result.totalAfterRefunds).toBeCloseTo(expectedOutput.totalAfterRefunds);
      expect(result.categoryBreakdown).toEqual(expect.arrayContaining([
        expect.objectContaining(expectedOutput.categoryBreakdown[0]),
      ]));
    });

    it('Test 5: should correctly calculate totals with mixed transactions and multiple refunds', () => {
      const rows = [
        { amount: 200, category_name: 'Electronics', expense_category_id: 1 },
        { amount: 25, category_name: 'Refund', expense_category_id: 2 },
        { amount: 75, category_name: 'Books', expense_category_id: 3 },
        { amount: 10, category_name: 'Refund', expense_category_id: 2 }, // Another refund to the same category
      ];
      // overallTotal = 200 + 25 + 75 + 10 = 310
      // totalAfterRefunds = 200 - 25 + 75 - 10 = 240
      // Category Breakdown:
      // Electronics (1): 200 (64.52%)
      // Books (3): 75 (24.19%)
      // Refund (2): 25 + 10 = 35 (11.29%)
      const expectedOutput = {
        overallTotal: 310.00,
        totalFilteredCount: 4,
        categoryBreakdown: [
          { categoryId: 1, categoryName: 'Electronics', totalAmount: 200.00, percentage: parseFloat(((200/310)*100).toFixed(2)) },
          { categoryId: 3, categoryName: 'Books', totalAmount: 75.00, percentage: parseFloat(((75/310)*100).toFixed(2)) },
          { categoryId: 2, categoryName: 'Refund', totalAmount: 35.00, percentage: parseFloat(((35/310)*100).toFixed(2)) },
        ],
        totalAfterRefunds: 240.00,
      };
      const result = repo._aggregateAnalyticsData(rows);
      expect(result.overallTotal).toBeCloseTo(expectedOutput.overallTotal);
      expect(result.totalFilteredCount).toBe(expectedOutput.totalFilteredCount);
      expect(result.totalAfterRefunds).toBeCloseTo(expectedOutput.totalAfterRefunds);

      // Sort expected breakdown for comparison
      const sortedExpectedCategoryBreakdown = expectedOutput.categoryBreakdown.sort((a,b) => b.totalAmount - a.totalAmount);
      result.categoryBreakdown.forEach((item, index) => {
        expect(item.categoryId).toBe(sortedExpectedCategoryBreakdown[index].categoryId);
        expect(item.categoryName).toBe(sortedExpectedCategoryBreakdown[index].categoryName);
        expect(item.totalAmount).toBeCloseTo(sortedExpectedCategoryBreakdown[index].totalAmount);
        expect(item.percentage).toBeCloseTo(sortedExpectedCategoryBreakdown[index].percentage);
      });
    });

    it('should handle category name correctly if representative row for a category is a refund', () => {
      const rows = [
        { amount: 100, category_name: 'Food', expense_category_id: 1 },
        { amount: 20, category_name: 'Refund', expense_category_id: 2 },
        { amount: 50, category_name: 'Transport', expense_category_id: 3 },
      ];
      // overallTotal = 170
      // totalAfterRefunds = 100 - 20 + 50 = 130
      const result = repo._aggregateAnalyticsData(rows);
      expect(result.overallTotal).toBeCloseTo(170.00);
      expect(result.totalAfterRefunds).toBeCloseTo(130.00);
      expect(result.categoryBreakdown).toEqual(expect.arrayContaining([
        expect.objectContaining({ categoryId: 1, categoryName: 'Food', totalAmount: 100.00, percentage: parseFloat(((100/170)*100).toFixed(2)) }),
        expect.objectContaining({ categoryId: 3, categoryName: 'Transport', totalAmount: 50.00, percentage: parseFloat(((50/170)*100).toFixed(2)) }),
        expect.objectContaining({ categoryId: 2, categoryName: 'Refund', totalAmount: 20.00, percentage: parseFloat(((20/170)*100).toFixed(2)) }),
      ]));
      // Check sorting
      expect(result.categoryBreakdown[0].categoryName).toBe('Food');
      expect(result.categoryBreakdown[1].categoryName).toBe('Transport');
      expect(result.categoryBreakdown[2].categoryName).toBe('Refund');
    });
  });
});
