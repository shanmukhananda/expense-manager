// ExpenseView.js
class ExpenseView {
    /**
     * Manages UI for expenses.
     * @param {Object} elements - DOM elements for expense management.
     *                             e.g., { expensesList, expenseDate, expenseAmount, ..., addExpenseBtn }
     * @param {ModalManager} modalManager - Instance of ModalManager.
     * @param {function(string, string): void} showInfoModal - Function to show an info modal.
     * @param {Object} actionCallbacks - Callbacks for expense actions.
     *                                   e.g., { onAddExpense, onEditExpense, onDeleteExpense }
     * @param {function} populateDropdownUtil - Utility function to populate select dropdowns.
     */
    constructor(elements, modalManager, showInfoModal, actionCallbacks, populateDropdownUtil) {
        this.elements = elements;
        this.modalManager = modalManager;
        this.showInfoModal = showInfoModal; // Typically this.modalManager.showInfoModal
        this.actionCallbacks = actionCallbacks;
        this.populateDropdown = populateDropdownUtil;
        this._setupEventListeners();
        this._setDefaultExpenseDate();
    }

    _setDefaultExpenseDate() {
        if (this.elements.expenseDate) {
            this.elements.expenseDate.valueAsDate = new Date();
        }
    }

    _setupEventListeners() {
        if (this.elements.addExpenseBtn) {
            this.elements.addExpenseBtn.addEventListener('click', async () => await this._handleAddExpense());
        }
    }

    _validateExpenseFormData(data, isEdit = false) {
        if (!data.date || isNaN(data.amount) || data.amount <= 0 ||
            isNaN(data.expense_group_id) || isNaN(data.expense_category_id) ||
            isNaN(data.payer_id) || isNaN(data.payment_mode_id)) {
            const message = isEdit ?
                'Please fill in all required fields correctly (Date, Amount, Group, Category, Payer, Payment Mode) in the edit form.' :
                'Please fill in all required fields correctly (Date, Amount, Group, Category, Payer, Payment Mode).';
            this.showInfoModal('Validation Error', message);
            return false;
        }
        return true;
    }

    async _handleAddExpense() {
        const expenseData = {
            date: this.elements.expenseDate.value,
            amount: parseFloat(this.elements.expenseAmount.value),
            expense_group_id: parseInt(this.elements.expenseGroupSelect.value),
            expense_category_id: parseInt(this.elements.expenseCategorySelect.value),
            payer_id: parseInt(this.elements.expensePayerSelect.value),
            payment_mode_id: parseInt(this.elements.expensePaymentModeSelect.value),
            expense_description: this.elements.expenseDescription.value.trim(),
        };

        if (!this._validateExpenseFormData(expenseData)) {
            return;
        }

        try {
            await this.actionCallbacks.onAddExpense(expenseData);
            this._clearAddExpenseForm();
        } catch (error) {
            console.error('Error adding expense:', error);
            this.showInfoModal('Error', `Failed to add expense. ${error.message}`);
        }
    }

    _clearAddExpenseForm() {
        this._setDefaultExpenseDate(); // Reset date to today
        this.elements.expenseAmount.value = '';
        this.elements.expenseGroupSelect.selectedIndex = 0; // Reset to default "Select Group"
        this.elements.expenseCategorySelect.selectedIndex = 0;
        this.elements.expensePayerSelect.selectedIndex = 0;
        this.elements.expensePaymentModeSelect.selectedIndex = 0;
        this.elements.expenseDescription.value = '';
    }

