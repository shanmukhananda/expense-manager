import { AnalyticsManager } from './analytics-controller'; // Using ES6 module syntax

describe('AnalyticsManager', () => {
  let analyticsManager;
  let mockUiManager;
  let mockFiltersContainer;
  let mockResultsContainer;

  beforeEach(() => {
    mockUiManager = {
      renderExpenses: jest.fn(),
      // Add any other methods that might be called by AnalyticsManager if necessary
    };

    // Create actual DOM elements for testing environment
    // These will be available globally in jsdom environment
    mockFiltersContainer = document.createElement('div');
    document.body.appendChild(mockFiltersContainer); // Append to body to allow querySelector to find them if needed globally

    mockResultsContainer = document.createElement('div');
    document.body.appendChild(mockResultsContainer);

    // Add IDs if your controller code uses getElementById
    mockFiltersContainer.id = 'mock-filters-container';
    mockResultsContainer.id = 'mock-results-container';


    analyticsManager = new AnalyticsManager(mockUiManager, mockFiltersContainer, mockResultsContainer);
  });

  afterEach(() => {
    // Clean up DOM elements
    document.body.removeChild(mockFiltersContainer);
    document.body.removeChild(mockResultsContainer);
    jest.restoreAllMocks(); // Restores all spies and mocks
  });

  describe('_renderSummarySection', () => {
    it('should include overallTotal, totalFilteredCount, and totalAfterRefunds in the output', () => {
      const overallTotal = 100;
      const totalFilteredCount = 5;
      const totalAfterRefunds = 75;
      const resultHtml = analyticsManager._renderSummarySection(overallTotal, totalFilteredCount, totalAfterRefunds);

      expect(resultHtml).toContain('Total Expenses (Filtered): <span class="font-bold text-blue-600">100.00</span>');
      expect(resultHtml).toContain('Total Transactions: <span class="font-bold text-blue-600">5</span>');
      // Note: The color class was text-blue-600 in the actual implementation change for totalAfterRefunds
      expect(resultHtml).toContain('Total After Refunds: <span class="font-bold text-blue-600">75.00</span>');
    });

    it('should correctly format numbers to two decimal places', () => {
      const overallTotal = 123.456;
      const totalFilteredCount = 2;
      const totalAfterRefunds = 98.765;
      const resultHtml = analyticsManager._renderSummarySection(overallTotal, totalFilteredCount, totalAfterRefunds);

      expect(resultHtml).toContain('123.46');
      expect(resultHtml).toContain('98.77');
      // Ensure totalFilteredCount is not formatted to two decimal places
      expect(resultHtml).toContain('Total Transactions: <span class="font-bold text-blue-600">2</span>');
      expect(resultHtml).not.toContain('2.00');
    });
  });

  describe('renderAnalyticsResults', () => {
    it('should call _renderSummarySection with overallTotal, totalFilteredCount, and totalAfterRefunds from analyticsData', () => {
      const analyticsData = {
        overallTotal: 200,
        totalFilteredCount: 10,
        totalAfterRefunds: 150,
        categoryBreakdown: [],
        filteredExpenses: []
      };

      const renderSummarySpy = jest.spyOn(analyticsManager, '_renderSummarySection');

      // Mock querySelector for #analytics-filtered-expenses-list as it's called in _renderFilteredExpensesSection
      // which is called by renderAnalyticsResults
      const mockExpenseListContainer = document.createElement('div');
      jest.spyOn(mockResultsContainer, 'querySelector').mockImplementation(selector => {
        if (selector === '#analytics-filtered-expenses-list') {
          return mockExpenseListContainer;
        }
        return null;
      });

      analyticsManager.renderAnalyticsResults(analyticsData);

      expect(renderSummarySpy).toHaveBeenCalledWith(200, 10, 150);
    });

    it('should pass totalAfterRefunds (including 0 or negative) from analyticsData to _renderSummarySection', () => {
      const analyticsData = {
        overallTotal: 50,
        totalFilteredCount: 2,
        totalAfterRefunds: -20, // e.g. only refunds
        categoryBreakdown: [],
        filteredExpenses: []
      };
      const renderSummarySpy = jest.spyOn(analyticsManager, '_renderSummarySection');
      const mockExpenseListContainer = document.createElement('div');
      jest.spyOn(mockResultsContainer, 'querySelector').mockImplementation(selector => {
        if (selector === '#analytics-filtered-expenses-list') {
          return mockExpenseListContainer;
        }
        return null;
      });

      analyticsManager.renderAnalyticsResults(analyticsData);
      expect(renderSummarySpy).toHaveBeenCalledWith(50, 2, -20);
    });

    it('should parse totalAfterRefunds from analyticsData as float', () => {
        const analyticsData = {
            overallTotal: "200.50",
            totalFilteredCount: "10",
            totalAfterRefunds: "150.25", // Ensure this is parsed
            categoryBreakdown: [],
            filteredExpenses: []
        };
        const renderSummarySpy = jest.spyOn(analyticsManager, '_renderSummarySection');
        const mockExpenseListContainer = document.createElement('div');
        jest.spyOn(mockResultsContainer, 'querySelector').mockImplementation(selector => {
            if (selector === '#analytics-filtered-expenses-list') {
            return mockExpenseListContainer;
            }
            return null;
        });

        analyticsManager.renderAnalyticsResults(analyticsData);
        // Values are parsed to float/int in renderAnalyticsResults
        expect(renderSummarySpy).toHaveBeenCalledWith(200.50, 10, 150.25);
    });


    it('should display "No expenses match..." if totalFilteredCount is 0 and other data is empty', () => {
        analyticsManager.renderAnalyticsResults({
            overallTotal: 0,
            totalFilteredCount: 0,
            totalAfterRefunds: 0,
            categoryBreakdown: [],
            filteredExpenses: []
        });
        expect(mockResultsContainer.innerHTML).toContain('No expenses match the selected filters.');
    });

    it('should display "Analytics data is currently unavailable." if analyticsData is null', () => {
        analyticsManager.renderAnalyticsResults(null);
        expect(mockResultsContainer.innerHTML).toContain('Analytics data is currently unavailable.');
    });

    it('should render category breakdown and filtered expenses if available', () => {
        const analyticsData = {
            overallTotal: 100,
            totalFilteredCount: 1,
            totalAfterRefunds: 100,
            categoryBreakdown: [{ categoryId: 1, categoryName: 'Food', totalAmount: 100, percentage: 100 }],
            filteredExpenses: [{ id: 1, description: 'Lunch' }]
        };
        const renderSummarySpy = jest.spyOn(analyticsManager, '_renderSummarySection');
        const renderCategoryBreakdownSpy = jest.spyOn(analyticsManager, '_renderCategoryBreakdownTable');
        const renderFilteredExpensesSpy = jest.spyOn(analyticsManager, '_renderFilteredExpensesSection');

        const mockExpenseListContainer = document.createElement('div');
        jest.spyOn(mockResultsContainer, 'querySelector').mockImplementation(selector => {
            if (selector === '#analytics-filtered-expenses-list') {
                return mockExpenseListContainer;
            }
            return null;
        });

        analyticsManager.setExpenseActionCallbacks(jest.fn(), jest.fn()); // Set dummy callbacks
        analyticsManager.renderAnalyticsResults(analyticsData);

        expect(renderSummarySpy).toHaveBeenCalledWith(100, 1, 100);
        expect(renderCategoryBreakdownSpy).toHaveBeenCalledWith(analyticsData.categoryBreakdown);
        expect(renderFilteredExpensesSpy).toHaveBeenCalledWith(analyticsData.filteredExpenses);
        expect(mockUiManager.renderExpenses).toHaveBeenCalledWith(analyticsData.filteredExpenses, mockExpenseListContainer, expect.any(Function), expect.any(Function));
        expect(mockResultsContainer.innerHTML).toContain('Category Breakdown');
        expect(mockResultsContainer.innerHTML).toContain('Filtered Expense Details');
    });
  });
});
