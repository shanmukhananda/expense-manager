// src/views/ui.js

/**
 * UIManager class to handle all DOM manipulation and modal interactions.
 * It does not directly interact with data; it receives data to render and
 * emits events for actions (e.g., add, edit, delete).
 */
export class UIManager {
    constructor() {
        this.elements = this._cacheDOMElements();
        this.currentRenameCallback = null;
        this.currentDeleteCallback = null;
        this.currentEditExpenseCallback = null;

        this._setupEventListeners();
    }

    /**
     * Caches all necessary DOM elements.
     * @private
     * @returns {Object} An object containing references to DOM elements.
     */
    _cacheDOMElements() {
        return {
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

            editExpenseModal: document.getElementById('edit-expense-modal'),
            editExpenseId: document.getElementById('edit-expense-id'),
            editExpenseDate: document.getElementById('edit-expense-date'),
            editExpenseAmount: document.getElementById('edit-expense-amount'),
            editExpenseGroupSelect: document.getElementById('edit-expense-group-select'),
            editExpenseCategorySelect: document.getElementById('edit-expense-category-select'),
            editExpensePayerSelect: document.getElementById('edit-expense-payer-select'),
            editExpensePaymentModeSelect: document.getElementById('edit-expense-payment-mode-select'),
            editExpenseDescription: document.getElementById('edit-expense-description'),
            editExpenseSaveBtn: document.getElementById('edit-expense-save-btn'),
            editExpenseCancelBtn: document.getElementById('edit-expense-cancel-btn'),

            // Import/Export Tab Elements
            csvImportFile: document.getElementById('csv-import-file'),
            importCsvBtn: document.getElementById('import-csv-btn'),
            exportCsvBtn: document.getElementById('export-csv-btn'),
            importExportStatus: document.getElementById('import-export-status'),
            // Analytics Tab Elements
            contentAnalytics: document.getElementById('content-analytics'),
            analyticsFiltersContainer: document.getElementById('analytics-filters-container'),
            analyticsResultsContainer: document.getElementById('analytics-results-container'),

            // Database connection elements
            dbConnectionString: document.getElementById('db-connection-string'),
            dbConnectToggle: document.getElementById('db-connect-toggle'),
            dbConnectionStatusMessage: null, // Will be created dynamically

            // Export CSV Filter Elements
            exportStartDate: document.getElementById('export-start-date'),
            exportEndDate: document.getElementById('export-end-date'),
            exportAllTime: document.getElementById('export-all-time'),
            exportExpenseGroupCheckboxContainer: document.getElementById('export-expense-group-checkbox-container'),
        };
    }