    renderExpenses(expenses) {
        const containerElement = this.elements.expensesList;
        if (!containerElement) {
            console.error("Expenses list container not found.");
            return;
        }
        containerElement.innerHTML = ''; // Clear previous content

        if (!expenses || expenses.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No expenses to display. Connect to a database and add some.</p>`;
            return;
        }

        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedExpenses.forEach(exp => {
            const expenseDiv = this._createExpenseListItem(exp);
            this._addExpenseListItemListeners(expenseDiv, exp);
            containerElement.appendChild(expenseDiv);
        });
    }

    _getExpenseItemContentHTML(exp) {
        let contentHtml = `
            <div class="flex-grow w-full sm:w-auto">
                <div class="flex justify-between items-start">
                    <p class="text-xl font-bold text-indigo-600">${exp.amount.toFixed(2)}</p>
                    <p class="text-sm text-gray-600 font-medium">${exp.date}</p>
                </div>
                <div class="mt-2 text-sm">
                    <p class="text-gray-700">
                        <span class="font-semibold text-gray-800">${exp.group_name}</span> &bull; <span class="font-semibold text-gray-800">${exp.category_name}</span>
                    </p>
                    <p class="text-gray-600">
                        Paid by <span class="font-medium text-gray-700">${exp.payer_name}</span> via <span class="font-medium text-gray-700">${exp.payment_mode_name}</span>
                    </p>
                </div>
        `;
        if (exp.expense_description) {
            contentHtml += `<p class="text-xs text-gray-500 mt-2 italic">"${exp.expense_description}"</p>`;
        }
        contentHtml += `</div>`;
        return contentHtml;
    }

    _getExpenseItemButtonsHTML(exp) {
        return `
            <div class="flex gap-2 self-start sm:self-center mt-3 sm:mt-0">
                <button class="edit-expense-btn bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full shadow-sm transform hover:scale-105 transition-transform duration-150 ease-in-out" data-id="${exp.id}" title="Edit Expense">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" />
                    </svg>
                </button>
                <button class="delete-expense-btn bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-sm transform hover:scale-105 transition-transform duration-150 ease-in-out" data-id="${exp.id}" title="Delete Expense">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
    }

    _createExpenseListItem(exp) {
        const expenseDiv = document.createElement('div');
        expenseDiv.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-300 mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-shadow duration-150';
        const contentHtml = this._getExpenseItemContentHTML(exp);
        const buttonsHtml = this._getExpenseItemButtonsHTML(exp);
        expenseDiv.innerHTML = contentHtml + buttonsHtml;
        return expenseDiv;
    }

    _addExpenseListItemListeners(expenseDiv, exp) {
        const editBtn = expenseDiv.querySelector('.edit-expense-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // Master data (groups, categories, etc.) needs to be passed to showEditExpenseModal
                // This implies UIManager or AppController needs to provide it when calling this.
                // For now, assume it's available via this.masterData which UIManager would set.
                if (this.masterData) {
                     this.modalManager.showEditExpenseModal(exp, this.masterData, async () => {
                        const updatedExpenseData = this.modalManager.getEditExpenseFormData();
                        if (!this._validateExpenseFormData(updatedExpenseData, true)) {
                            // Modal stays open for correction if validation fails
                            return;
                        }
                        try {
                            await this.actionCallbacks.onEditExpense(updatedExpenseData);
                            this.modalManager.hideEditExpenseModal(); // Hide on success
                        } catch (error) {
                            console.error('Error editing expense:', error);
                            // Optionally, show error in modal or as a general info message
                            // For now, modal stays open for user to retry or cancel
                            this.showInfoModal('Error', `Failed to save changes: ${error.message}`);
                        }
                    });
                } else {
                    console.error("Master data for editing expense not available.");
                    this.showInfoModal("Error", "Could not open edit form: required data is missing.");
                }
            });
        }

        const deleteBtn = expenseDiv.querySelector('.delete-expense-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.modalManager.showDeleteModal('Delete Expense', `Are you sure you want to delete this expense (Amount: ${exp.amount}, Date: ${exp.date})? This action cannot be undone.`, async () => {
                    try {
                        await this.actionCallbacks.onDeleteExpense(exp.id);
                    } catch (error) {
                        console.error('Error deleting expense:', error);
                        this.showInfoModal('Error', `Failed to delete expense. ${error.message}`);
                    }
                });
            });
        }
    }

    /**
     * Populates expense form dropdowns (add and edit forms).
     * @param {Object} data - Object containing arrays of groups, categories, payers, payment modes.
     */
    populateExpenseFormDropdowns(data) {
        this.masterData = data; // Cache for use in edit modal
        this.populateDropdown(this.elements.expenseGroupSelect, data.groups, 'Select Group');
        this.populateDropdown(this.elements.expenseCategorySelect, data.categories, 'Select Category');
        this.populateDropdown(this.elements.expensePayerSelect, data.payers, 'Select Payer');
        this.populateDropdown(this.elements.expensePaymentModeSelect, data.paymentModes, 'Select Payment Mode');
        // Edit form dropdowns are populated by ModalManager's _populateEditExpenseForm
        // but it needs masterData, which is why we cache it here.
    }

    // Method to update placeholder when DB is disconnected
    displayDisconnectedState(message = "Connect to a database to manage expenses.") {
        const containerElement = this.elements.expensesList;
        if (containerElement) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">${message}</p>`;
        }
        this._clearAddExpenseForm(); // Also clear the form
    }
}

module.exports = ExpenseView;
