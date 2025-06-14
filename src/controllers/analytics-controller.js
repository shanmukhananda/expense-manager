
export class AnalyticsManager {
    /**
     * @param {UIManager} uiManager - Instance of UIManager for generic UI tasks (e.g., modals).
     * @param {HTMLElement} filtersContainer - The DOM element to host filter controls.
     * @param {HTMLElement} resultsContainer - The DOM element to display analytics results.
     */
    constructor(uiManager, filtersContainer, resultsContainer) {
        this.uiManager = uiManager; // For modals or other shared UI functions
        this.filtersContainer = filtersContainer;
        this.resultsContainer = resultsContainer;
        this.currentPage = 1;
        this.pageSize = 50;

        this.elements = {
            startDateInput: null,
            endDateInput: null,
            allTimeBtn: null,
            categorySelect: null, // Will be null, kept for structure consistency if ever needed
            paymentModeSelect: null, // Will be null
            groupSelect: null, // Will be null
            payerSelect: null,   // Will be null
            applyFiltersBtn: null,
        };
        this.onEditExpense = null;
        this.onDeleteExpense = null;
    }

    setExpenseActionCallbacks(onEdit, onDelete) {
        this.onEditExpense = onEdit;
        this.onDeleteExpense = onDelete;
    }

    _cacheFilterElements() {
        if (this.filtersContainer) {
            this.elements.startDateInput = this.filtersContainer.querySelector('#analytics-start-date');
            this.elements.endDateInput = this.filtersContainer.querySelector('#analytics-end-date');
            this.elements.allTimeBtn = this.filtersContainer.querySelector('#analytics-all-time-btn');
            this.elements.applyFiltersBtn = this.filtersContainer.querySelector('#analytics-apply-filters-btn');
        }
    }

    _renderDateRangeFilter() {
        return `
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
        `;
    }

    _renderCategoryFilter(categories = []) {
        const categoryCheckboxes = categories.map(category => `
            <div>
                <input type="checkbox" id="analytics-category-checkbox-${category.id}" name="analytics-category-filter" value="${category.id}" class="mr-2">
                <label for="analytics-category-checkbox-${category.id}">${category.name}</label>
            </div>
        `).join('');

        return `
            <div class="bg-white p-4 rounded-lg shadow">
                <h4 class="text-md font-semibold text-gray-700 mb-3">Categories</h4>
                <div class="flex justify-between text-xs mb-1">
                    <button type="button" class="text-blue-500 hover:text-blue-700 select-all-btn" data-filter-type="analytics-category-filter">Select All</button>
                    <button type="button" class="text-blue-500 hover:text-blue-700 deselect-all-btn" data-filter-type="analytics-category-filter">Deselect All</button>
                </div>
                <div id="analytics-category-filter-container" class="mt-1 space-y-2 h-32 overflow-y-auto">
                    ${categoryCheckboxes}
                </div>
            </div>
        `;
    }

    _renderPaymentModeFilter(paymentModes = []) {
        const paymentModeCheckboxes = paymentModes.map(pm => `
            <div>
                <input type="checkbox" id="analytics-payment-mode-checkbox-${pm.id}" name="analytics-payment-mode-filter" value="${pm.id}" class="mr-2">
                <label for="analytics-payment-mode-checkbox-${pm.id}">${pm.name}</label>
            </div>
        `).join('');

        return `
            <div class="bg-white p-4 rounded-lg shadow">
                <h4 class="text-md font-semibold text-gray-700 mb-3">Payment Modes</h4>
                <div class="flex justify-between text-xs mb-1">
                    <button type="button" class="text-blue-500 hover:text-blue-700 select-all-btn" data-filter-type="analytics-payment-mode-filter">Select All</button>
                    <button type="button" class="text-blue-500 hover:text-blue-700 deselect-all-btn" data-filter-type="analytics-payment-mode-filter">Deselect All</button>
                </div>
                <div id="analytics-payment-mode-filter-container" class="mt-1 space-y-2 h-32 overflow-y-auto">
                    ${paymentModeCheckboxes}
                </div>
            </div>
        `;
    }