    /**
     * Sets up all global and modal event listeners.
     * @private
     */
    _setupEventListeners() {
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => this.onTabChange(e.currentTarget.id));
        });

        this._setupRenameModalListeners();
        this._setupDeleteModalListeners();
        this._setupInfoModalListeners();
        this._setupEditExpenseModalListeners();

        this.elements.expenseDate.valueAsDate = new Date(); // Set today's date

        if (this.elements.dbConnectToggle) {
            this.elements.dbConnectToggle.addEventListener('click', () => {
                if (this.onConnectToggle) {
                    this.onConnectToggle();
                }
            });
        }

        if (this.elements.importCsvBtn) {
            this.elements.importCsvBtn.addEventListener('click', async () => {
                if (this.elements.csvImportFile && this.elements.csvImportFile.files.length > 0) {
                    if (this.onImportCsv) await this.onImportCsv();
                } else {
                    this.displayImportExportStatus('Please select a CSV file first.', true);
                }
            });
        }

        if (this.elements.exportCsvBtn) {
            this.elements.exportCsvBtn.addEventListener('click', async () => {
                if (this.onExportCsv) {
                    // The actual export logic (calling this.api.exportCsv(filters))
                    // will be handled in app-controller.js by calling getExportFilters().
                    await this.onExportCsv();
                }
            });
        }

        // Listener for "All Time" checkbox in CSV export
        if (this.elements.exportAllTime && this.elements.exportStartDate && this.elements.exportEndDate) {
            this.elements.exportAllTime.addEventListener('change', () => {
                const isChecked = this.elements.exportAllTime.checked;
                this.elements.exportStartDate.disabled = isChecked;
                this.elements.exportEndDate.disabled = isChecked;
                if (isChecked) {
                    this.elements.exportStartDate.value = '';
                    this.elements.exportEndDate.value = '';
                }
            });
            // Initial state based on checkbox default (checked)
            this.elements.exportStartDate.disabled = this.elements.exportAllTime.checked;
            this.elements.exportEndDate.disabled = this.elements.exportAllTime.checked;
            if (this.elements.exportAllTime.checked) {
                this.elements.exportStartDate.value = '';
                this.elements.exportEndDate.value = '';
            }
        }
    }

    /**
     * Sets up event listeners for the rename modal.
     * @private
     */
    _setupRenameModalListeners() {
        this.elements.renameSaveBtn.addEventListener('click', () => {
            if (this.currentRenameCallback) {
                this.currentRenameCallback(this.elements.renameInput.value.trim());
            }
            this.hideRenameModal();
        });
        this.elements.renameCancelBtn.addEventListener('click', () => this.hideRenameModal());
    }

    /**
     * Sets up event listeners for the delete confirmation modal.
     * @private
     */
    _setupDeleteModalListeners() {
        this.elements.deleteConfirmBtn.addEventListener('click', () => {
            if (this.currentDeleteCallback) {
                this.currentDeleteCallback();
            }
            this.hideDeleteModal();
        });
        this.elements.deleteCancelBtn.addEventListener('click', () => this.hideDeleteModal());
    }

    /**
     * Sets up event listeners for the info/error modal.
     * @private
     */
    _setupInfoModalListeners() {
        this.elements.infoModalOkBtn.addEventListener('click', () => this.hideInfoModal());
    }

    /**
     * Sets up event listeners for the edit expense modal.
     * @private
     */
    _setupEditExpenseModalListeners() {
        this.elements.editExpenseSaveBtn.addEventListener('click', () => {
            if (this.currentEditExpenseCallback) {
                const updatedExpenseData = this._getEditExpenseFormData();
                if (!this._validateExpenseFormData(updatedExpenseData, true)) {
                    return;
                }
                this.currentEditExpenseCallback(updatedExpenseData);
            }
            this.hideEditExpenseModal();
        });
        this.elements.editExpenseCancelBtn.addEventListener('click', () => this.hideEditExpenseModal());
    }

    /**
     * Extracts form data from the edit expense modal.
     * @private
     * @returns {Object} The expense data from the form.
     */
    _getEditExpenseFormData() {
        return {
            id: parseInt(this.elements.editExpenseId.value),
            date: this.elements.editExpenseDate.value,
            amount: parseFloat(this.elements.editExpenseAmount.value),
            expense_group_id: parseInt(this.elements.editExpenseGroupSelect.value),
            expense_category_id: parseInt(this.elements.editExpenseCategorySelect.value),
            payer_id: parseInt(this.elements.editExpensePayerSelect.value),
            payment_mode_id: parseInt(this.elements.editExpensePaymentModeSelect.value),
            expense_description: this.elements.editExpenseDescription.value.trim(),
        };
    }

    /**
     * Validates expense form data.
     * @private
     * @param {Object} data - The expense data to validate.
     * @param {boolean} isEdit - True if validating for edit, false for add.
     * @returns {boolean} True if valid, false otherwise.
     */
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

    /**
     * Callback function to be set by the main app logic when a tab is clicked.
     * @type {function(string): void}
     */
    onTabChange = () => {};

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
     * Callback function for editing an expense.
     * @type {function(Object): Promise<void>}
     */
    onEditExpense = () => {};

    /**
     * Callback for database connect/disconnect toggle.
     * @type {function(): Promise<void>}
     */
    onConnectToggle = async () => {};

    /** @type {function(): Promise<void>} */
    onImportCsv = async () => {};

    /** @type {function(): Promise<void>} */
    onExportCsv = async () => {};

    /**
     * Attaches add button listeners. This is called by the App class
     * after setting up the callbacks.
     */
    attachAddButtonListeners() {
        this.elements.addGroupBtn.addEventListener('click', () => this._handleAddEntity('group', this.elements.groupNameInput, this.onAddGroup));
        this.elements.addCategoryBtn.addEventListener('click', () => this._handleAddEntity('category', this.elements.categoryNameInput, this.onAddCategory));
        this.elements.addPayerBtn.addEventListener('click', () => this._handleAddEntity('payer', this.elements.payerNameInput, this.onAddPayer));
        this.elements.addPaymentModeBtn.addEventListener('click', () => this._handleAddEntity('payment mode', this.elements.paymentModeNameInput, this.onAddPaymentMode));
        this.elements.addExpenseBtn.addEventListener('click', () => this._handleAddExpense());
    }

    /**
     * Generic handler for adding master data entities.
     * @private
     * @param {string} entityTypeName - The type of entity (e.g., 'group').
     * @param {HTMLInputElement} inputElement - The input field for the entity name.
     * @param {function(string): Promise<void>} addCallback - The callback to add the entity.
     */
    async _handleAddEntity(entityTypeName, inputElement, addCallback) {
        const name = inputElement.value.trim();
        if (name) {
            await addCallback(name);
            inputElement.value = '';
        } else {
            this.showInfoModal('Input Required', `Please enter a ${entityTypeName} name.`);
        }
    }

    /**
     * Handles adding a new expense.
     * @private
     */
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

        await this.onAddExpense(expenseData);
        this._clearAddExpenseForm();
    }

    /**
     * Clears the add expense form fields.
     * @private
     */
    _clearAddExpenseForm() {
        this.elements.expenseDate.valueAsDate = new Date();
        this.elements.expenseAmount.value = '';
        this.elements.expenseGroupSelect.value = '';
        this.elements.expenseCategorySelect.value = '';
        this.elements.expensePayerSelect.value = '';
        this.elements.expensePaymentModeSelect.value = '';
        this.elements.expenseDescription.value = '';
    }

    /**
     * Activates a specific tab and hides others.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'tab-groups').
     */
    activateTab(tabId) {
        this.elements.tabButtons.forEach(button => {
            const isActive = button.id === tabId;
            button.classList.toggle('bg-blue-600', isActive);
            button.classList.toggle('hover:bg-blue-700', isActive);
            button.classList.toggle('text-white', isActive);
            button.classList.toggle('bg-gray-200', !isActive);
            button.classList.toggle('hover:bg-gray-300', !isActive);
            button.classList.toggle('text-gray-800', !isActive);
            button.classList.toggle('focus:ring-blue-500', isActive);
            button.classList.toggle('focus:ring-gray-400', !isActive);
        });

        this.elements.tabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `content-${tabId.replace('tab-', '')}`);
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
     * Displays a message in the import/export status area.
     * @param {string} message - The message to display.
     * @param {boolean} [isError=false] - True if the message is an error (styled red).
     * @param {boolean} [isSuccess=false] - True if the message is a success (styled green).
     */
    displayImportExportStatus(message, isError = false, isSuccess = false) {
        if (this.elements.importExportStatus) {
            this.elements.importExportStatus.textContent = message;
            this.elements.importExportStatus.classList.remove('text-red-600', 'text-green-600', 'text-gray-700');
            if (isError) {
                this.elements.importExportStatus.classList.add('text-red-600');
            } else if (isSuccess) {
                this.elements.importExportStatus.classList.add('text-green-600');
            } else {
                this.elements.importExportStatus.classList.add('text-gray-700');
            }
        }
    }

    /**
     * Triggers a browser download for the given CSV string.
     * @param {string} csvString - The CSV data as a string.
     * @param {string} filename - The desired filename for the download.
     */
    triggerCsvDownload(csvString, filename) {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { // Feature detection
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            this.displayImportExportStatus('CSV download failed: Browser does not support this feature.', true);
        }
    }

    /**
     * Shows the edit expense modal and populates it with existing data.
     * @param {Object} expense - The expense object to edit.
     * @param {Object} masterData - Object containing arrays of groups, categories, payers, payment modes.
     * @param {function(Object): void} onSave - Callback function when save is clicked.
     */
    showEditExpenseModal(expense, masterData, onSave) {
        this._populateEditExpenseForm(expense, masterData);
        this.currentEditExpenseCallback = onSave;
        this.elements.editExpenseModal.classList.remove('hidden');
    }

    /**
     * Populates the edit expense form with provided data.
     * @private
     * @param {Object} expense - The expense object to populate the form with.
     * @param {Object} masterData - Object containing arrays of groups, categories, payers, payment modes.
     */
    _populateEditExpenseForm(expense, masterData) {
        this.elements.editExpenseId.value = expense.id;
        this.elements.editExpenseDate.value = expense.date;
        this.elements.editExpenseAmount.value = expense.amount;
        this.elements.editExpenseDescription.value = expense.expense_description;

        this.populateDropdown(this.elements.editExpenseGroupSelect, masterData.groups, 'Select Group');
        this.elements.editExpenseGroupSelect.value = expense.expense_group_id;

        this.populateDropdown(this.elements.editExpenseCategorySelect, masterData.categories, 'Select Category');
        this.elements.editExpenseCategorySelect.value = expense.expense_category_id;

        this.populateDropdown(this.elements.editExpensePayerSelect, masterData.payers, 'Select Payer');
        this.elements.editExpensePayerSelect.value = expense.payer_id;

        this.populateDropdown(this.elements.editExpensePaymentModeSelect, masterData.paymentModes, 'Select Payment Mode');
        this.elements.editExpensePaymentModeSelect.value = expense.payment_mode_id;
    }

    /** Hides the edit expense modal. */
    hideEditExpenseModal() {
        this.elements.editExpenseModal.classList.add('hidden');
        this.currentEditExpenseCallback = null;
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
        containerElement.innerHTML = '';
        if (!entityArray || entityArray.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No ${entityTypeName}s added yet.</p>`;
            return;
        }
        entityArray.forEach(item => {
            const itemDiv = this._createEntityListItem(item, entityTypeName);
            this._addEntityListItemListeners(itemDiv, item, entityTypeName, onRename, onDelete);
            containerElement.appendChild(itemDiv);
        });
    }

    /**
     * Creates a single list item HTML element for an entity.
     * @private
     * @param {Object} item - The entity object.
     * @param {string} entityTypeName - The type name for accessibility/titles.
     * @returns {HTMLElement} The created div element.
     */
    _createEntityListItem(item, entityTypeName) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex flex-col items-start sm:flex-row sm:items-center sm:justify-between p-3 border-b border-gray-200 last:border-b-0';
        itemDiv.innerHTML = `
            <span class="text-gray-800 font-medium text-lg">${item.name}</span>
            <div class="flex gap-2 mt-2 sm:mt-0">
                <button class="edit-btn bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-full shadow-sm transform hover:scale-105 transition-transform duration-150 ease-in-out" data-id="${item.id}" title="Rename ${entityTypeName}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.38-2.827-2.828z" />
                    </svg>
                </button>
                <button class="delete-btn bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-sm transform hover:scale-105 transition-transform duration-150 ease-in-out" data-id="${item.id}" title="Delete ${entityTypeName}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 01-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
                    </svg>
                </button>
            </div>
        `;
        return itemDiv;
    }

    /**
     * Adds event listeners to the buttons within an entity list item.
     * @private
     * @param {HTMLElement} itemDiv - The div element containing the buttons.
     * @param {Object} item - The entity object.
     * @param {string} entityTypeName - The type name for modal titles.
     * @param {function(number, string): Promise<void>} onRename - Callback for rename.
     * @param {function(number): Promise<void>} onDelete - Callback for delete.
     */
    _addEntityListItemListeners(itemDiv, item, entityTypeName, onRename, onDelete) {
        itemDiv.querySelector('.edit-btn').addEventListener('click', () => {
            this.showRenameModal(`Rename ${entityTypeName}`, item.name, (newName) => onRename(item.id, newName));
        });
        itemDiv.querySelector('.delete-btn').addEventListener('click', () => {
            this.showDeleteModal(`Delete ${entityTypeName}`, `Are you sure you want to delete "${item.name}"?`, () => onDelete(item.id));
        });
    }

    /**
     * Renders the list of all expenses.
     * @param {Array<Object>} expenses - The array of expense objects from the API.
     * Renders the list of all expenses into a specified container.
     * @param {Array<Object>} expenses - The array of expense objects.
     * @param {HTMLElement} containerElement - The DOM element to render into.
     * @param {function(Object): Promise<void>|null} onEdit - Callback for edit action. Can be null.
     * @param {function(number): Promise<void>|null} onDelete - Callback for delete action. Can be null.
     */
    renderExpenses(expenses, containerElement, onEdit, onDelete) {
        // const containerElement = this.elements.expensesList; // Remove this line
        if (!containerElement) {
            console.error("Render expenses called without a valid container.");
            return;
        }
        containerElement.innerHTML = ''; // Clear the provided container

        if (!expenses || expenses.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No expenses to display.</p>`;
            return;
        }

        const sortedExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedExpenses.forEach(exp => {
            // Pass onEdit and onDelete to _createExpenseListItem to decide if buttons should be rendered
            const expenseDiv = this._createExpenseListItem(exp, onEdit, onDelete);
            // _addExpenseListItemListeners will also need to know about onEdit, onDelete to avoid errors
            this._addExpenseListItemListeners(expenseDiv, exp, onEdit, onDelete);
            containerElement.appendChild(expenseDiv);
        });
    }

    /**
     * Creates a single list item HTML element for an expense.
     * @private
     * @param {Object} exp - The expense object.
     * @param {function(Object): Promise<void>|null} onEditCallback - Callback for edit action.
     * @param {function(number): Promise<void>|null} onDeleteCallback - Callback for delete action.
     * @returns {HTMLElement} The created div element.
     */
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

    _getExpenseItemButtonsHTML(exp, onEditCallback, onDeleteCallback) {
        if (!onEditCallback || !onDeleteCallback) {
            return ''; // No buttons if callbacks are not provided
        }
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

    _createExpenseListItem(exp, onEditCallback, onDeleteCallback) {
        const expenseDiv = document.createElement('div');
        expenseDiv.className = 'bg-white p-4 rounded-lg shadow-sm border border-gray-300 mb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:shadow-md transition-shadow duration-150';

        const contentHtml = this._getExpenseItemContentHTML(exp);
        const buttonsHtml = this._getExpenseItemButtonsHTML(exp, onEditCallback, onDeleteCallback);

        expenseDiv.innerHTML = contentHtml + buttonsHtml;
        return expenseDiv;
    }

    /**
     * Adds event listeners to the buttons within an expense list item.
     * @private
     * @param {HTMLElement} expenseDiv - The div element containing the buttons.
     * @param {Object} exp - The expense object.
     * @param {function(Object): Promise<void>|null} onEditCallback - Callback for edit.
     * @param {function(number): Promise<void>|null} onDeleteCallback - Callback for delete.
     */
    _addExpenseListItemListeners(expenseDiv, exp, onEditCallback, onDeleteCallback) {
        if (onEditCallback) {
            const editBtn = expenseDiv.querySelector('.edit-expense-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    // Call the onEditCallback, which is onEdit passed from renderExpenses
                    onEditCallback(exp);
                });
            }
        }

        if (onDeleteCallback) {
            const deleteBtn = expenseDiv.querySelector('.delete-expense-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    this.showDeleteModal('Delete Expense', 'Are you sure you want to delete this expense?', () => onDeleteCallback(exp.id));
                });
            }
        }
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

        this.populateDropdown(this.elements.editExpenseGroupSelect, data.groups, 'Select Group');
        this.populateDropdown(this.elements.editExpenseCategorySelect, data.categories, 'Select Category');
        this.populateDropdown(this.elements.editExpensePayerSelect, data.payers, 'Select Payer');
        this.populateDropdown(this.elements.editExpensePaymentModeSelect, data.paymentModes, 'Select Payment Mode');

        // Also populate the export expense group checkboxes if the container exists
        if (this.elements.exportExpenseGroupCheckboxContainer && data.groups) {
            this.populateExpenseGroupCheckboxes(data.groups);
        }
    }

    /**
     * Populates the export-specific expense group checkbox container.
     * @param {Array<Object>} groups - Array of group objects.
     */
    populateExpenseGroupCheckboxes(groups) {
        const container = this.elements.exportExpenseGroupCheckboxContainer;
        if (!container) return;

        container.innerHTML = ''; // Clear existing content

        if (groups && groups.length > 0) {
            groups.forEach(group => {
                const div = document.createElement('div');
                div.className = 'flex items-center';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `export-group-checkbox-${group.id}`;
                checkbox.name = 'export-group-filter';
                checkbox.value = group.id;
                checkbox.className = 'mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500';

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = group.name;
                label.className = 'text-sm text-gray-700';

                div.appendChild(checkbox);
                div.appendChild(label);
                container.appendChild(div);
            });
        } else {
            container.innerHTML = '<p class="text-gray-500 text-sm">No groups available to select.</p>';
        }
    }

    /**
     * Gets the current CSV export filter values.
     * @returns {Object} An object containing the filter values.
     */
    getExportFilters() {
        const filters = {
            startDate: this.elements.exportStartDate ? this.elements.exportStartDate.value : '',
            endDate: this.elements.exportEndDate ? this.elements.exportEndDate.value : '',
            allTime: this.elements.exportAllTime ? this.elements.exportAllTime.checked : true,
            expenseGroupIds: []
        };

        if (this.elements.exportExpenseGroupCheckboxContainer) {
            const checkedCheckboxes = this.elements.exportExpenseGroupCheckboxContainer.querySelectorAll('input[name="export-group-filter"]:checked');
            filters.expenseGroupIds = Array.from(checkedCheckboxes).map(cb => cb.value);
        }

        if (filters.allTime) {
            filters.startDate = '';
            filters.endDate = '';
        }
        return filters;
    }

    /**
     * Gets the database connection string from the input field.
     * @returns {string} The database connection string.
     */
    getDatabasePath() {
        return this.elements.dbConnectionString ? this.elements.dbConnectionString.value.trim() : '';
    }

    /**
     * Gets the selected file object for import.
     * @returns {File|null} The file object or null if not selected.
     */
    getImportFile() {
        if (this.elements.csvImportFile && this.elements.csvImportFile.files.length > 0) {
            return this.elements.csvImportFile.files[0];
        }
        return null;
    }

    /**
     * Sets the visual status of the database connection.
     * @param {boolean} isConnected - True if connected, false otherwise.
     * @param {string} connectionMessage - Message to display (e.g., "Connected" or error).
     */
    _updateConnectionButton(isConnected) {
        const button = this.elements.dbConnectToggle;
        if (isConnected) {
            button.textContent = 'Disconnect';
            button.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-blue-600', 'hover:bg-blue-700', 'bg-gray-500', 'hover:bg-gray-600');
            button.classList.add('bg-red-600', 'hover:bg-red-700');
        } else {
            button.textContent = 'Connect';
            button.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }

    _updateConnectionStatusMessage(isConnected, connectionMessage) {
        const input = this.elements.dbConnectionString; // Used for parentNode reference
        if (!this.elements.dbConnectionStatusMessage) {
            this.elements.dbConnectionStatusMessage = document.createElement('p');
            // Ensure className is set before checking parentNode, though it's minor here.
            // The class will be correctly set by the isConnected logic below.
            input.parentNode.insertBefore(this.elements.dbConnectionStatusMessage, input.nextSibling.nextSibling);
        }
        const statusMessageElement = this.elements.dbConnectionStatusMessage;
        statusMessageElement.textContent = connectionMessage;
        statusMessageElement.className = `text-sm mt-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`;
    }

    _updateConnectionInput(isConnected) {
        const input = this.elements.dbConnectionString;
        input.disabled = isConnected;
        if (!isConnected) {
            input.value = ''; // Clear input only when becoming disconnected
        }
    }

    setConnectionStatus(isConnected, connectionMessage) {
        if (!this.elements.dbConnectToggle || !this.elements.dbConnectionString) {
            return;
        }
        this._updateConnectionButton(isConnected);
        this._updateConnectionStatusMessage(isConnected, connectionMessage);
        this._updateConnectionInput(isConnected);

        this._setMainUIEnabled(isConnected);
        if (isConnected) {
            this.activateTab('tab-expenses'); // Activate Expenses tab by default on connect
        }
    }

    _setTabButtonsEnabled(enabled) {
        this.elements.tabButtons.forEach(button => button.disabled = !enabled);
    }

    _setFormElementsEnabled(enabled) {
        const formElements = [
            this.elements.groupNameInput, this.elements.addGroupBtn,
            this.elements.categoryNameInput, this.elements.addCategoryBtn,
            this.elements.payerNameInput, this.elements.addPayerBtn,
            this.elements.paymentModeNameInput, this.elements.addPaymentModeBtn,
            this.elements.expenseDate, this.elements.expenseAmount,
            this.elements.expenseGroupSelect, this.elements.expenseCategorySelect,
            this.elements.expensePayerSelect, this.elements.expensePaymentModeSelect,
            this.elements.expenseDescription, this.elements.addExpenseBtn,
            this.elements.csvImportFile, this.elements.importCsvBtn,
            this.elements.exportCsvBtn,
            // Add new export filter elements to be disabled/enabled
            this.elements.exportStartDate,
            this.elements.exportEndDate,
            this.elements.exportAllTime,
            this.elements.exportExpenseGroupCheckboxContainer, // Main container
        ];
        formElements.forEach(el => {
            if (el) {
                // Special handling for "All Time" checkbox:
                // Date fields should only be re-enabled if "All Time" is NOT checked.
                if ((el === this.elements.exportStartDate || el === this.elements.exportEndDate) && this.elements.exportAllTime && this.elements.exportAllTime.checked) {
                    el.disabled = true;
                } else {
                    el.disabled = !enabled;
                }
            }
        });

        // Also disable/enable all checkboxes within the container
        if (this.elements.exportExpenseGroupCheckboxContainer) {
            const checkboxes = this.elements.exportExpenseGroupCheckboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.disabled = !enabled);
        }
    }

    _setTabContentsVisualState(enabled) {
        this.elements.tabContents.forEach(content => {
            content.style.opacity = enabled ? '1' : '0.5';
            content.style.pointerEvents = enabled ? 'auto' : 'none';
        });
    }

    _updateListPlaceholders(enabled) {
        if (!enabled) {
            this.elements.groupsList.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to manage groups.</p>';
            this.elements.categoriesList.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to manage categories.</p>';
            this.elements.payersList.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to manage payers.</p>';
            this.elements.paymentModesList.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to manage payment modes.</p>';
            this.elements.expensesList.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to manage expenses.</p>';
            if (this.elements.analyticsResultsContainer) {
                this.elements.analyticsResultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to view analytics.</p>';
            }
            if (this.elements.importExportStatus) {
                this.elements.importExportStatus.textContent = 'Connect to database to use Import/Export features.';
                this.elements.importExportStatus.classList.remove('text-red-600', 'text-green-600');
                this.elements.importExportStatus.classList.add('text-gray-700');
            }
        } else {
            // Optionally, clear lists if they shouldn't retain old data when re-enabled before new data load
            // For now, this is handled by render methods clearing their containers.
        }
    }

    /**
     * Enables or disables main UI elements.
     * @private
     * @param {boolean} enabled - True to enable, false to disable.
     */
    _setMainUIEnabled(enabled) {
        this._setTabButtonsEnabled(enabled);
        this._setFormElementsEnabled(enabled);
        this._setTabContentsVisualState(enabled);
        this._updateListPlaceholders(enabled);
    }
}