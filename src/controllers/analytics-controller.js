// src/controllers/analytics-controller.js

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
            groupSelect: null, // Added
            payerSelect: null,   // Added
            applyFiltersBtn: null,
        };
        this.onEditExpense = null;
        this.onDeleteExpense = null;
    }

    /**
     * Sets callback functions for handling expense edit and delete actions.
     * These callbacks are typically provided by AppController and will be passed to UIManager.
     * @param {Function|null} onEdit - Callback for editing an expense.
     * @param {Function|null} onDelete - Callback for deleting an expense.
     */
    setExpenseActionCallbacks(onEdit, onDelete) {
        this.onEditExpense = onEdit;
        this.onDeleteExpense = onDelete;
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
            this.elements.groupSelect = this.filtersContainer.querySelector('#analytics-group-select'); // Added
            this.elements.payerSelect = this.filtersContainer.querySelector('#analytics-payer-select');   // Added
            this.elements.applyFiltersBtn = this.filtersContainer.querySelector('#analytics-apply-filters-btn');
        }
    }

    renderAnalyticsFilters(masterData, applyFiltersCallback) {
        this.filtersContainer.innerHTML = ''; // Clear previous filters

        // Adjusted grid to better accommodate more filters: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
        const filtersHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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

                <!-- Expense Group Filter Section -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="text-md font-semibold text-gray-700 mb-3">Expense Groups</h4>
                    <select id="analytics-group-select" multiple class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32">
                        <option value="">All Groups</option>
                        ${masterData.groups && masterData.groups.map(group => `<option value="${group.id}">${group.name}</option>`).join('')}
                    </select>
                </div>

                <!-- Payer Filter Section -->
                <div class="bg-white p-4 rounded-lg shadow">
                    <h4 class="text-md font-semibold text-gray-700 mb-3">Payers</h4>
                    <select id="analytics-payer-select" multiple class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32">
                        <option value="">All Payers</option>
                        ${masterData.payers && masterData.payers.map(payer => `<option value="${payer.id}">${payer.name}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="flex justify-end mt-4">
                <button id="analytics-apply-filters-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">Apply Filters</button>
            </div>
        `;

        this.filtersContainer.innerHTML = filtersHTML;

        this._cacheFilterElements();

        if (this.elements.endDateInput && this.elements.startDateInput) {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            this.elements.endDateInput.valueAsDate = today;
            this.elements.startDateInput.valueAsDate = firstDayOfMonth;
        }

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
                .filter(val => val !== ""); 
        }

        let paymentModeIds = [];
        if (this.elements.paymentModeSelect) {
            paymentModeIds = Array.from(this.elements.paymentModeSelect.selectedOptions)
                .map(opt => opt.value)
                .filter(val => val !== ""); 
        }

        // Added for new filters
        let groupIds = [];
        if (this.elements.groupSelect) {
            groupIds = Array.from(this.elements.groupSelect.selectedOptions)
                .map(opt => opt.value)
                .filter(val => val !== "");
        }

        let payerIds = [];
        if (this.elements.payerSelect) {
            payerIds = Array.from(this.elements.payerSelect.selectedOptions)
                .map(opt => opt.value)
                .filter(val => val !== "");
        }

        return {
            startDate,
            endDate,
            categoryIds,
            paymentModeIds,
            groupIds, // Added
            payerIds    // Added
        };
    }

    renderAnalyticsResults(analyticsData) {
        this.resultsContainer.innerHTML = ''; // Clear previous results

        if (!analyticsData) {
            this.resultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Analytics data is currently unavailable.</p>';
            return;
        }

        const overallTotal = parseFloat(analyticsData.overallTotal) || 0;
        const totalFilteredCount = parseInt(analyticsData.totalFilteredCount) || 0;

        // Check if there's absolutely nothing to show
        if (totalFilteredCount === 0 &&
            (!analyticsData.categoryBreakdown || analyticsData.categoryBreakdown.length === 0) &&
            (!analyticsData.filteredExpenses || analyticsData.filteredExpenses.length === 0)) {
            this.resultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No expenses match the selected filters.</p>';
            return;
        }

        let resultsHTML = `
            <div class="mb-6 p-4 bg-white shadow rounded-lg">
                <h4 class="text-lg font-semibold text-gray-800 mb-2">Summary</h4>
                <p class="text-gray-700">Total Expenses (Filtered): <span class="font-bold text-blue-600">${overallTotal.toFixed(2)}</span></p>
                <p class="text-gray-700">Total Transactions: <span class="font-bold text-blue-600">${totalFilteredCount}</span></p>
            </div>
        `;

        if (analyticsData.categoryBreakdown && analyticsData.categoryBreakdown.length > 0) {
            resultsHTML += `
                <h4 class="text-lg font-semibold text-gray-800 mb-2">Category Breakdown</h4>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 border border-gray-200 shadow-sm rounded-lg">
                        <thead class="bg-gray-100">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Category</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Total Amount</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">Percentage</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
            `;

            analyticsData.categoryBreakdown.forEach(item => {
                const categoryName = item.categoryName || 'Unnamed Category';
                const itemTotalAmountDisplay = (parseFloat(item.totalAmount) || 0).toFixed(2);
                const itemPercentageDisplay = (parseFloat(item.percentage) || 0).toFixed(2);
                resultsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${categoryName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${itemTotalAmountDisplay}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${itemPercentageDisplay}%</td>
                    </tr>
                `;
            });

            resultsHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        } else if (totalFilteredCount > 0 && (!analyticsData.filteredExpenses || analyticsData.filteredExpenses.length === 0)) {
            // Only show this if there are no individual expenses to list either
            resultsHTML += '<p class="text-gray-500 text-center py-4 mt-4">No category-specific data to display for the selection.</p>';
        }
        
        // Section for filtered expense details
        if (analyticsData.filteredExpenses && analyticsData.filteredExpenses.length > 0) {
            resultsHTML += `
                <h4 class="text-lg font-semibold text-gray-800 mt-6 mb-2">Filtered Expense Details (${analyticsData.filteredExpenses.length})</h4>
                <div id="analytics-filtered-expenses-list" class="max-h-[32rem] overflow-y-auto border border-gray-200 rounded-lg shadow-inner p-1 bg-gray-50 space-y-3">
                    <!-- Expense items will be rendered here by UIManager -->
                </div>
            `;
        } else if (totalFilteredCount > 0 && (!analyticsData.categoryBreakdown || analyticsData.categoryBreakdown.length === 0)) {
             // This case is tricky. If totalFilteredCount > 0, but no breakdown and no individual list,
             // it implies data exists but isn't being displayed in detail.
             // The message above for "No category-specific data" might cover it if filteredExpenses is also empty.
             // For now, if there's a total count but no expenses list, we'll assume the category message is enough or no explicit message needed here.
        }


        this.resultsContainer.innerHTML = resultsHTML; // Set the HTML structure

        // Now, if the container for filtered expenses was added, populate it.
        if (analyticsData.filteredExpenses && analyticsData.filteredExpenses.length > 0) {
            const expenseListContainer = this.resultsContainer.querySelector('#analytics-filtered-expenses-list');
            if (expenseListContainer && this.uiManager && typeof this.uiManager.renderExpenses === 'function') {
                // Pass null for callbacks if they are not set, UIManager.renderExpenses should handle this
                const editCallback = this.onEditExpense || null;
                const deleteCallback = this.onDeleteExpense || null;
                this.uiManager.renderExpenses(analyticsData.filteredExpenses, expenseListContainer, editCallback, deleteCallback);
            } else if (expenseListContainer) {
                expenseListContainer.innerHTML = "<p class='text-red-500 p-2'>Error: UI manager could not render expense details here.</p>";
            }
        }
    }
}
