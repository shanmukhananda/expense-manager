// public/js/ui.js

/**
 * UIManager class to handle all DOM manipulation and modal interactions.
 * It does not directly interact with data; it receives data to render and
 * emits events for actions (e.g., add, edit, delete).
 */
export class UIManager { // Added 'export' keyword here
    constructor() {
        // Cache DOM elements
        this.elements = {
            tabButtons: document.querySelectorAll('.tab-button'),
            tabContents: document.querySelectorAll('.tab-content'),
            groupsList: document.getElementById('groups-list'),
            categoriesList: document.getElementById('categories-list'),
            payersList: document.getElementById('payers-list'),
            paymentModesList: document.getElementById('payment-modes-list'),
            expensesList: document.getElementById('expenses-list'),

            groupNameInput: document.getElementById('group-name-input'),
            addGroupBtn: document.getElementById('add-group-btn'),
            categoryNameInput: document.getElementById('category-name-input'),
            addCategoryBtn: document.getElementById('add-category-btn'),
            payerNameInput: document.getElementById('payer-name-input'),
            addPayerBtn: document.getElementById('add-payer-btn'),
            paymentModeNameInput: document.getElementById('payment-mode-name-input'),
            addPaymentModeBtn: document.getElementById('add-payment-mode-btn'),

            expenseDate: document.getElementById('expense-date'),
            expenseAmount: document.getElementById('expense-amount'),
            expenseGroupSelect: document.getElementById('expense-group-select'),
            expenseCategorySelect: document.getElementById('expense-category-select'),
            expensePayerSelect: document.getElementById('expense-payer-select'),
            expensePaymentModeSelect: document.getElementById('expense-payment-mode-select'),
            expenseDescription: document.getElementById('expense-description'),
            addExpenseBtn: document.getElementById('add-expense-btn'),

            renameModal: document.getElementById('rename-modal'),
            renameModalTitle: document.getElementById('rename-modal-title'),
            renameInput: document.getElementById('rename-input'),
            renameSaveBtn: document.getElementById('rename-save-btn'),
            renameCancelBtn: document.getElementById('rename-cancel-btn'),

            deleteModal: document.getElementById('delete-modal'),
            deleteModalTitle: document.getElementById('delete-modal-title'),
            deleteModalMessage: document.getElementById('delete-modal-message'),
            deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
            deleteCancelBtn: document.getElementById('delete-cancel-btn'),

            infoModal: document.getElementById('info-modal'),
            infoModalTitle: document.getElementById('info-modal-title'),
            infoModalMessage: document.getElementById('info-modal-message'),
            infoModalOkBtn: document.getElementById('info-modal-ok-btn'),
        };

        // Callbacks for modal actions
        this.currentRenameCallback = null;
        this.currentDeleteCallback = null;

        this._setupEventListeners();
    }

