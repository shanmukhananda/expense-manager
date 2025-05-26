// public/js/analyticsManager.js

export class AnalyticsManager {
    /**
     * Constructor for AnalyticsManager.
     * @param {UIManager} uiManager - Instance of UIManager for generic UI tasks (e.g., modals).
     * @param {HTMLElement} filtersContainer - The DOM element to host filter controls.
     * @param {HTMLElement} resultsContainer - The DOM element to display analytics results.
     */
    constructor(uiManager, filtersContainer, resultsContainer) {
        this.uiManager = uiManager; // For modals or other shared UI functions
        this.filtersContainer = filtersContainer;
        this.resultsContainer = resultsContainer;

        // These will store references to dynamically created/managed elements within the containers
        this.elements = {
            startDateInput: null,
            endDateInput: null,
            allTimeBtn: null,
            categorySelect: null,
            paymentModeSelect: null,
            applyFiltersBtn: null,
            // Results elements (if specific ones are needed beyond just clearing the container)
            // e.g., analyticsTotalAmountText, analyticsTotalCountText, analyticsCategoryResultsTableBody
        }; 
    }

    /**
     * Caches references to dynamically created filter input elements.
     * This method will be called internally after filter HTML is rendered.
     * @private
     */
    _cacheFilterElements() {
        if (this.filtersContainer) {
            this.elements.startDateInput = this.filtersContainer.querySelector('#analytics-start-date');
            this.elements.endDateInput = this.filtersContainer.querySelector('#analytics-end-date');
            this.elements.allTimeBtn = this.filtersContainer.querySelector('#analytics-all-time-btn');
            this.elements.categorySelect = this.filtersContainer.querySelector('#analytics-category-select');
            this.elements.paymentModeSelect = this.filtersContainer.querySelector('#analytics-payment-mode-select');
            this.elements.applyFiltersBtn = this.filtersContainer.querySelector('#analytics-apply-filters-btn');
        }
    }

    renderAnalyticsFilters(masterData, applyFiltersCallback) {
        this.filtersContainer.innerHTML = ''; // Clear previous filters

        const filtersHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                <!-- Date Range Section -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="text-md font-semibold text-gray-700 mb-3">Date Range</h4>
                    <div class="space-y-2">
                        <div>
                            <label for="analytics-start-date" class="block text-sm font-medium text-gray-700">Start Date:</label>
                            <input type="date" id="analytics-start-date" class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <label for="analytics-end-date" class="block text-sm font-medium text-gray-700">End Date:</label>
                            <input type="date" id="analytics-end-date" class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <button id="analytics-all-time-btn" class="mt-2 w-full text-sm text-blue-600 hover:text-blue-800 focus:outline-none">All Time</button>
                    </div>
                </div>

                <!-- Category Filter Section -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="text-md font-semibold text-gray-700 mb-3">Categories</h4>
                    <select id="analytics-category-select" multiple class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32">
                        <option value="">All Categories</option>
                        ${masterData.categories && masterData.categories.map(category => `<option value="${category.id}">${category.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Payment Mode Filter Section -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="text-md font-semibold text-gray-700 mb-3">Payment Modes</h4>
                    <select id="analytics-payment-mode-select" multiple class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32">
                        <option value="">All Payment Modes</option>
                        ${masterData.paymentModes && masterData.paymentModes.map(pm => `<option value="${pm.id}">${pm.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="flex justify-end mt-4">
                <button id="analytics-apply-filters-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">Apply Filters</button>
            </div>
        `;

        this.filtersContainer.innerHTML = filtersHTML;

        // Cache the newly created elements by calling the internal caching method
        this._cacheFilterElements();

        // Set default end date to today and start date to first day of current month
        if (this.elements.endDateInput && this.elements.startDateInput) {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            this.elements.endDateInput.valueAsDate = today;
            this.elements.startDateInput.valueAsDate = firstDayOfMonth;
        }

        // Add event listeners
        if (this.elements.applyFiltersBtn) {
             this.elements.applyFiltersBtn.addEventListener('click', applyFiltersCallback);
        }
        if (this.elements.allTimeBtn) {
            this.elements.allTimeBtn.addEventListener('click', () => {
                if (this.elements.startDateInput) this.elements.startDateInput.value = '';
                if (this.elements.endDateInput) this.elements.endDateInput.value = '';
            });
        }
    }

    getAnalyticsFilterValues() {
        const startDate = this.elements.startDateInput ? this.elements.startDateInput.value : '';
        const endDate = this.elements.endDateInput ? this.elements.endDateInput.value : '';

        let categoryIds = [];
        if (this.elements.categorySelect) {
            categoryIds = Array.from(this.elements.categorySelect.selectedOptions)
                .map(opt => opt.value)
                .filter(val => val !== ""); // Filter out the "All Categories" option if it has value ""
        }

        let paymentModeIds = [];
        if (this.elements.paymentModeSelect) {
            paymentModeIds = Array.from(this.elements.paymentModeSelect.selectedOptions)
                .map(opt => opt.value)
                .filter(val => val !== ""); // Filter out the "All Payment Modes" option
        }

        return {
            startDate,
            endDate,
            categoryIds,
            paymentModeIds
        };
    }

    renderAnalyticsResults(analyticsData) {
        this.resultsContainer.innerHTML = ''; // Clear previous results

        if (!analyticsData || analyticsData.totalFilteredCount === 0) {
            this.resultsContainer.innerHTML = `
                <div class="bg-white p-6 rounded-lg shadow text-center">
                    <p class="text-gray-600 text-lg">No data matches your current filter selection.</p>
                    <p class="text-gray-500 text-sm">Try adjusting the date range or selecting different categories/payment modes.</p>
                </div>
            `;
            return;
        }

        const resultsHTML = `
            <div class="bg-white p-6 rounded-lg shadow mb-6">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Overall Summary</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-gray-600">Total Expenses (Filtered):</p>
                        <p class="text-2xl font-bold text-blue-600">${analyticsData.overallTotal.toFixed(2)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">Number of Transactions:</p>
                        <p class="text-2xl font-bold text-blue-600">${analyticsData.totalFilteredCount}</p>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-xl font-semibold text-gray-800 mb-4">Category Breakdown</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                            </tr>
                        </thead>
                        <tbody id="analytics-category-tbody" class="bg-white divide-y divide-gray-200">
                            <!-- Rows will be injected here by JavaScript -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        this.resultsContainer.innerHTML = resultsHTML;

        const tableBody = this.resultsContainer.querySelector('#analytics-category-tbody'); // Query within resultsContainer
        if (tableBody) {
            if (analyticsData.categoryBreakdown && analyticsData.categoryBreakdown.length > 0) {
                analyticsData.categoryBreakdown.forEach(item => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.categoryName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${item.totalAmount.toFixed(2)}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${item.percentage.toFixed(2)}%</td>
                    `;
                });
            } else if (analyticsData.overallTotal > 0) {
                 const row = tableBody.insertRow();
                 row.innerHTML = `<td colspan="3" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No category-specific data to display, but there are overall expenses.</td>`;
            } else {
                 const row = tableBody.insertRow();
                 row.innerHTML = `<td colspan="3" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">No category breakdown available.</td>`;
            }
        }
    }
}