    _renderGroupFilter(groups = []) {
        const groupCheckboxes = groups.map(group => `
            <div>
                <input type="checkbox" id="analytics-group-checkbox-${group.id}" name="analytics-group-filter" value="${group.id}" class="mr-2">
                <label for="analytics-group-checkbox-${group.id}">${group.name}</label>
            </div>
        `).join('');

        return `
            <div class="bg-white p-4 rounded-lg shadow">
                <h4 class="text-md font-semibold text-gray-700 mb-3">Expense Groups</h4>
                <div class="flex justify-between text-xs mb-1">
                    <button type="button" class="text-blue-500 hover:text-blue-700 select-all-btn" data-filter-type="analytics-group-filter">Select All</button>
                    <button type="button" class="text-blue-500 hover:text-blue-700 deselect-all-btn" data-filter-type="analytics-group-filter">Deselect All</button>
                </div>
                <div id="analytics-group-filter-container" class="mt-1 space-y-2 h-32 overflow-y-auto">
                    ${groupCheckboxes}
                </div>
            </div>
        `;
    }

    _renderPayerFilter(payers = []) {
        const payerCheckboxes = payers.map(payer => `
            <div>
                <input type="checkbox" id="analytics-payer-checkbox-${payer.id}" name="analytics-payer-filter" value="${payer.id}" class="mr-2">
                <label for="analytics-payer-checkbox-${payer.id}">${payer.name}</label>
            </div>
        `).join('');

        return `
            <div class="bg-white p-4 rounded-lg shadow">
                <h4 class="text-md font-semibold text-gray-700 mb-3">Payers</h4>
                <div class="flex justify-between text-xs mb-1">
                    <button type="button" class="text-blue-500 hover:text-blue-700 select-all-btn" data-filter-type="analytics-payer-filter">Select All</button>
                    <button type="button" class="text-blue-500 hover:text-blue-700 deselect-all-btn" data-filter-type="analytics-payer-filter">Deselect All</button>
                </div>
                <div id="analytics-payer-filter-container" class="mt-1 space-y-2 h-32 overflow-y-auto">
                    ${payerCheckboxes}
                </div>
            </div>
        `;
    }