    /**
     * Sets up all global and modal event listeners.
     * @private
     */
    _setupEventListeners() {
        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.onTabChange(e.currentTarget.id));
        });

        // Modal event listeners
        this.elements.renameSaveBtn.addEventListener('click', () => {
            if (this.currentRenameCallback) {
                this.currentRenameCallback(this.elements.renameInput.value.trim());
            }
            this.hideRenameModal();
        });
        this.elements.renameCancelBtn.addEventListener('click', () => this.hideRenameModal());

        this.elements.deleteConfirmBtn.addEventListener('click', () => {
            if (this.currentDeleteCallback) {
                this.currentDeleteCallback();
            }
            this.hideDeleteModal();
        });
        this.elements.deleteCancelBtn.addEventListener('click', () => this.hideDeleteModal());

        this.elements.infoModalOkBtn.addEventListener('click', () => this.hideInfoModal());

        // Set today's date as default for expense date input
        this.elements.expenseDate.valueAsDate = new Date();
    }

    /**
     * Callback function to be set by the main app logic when a tab is clicked.
     * @type {function(string): void}
     */
    onTabChange = () => {}; // Placeholder, will be assigned by App class

    /**
     * Callback function for adding a group.
     * @type {function(string): Promise<void>}
     */
    onAddGroup = () => {};

    /**
     * Callback function for adding a category.
     * @type {function(string): Promise<void>}
     */
    onAddCategory = () => {};

    /**
     * Callback function for adding a payer.
     * @type {function(string): Promise<void>}
     */
    onAddPayer = () => {};

    /**
     * Callback function for adding a payment mode.
     * @type {function(string): Promise<void>}
     */
    onAddPaymentMode = () => {};

    /**
     * Callback function for adding an expense.
     * @type {function(Object): Promise<void>}
     */
    onAddExpense = () => {};

    /**
     * Attaches add button listeners. This is called by the App class
     * after setting up the callbacks.
     */
    attachAddButtonListeners() {
        this.elements.addGroupBtn.addEventListener('click', async () => {
            const name = this.elements.groupNameInput.value.trim();
            if (name) {
                await this.onAddGroup(name);
                this.elements.groupNameInput.value = ''; // Clear input after adding
            } else {
                this.showInfoModal('Input Required', 'Please enter a group name.');
            }
        });

        this.elements.addCategoryBtn.addEventListener('click', async () => {
            const name = this.elements.categoryNameInput.value.trim();
            if (name) {
                await this.onAddCategory(name);
                this.elements.categoryNameInput.value = ''; // Clear input after adding
            } else {
                this.showInfoModal('Input Required', 'Please enter a category name.');
            }
        });

        this.elements.addPayerBtn.addEventListener('click', async () => {
            const name = this.elements.payerNameInput.value.trim();
            if (name) {
                await this.onAddPayer(name);
                this.elements.payerNameInput.value = ''; // Clear input after adding
            } else {
                this.showInfoModal('Input Required', 'Please enter a payer name.');
            }
        });

        this.elements.addPaymentModeBtn.addEventListener('click', async () => {
            const name = this.elements.paymentModeNameInput.value.trim();
            if (name) {
                await this.onAddPaymentMode(name);
                this.elements.paymentModeNameInput.value = ''; // Clear input after adding
            } else {
                this.showInfoModal('Input Required', 'Please enter a payment mode name.');
            }
        });

        this.elements.addExpenseBtn.addEventListener('click', async () => {
            const expenseData = {
                date: this.elements.expenseDate.value,
                amount: parseFloat(this.elements.expenseAmount.value),
                expense_group_id: parseInt(this.elements.expenseGroupSelect.value),
                expense_category_id: parseInt(this.elements.expenseCategorySelect.value),
                payer_id: parseInt(this.elements.expensePayerSelect.value),
                payment_mode_id: parseInt(this.elements.expensePaymentModeSelect.value),
                expense_description: this.elements.expenseDescription.value.trim(),
            };

            // Basic client-side validation
            if (!expenseData.date || isNaN(expenseData.amount) || expenseData.amount <= 0 ||
                isNaN(expenseData.expense_group_id) || isNaN(expenseData.expense_category_id) ||
                isNaN(expenseData.payer_id) || isNaN(expenseData.payment_mode_id)) {
                this.showInfoModal('Validation Error', 'Please fill in all required fields correctly (Date, Amount, Group, Category, Payer, Payment Mode).');
                return;
            }

            await this.onAddExpense(expenseData);
            // Clear form fields after successful addition
            this.elements.expenseDate.valueAsDate = new Date(); // Reset to today
            this.elements.expenseAmount.value = '';
            this.elements.expenseGroupSelect.value = '';
            this.elements.expenseCategorySelect.value = '';
            this.elements.expensePayerSelect.value = '';
            this.elements.expensePaymentModeSelect.value = '';
            this.elements.expenseDescription.value = '';
        });
    }


    /**
     * Activates a specific tab and hides others.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'tab-groups').
     */
    activateTab(tabId) {
        this.elements.tabButtons.forEach(button => {
            if (button.id === tabId) {
                button.classList.add('bg-blue-600', 'hover:bg-blue-700', 'text-white');
                button.classList.remove('bg-gray-200', 'hover:bg-gray-300', 'text-gray-800');
                button.classList.add('focus:ring-blue-500');
                button.classList.remove('focus:ring-gray-400');
            } else {
                button.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'text-white');
                button.classList.add('bg-gray-200', 'hover:bg-gray-300', 'text-gray-800');
                button.classList.remove('focus:ring-blue-500');
                button.classList.add('focus:ring-gray-400');
            }
        });

        this.elements.tabContents.forEach(content => {
            if (content.id === `content-${tabId.replace('tab-', '')}`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });
    }

    /**
     * Shows the rename modal.
     * @param {string} title - The title for the modal.
     * @param {string} currentValue - The current value to pre-fill the input.
     * @param {function(string): void} onSave - Callback function when save is clicked.
     */
    showRenameModal(title, currentValue, onSave) {
        this.elements.renameModalTitle.textContent = title;
        this.elements.renameInput.value = currentValue;
        this.currentRenameCallback = onSave;
        this.elements.renameModal.classList.remove('hidden');
        this.elements.renameInput.focus();
    }

    /** Hides the rename modal. */
    hideRenameModal() {
        this.elements.renameModal.classList.add('hidden');
        this.currentRenameCallback = null;
        this.elements.renameInput.value = '';
    }

    /**
     * Shows the delete confirmation modal.
     * @param {string} title - The title for the modal.
     * @param {string} message - The confirmation message.
     * @param {function(): void} onConfirm - Callback function when confirm is clicked.
     */
    showDeleteModal(title, message, onConfirm) {
        this.elements.deleteModalTitle.textContent = title;
        this.elements.deleteModalMessage.textContent = message;
        this.currentDeleteCallback = onConfirm;
        this.elements.deleteModal.classList.remove('hidden');
    }

    /** Hides the delete confirmation modal. */
    hideDeleteModal() {
        this.elements.deleteModal.classList.add('hidden');
        this.currentDeleteCallback = null;
    }

    /**
     * Shows a general information/error modal.
     * @param {string} title - The title for the modal.
     * @param {string} message - The message to display.
     */
    showInfoModal(title, message) {
        this.elements.infoModalTitle.textContent = title;
        this.elements.infoModalMessage.textContent = message;
        this.elements.infoModal.classList.remove('hidden');
    }

    /** Hides the info modal. */
    hideInfoModal() {
        this.elements.infoModal.classList.add('hidden');
    }

    /**
     * Renders a list of entities (groups, categories, etc.) into a specified container.
     * @param {Array<Object>} entityArray - The array of entities to render.
     * @param {HTMLElement} containerElement - The DOM element to render into.
     * @param {string} entityTypeName - User-friendly name for the entity type.
     * @param {function(number, string): Promise<void>} onRename - Callback for rename action.
     * @param {function(number): Promise<void>} onDelete - Callback for delete action.
     */
    renderEntityList(entityArray, containerElement, entityTypeName, onRename, onDelete) {
        containerElement.innerHTML = ''; // Clear existing list
        if (!entityArray || entityArray.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No ${entityTypeName}s added yet.</p>`;
            return;
        }
        entityArray.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0';
            itemDiv.innerHTML = `
                <span class="text-gray-800 font-medium text-lg">${item.name}</span>
                <div class="flex gap-2">
                    <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full shadow-sm transition duration-300 ease-in-out" data-id="${item.id}" title="Rename">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" />
                        </svg>
                    </button>
                    <button class="delete-btn bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-sm transition duration-300 ease-in-out" data-id="${item.id}" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            `;
            containerElement.appendChild(itemDiv);
        });

        // Add event listeners for edit and delete buttons
        containerElement.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const item = entityArray.find(i => i.id === id);
                if (item) {
                    this.showRenameModal(`Rename ${entityTypeName}`, item.name, (newName) => onRename(id, newName));
                }
            });
        });

        containerElement.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const item = entityArray.find(i => i.id === id);
                if (item) {
                    this.showDeleteModal(`Delete ${entityTypeName}`, `Are you sure you want to delete "${item.name}"?`, () => onDelete(id));
                }
            });
        });
    }

    /**
     * Renders the list of all expenses.
     * @param {Array<Object>} expenses - The array of expense objects from the API.
     * @param {function(number): Promise<void>} onDelete - Callback for delete action.
     */
    renderExpenses(expenses, onDelete) {
        const containerElement = this.elements.expensesList;
        containerElement.innerHTML = ''; // Clear existing list

        if (!expenses || expenses.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No expenses added yet.</p>`;
            return;
        }

        // Sort expenses by date descending (already sorted by backend, but good for client-side consistency)
        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedExpenses.forEach(exp => {
            const expenseDiv = document.createElement('div');
            expenseDiv.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-3 last:mb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2';
            expenseDiv.innerHTML = `
                <div class="flex-grow">
                    <p class="text-lg font-semibold text-gray-900">${exp.amount.toFixed(2)} <span class="text-sm font-normal text-gray-500">on ${exp.date}</span></p>
                    <p class="text-sm text-gray-700">
                        <span class="font-medium">${exp.group_name}</span> / <span class="font-medium">${exp.category_name}</span>
                        <span class="block sm:inline-block text-gray-500 sm:ml-2">Paid by ${exp.payer_name} via ${exp.payment_mode_name}</span>
                    </p>
                    ${exp.expense_description ? `<p class="text-sm text-gray-600 mt-1">"${exp.expense_description}"</p>` : ''}
                </div>
                <button class="delete-expense-btn bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-sm transition duration-300 ease-in-out" data-id="${exp.id}" title="Delete Expense">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
                    </svg>
                </button>
            `;
            containerElement.appendChild(expenseDiv);
        });

        containerElement.querySelectorAll('.delete-expense-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                this.showDeleteModal('Delete Expense', 'Are you sure you want to delete this expense?', () => onDelete(id));
            });
        });
    }

    /**
     * Populates a select dropdown with options from an array of entities.
     * @param {HTMLSelectElement} selectElement - The select element to populate.
     * @param {Array<Object>} entities - The array of entities (e.g., groups, categories).
     * @param {string} defaultOptionText - Text for the default "Select..." option.
     */
    populateDropdown(selectElement, entities, defaultOptionText) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`; // Clear and add default
        if (entities) {
            entities.forEach(entity => {
                const option = document.createElement('option');
                option.value = entity.id;
                option.textContent = entity.name;
                selectElement.appendChild(option);
            });
        }
    }

    /**
     * Populates all expense form dropdowns with current master data.
     * @param {Object} data - Object containing arrays of groups, categories, payers, payment modes.
     */
    populateAllDropdowns(data) {
        this.populateDropdown(this.elements.expenseGroupSelect, data.groups, 'Select Group');
        this.populateDropdown(this.elements.expenseCategorySelect, data.categories, 'Select Category');
        this.populateDropdown(this.elements.expensePayerSelect, data.payers, 'Select Payer');
        this.populateDropdown(this.elements.expensePaymentModeSelect, data.paymentModes, 'Select Payment Mode');
    }
}