    renderAnalyticsFilters(masterData, applyFiltersCallback) {
        this.applyFiltersCallback = applyFiltersCallback; // Store the callback
        this.filtersContainer.innerHTML = '';

        const dateRangeHTML = this._renderDateRangeFilter();
        const categoryHTML = this._renderCategoryFilter(masterData.categories);
        const paymentModeHTML = this._renderPaymentModeFilter(masterData.paymentModes);
        const groupHTML = this._renderGroupFilter(masterData.groups);
        const payerHTML = this._renderPayerFilter(masterData.payers);

        const filtersHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                ${dateRangeHTML}
                ${categoryHTML}
                ${paymentModeHTML}
                ${groupHTML}
                ${payerHTML}
            </div>
            <div class="flex justify-end mt-4">
                <button id="analytics-apply-filters-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75">Apply Filters</button>
            </div>
        `;

        this.filtersContainer.innerHTML = filtersHTML;
        this._cacheFilterElements();

        // Add event listeners for Select All / Deselect All buttons
        const selectAllButtons = this.filtersContainer.querySelectorAll('.select-all-btn');
        selectAllButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const filterType = button.dataset.filterType;
                if (filterType) {
                    const parentSection = button.closest('.bg-white.p-4.rounded-lg.shadow');
                    if (parentSection) {
                        const checkboxes = parentSection.querySelectorAll(`input[name="${filterType}"]`);
                        checkboxes.forEach(checkbox => {
                            checkbox.checked = true;
                        });
                    }
                }
            });
        });

        const deselectAllButtons = this.filtersContainer.querySelectorAll('.deselect-all-btn');
        deselectAllButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const filterType = button.dataset.filterType;
                if (filterType) {
                    const parentSection = button.closest('.bg-white.p-4.rounded-lg.shadow');
                    if (parentSection) {
                        const checkboxes = parentSection.querySelectorAll(`input[name="${filterType}"]`);
                        checkboxes.forEach(checkbox => {
                            checkbox.checked = false;
                        });
                    }
                }
            });
        });

        if (this.elements.endDateInput && this.elements.startDateInput) {
            const today = new Date();
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            this.elements.endDateInput.valueAsDate = today;
            this.elements.startDateInput.valueAsDate = firstDayOfMonth;
        }

        if (this.elements.applyFiltersBtn) {
             this.elements.applyFiltersBtn.addEventListener('click', () => {
                this.currentPage = 1;
                if (this.applyFiltersCallback) {
                    this.applyFiltersCallback();
                }
            });
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
        if (this.filtersContainer) {
            categoryIds = Array.from(this.filtersContainer.querySelectorAll('input[name="analytics-category-filter"]:checked'))
                .map(checkbox => checkbox.value)
                .filter(val => val !== "");
        }

        let paymentModeIds = [];
        if (this.filtersContainer) {
            paymentModeIds = Array.from(this.filtersContainer.querySelectorAll('input[name="analytics-payment-mode-filter"]:checked'))
                .map(checkbox => checkbox.value)
                .filter(val => val !== "");
        }

        let groupIds = [];
        if (this.filtersContainer) {
            groupIds = Array.from(this.filtersContainer.querySelectorAll('input[name="analytics-group-filter"]:checked'))
                .map(checkbox => checkbox.value)
                .filter(val => val !== "");
        }

        let payerIds = [];
        if (this.filtersContainer) {
            payerIds = Array.from(this.filtersContainer.querySelectorAll('input[name="analytics-payer-filter"]:checked'))
                .map(checkbox => checkbox.value)
                .filter(val => val !== "");
        }

        return {
            startDate,
            endDate,
            categoryIds,
            paymentModeIds,
            groupIds,
            payerIds,
            limit: this.pageSize,
            offset: (this.currentPage - 1) * this.pageSize
        };
    }

    _renderPaginationControls(totalItems, pageSize, currentPage) {
        const totalPages = Math.ceil(totalItems / pageSize);
        if (totalPages <= 1) {
            return '';
        }

        let paginationHTML = '<div id="analytics-pagination-controls" class="flex justify-center items-center space-x-4 my-4">';

        // Previous Button
        const prevDisabled = currentPage === 1;
        paginationHTML += `
            <button
                class="analytics-page-btn px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md ${prevDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}"
                data-page="${currentPage - 1}"
                ${prevDisabled ? 'disabled' : ''}
            >
                Previous
            </button>
        `;

        // Page X of Y
        paginationHTML += `<span class="text-sm text-gray-700">Page ${currentPage} of ${totalPages}</span>`;

        // Next Button
        const nextDisabled = currentPage === totalPages;
        paginationHTML += `
            <button
                class="analytics-page-btn px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md ${nextDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}"
                data-page="${currentPage + 1}"
                ${nextDisabled ? 'disabled' : ''}
            >
                Next
            </button>
        `;

        paginationHTML += '</div>';
        return paginationHTML;
    }

    _renderSummarySection(grandTotalAmount, totalAllFilteredItems, grandTotalNetFigure) {
        return `
            <div class="mb-6 p-4 bg-white shadow rounded-lg">
                <h4 class="text-lg font-semibold text-gray-800 mb-2">Summary</h4>
                <p class="text-gray-700">Total Expenses (Filtered): <span class="font-bold text-blue-600">${grandTotalAmount.toFixed(2)}</span></p>
                <p class="text-gray-700">Total After Refunds: <span class="font-bold text-blue-600">${grandTotalNetFigure.toFixed(2)}</span></p>
                <p class="text-gray-700">Total Transactions: <span class="font-bold text-blue-600">${totalAllFilteredItems}</span></p>
            </div>
        `;
    }

    _renderCategoryBreakdownTable(categoryBreakdown) {
        if (!categoryBreakdown || categoryBreakdown.length === 0) {
            return '';
        }

        let tableRowsHTML = '';
        categoryBreakdown.forEach(item => {
            const categoryName = item.categoryName || 'Unnamed Category';
            const itemTotalAmountDisplay = (parseFloat(item.totalAmount) || 0).toFixed(2);
            const itemPercentageDisplay = (parseFloat(item.percentage) || 0).toFixed(2);
            tableRowsHTML += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${categoryName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${itemTotalAmountDisplay}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${itemPercentageDisplay}%</td>
                </tr>
            `;
        });

        return `
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
                        ${tableRowsHTML}
                    </tbody>
                </table>
            </div>
        `;
    }

    _renderFilteredExpensesSection(filteredExpenses) {
        if (!filteredExpenses || filteredExpenses.length === 0) {
            return '';
        }
        return `
            <h4 class="text-lg font-semibold text-gray-800 mt-6 mb-2">Filtered Expense Details (${filteredExpenses.length})</h4>
            <div id="analytics-filtered-expenses-list" class="max-h-[32rem] overflow-y-auto border border-gray-200 rounded-lg shadow-inner p-1 bg-gray-50 space-y-3">
            </div>
        `;
    }

    renderAnalyticsResults(analyticsData) {
        this.resultsContainer.innerHTML = '';

        if (!analyticsData) {
            this.resultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Analytics data is currently unavailable.</p>';
            return;
        }

        // Use grand totals for the summary section
        const grandTotalAmount = parseFloat(analyticsData.grandTotalAmount) || 0;
        const totalAllFilteredItems = parseInt(analyticsData.totalAllFilteredItems) || 0;
        const grandTotalNetFigure = parseFloat(analyticsData.grandTotalNetFigure) || 0;

        // Check if there are any items to display based on grand total count
        if (totalAllFilteredItems === 0) {
            this.resultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No expenses match the selected filters.</p>';
            return;
        }

        let resultsHTML = this._renderSummarySection(grandTotalAmount, totalAllFilteredItems, grandTotalNetFigure);
        
        // Category breakdown and filtered expenses list are based on page-specific data.
        // The analyticsData also contains pageOverallTotal and pageTotalFilteredCount for the current page's items.
        const categoryBreakdown = analyticsData.categoryBreakdown || [];
        const filteredExpenses = analyticsData.filteredExpenses || [];

        resultsHTML += this._renderCategoryBreakdownTable(categoryBreakdown);

        // This condition checks if there are overall items, but no specific breakdown or expense list for the current page/filters.
        // This might occur if filters are very restrictive or if it's an empty page in pagination with prior pages having data.
        if (totalAllFilteredItems > 0 && categoryBreakdown.length === 0 && filteredExpenses.length === 0) {
            resultsHTML += '<p class="text-gray-500 text-center py-4 mt-4">No detailed data (category breakdown or individual expenses) for this specific selection or page.</p>';
        }

        resultsHTML += this._renderFilteredExpensesSection(filteredExpenses);
        resultsHTML += this._renderPaginationControls(analyticsData.totalAllFilteredItems || 0, this.pageSize, this.currentPage);

        this.resultsContainer.innerHTML = resultsHTML;

        // Add event listeners for pagination buttons
        const pageButtons = this.resultsContainer.querySelectorAll('.analytics-page-btn');
        pageButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetPage = parseInt(button.dataset.page);
                if (!isNaN(targetPage) && targetPage > 0) {
                    this.currentPage = targetPage;
                    if (this.applyFiltersCallback) {
                        this.applyFiltersCallback();
                    }
                }
            });
        });

        if (analyticsData.filteredExpenses && analyticsData.filteredExpenses.length > 0) {
            const expenseListContainer = this.resultsContainer.querySelector('#analytics-filtered-expenses-list');
            if (expenseListContainer && this.uiManager && typeof this.uiManager.renderExpenses === 'function') {
                const editCallback = this.onEditExpense || null;
                const deleteCallback = this.onDeleteExpense || null;
                this.uiManager.renderExpenses(analyticsData.filteredExpenses, expenseListContainer, editCallback, deleteCallback);
            } else if (expenseListContainer) {
                expenseListContainer.innerHTML = "<p class='text-red-500 p-2'>Error: UI manager could not render expense details here.</p>";
            }
        }
    }
}
