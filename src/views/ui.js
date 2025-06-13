// src/views/ui.js

const TabView = require('./TabView');
const ModalView = require('./ModalView');
const EntityListView = require('./EntityListView');
const ExpenseView = require('./ExpenseView');
const CsvView = require('./CsvView');
const DbConnectionView = require('./DbConnectionView');

class UIManager {
    constructor() {
        this.elements = this._cacheDOMElements();
        this._initializeSubManagers();
        this._setupGlobalEventListeners(); // Minimal global listeners if any

        // Store callbacks from AppController - to be set via setAppCallbacks
        this.callbacks = {};
    }

    _cacheDOMElements() {
        return {
            // Tabs
            tabButtons: document.querySelectorAll('.tab-button'),
            tabContents: document.querySelectorAll('.tab-content'),
            // Entity Lists
            groupsList: document.getElementById('groups-list'),
            categoriesList: document.getElementById('categories-list'),
            payersList: document.getElementById('payers-list'),
            paymentModesList: document.getElementById('payment-modes-list'),
            // Entity Add Forms
            groupNameInput: document.getElementById('group-name-input'),
            addGroupBtn: document.getElementById('add-group-btn'),
            categoryNameInput: document.getElementById('category-name-input'),
            addCategoryBtn: document.getElementById('add-category-btn'),
            payerNameInput: document.getElementById('payer-name-input'),
            addPayerBtn: document.getElementById('add-payer-btn'),
            paymentModeNameInput: document.getElementById('payment-mode-name-input'),
            addPaymentModeBtn: document.getElementById('add-payment-mode-btn'),
            // Expense Add Form
            expenseDate: document.getElementById('expense-date'),
            expenseAmount: document.getElementById('expense-amount'),
            expenseGroupSelect: document.getElementById('expense-group-select'),
            expenseCategorySelect: document.getElementById('expense-category-select'),
            expensePayerSelect: document.getElementById('expense-payer-select'),
            expensePaymentModeSelect: document.getElementById('expense-payment-mode-select'),
            expenseDescription: document.getElementById('expense-description'),
            addExpenseBtn: document.getElementById('add-expense-btn'),
            expensesList: document.getElementById('expenses-list'),
            // Modals
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
            // CSV
            csvImportFile: document.getElementById('csv-import-file'),
            importCsvBtn: document.getElementById('import-csv-btn'),
            exportCsvBtn: document.getElementById('export-csv-btn'),
            importExportStatus: document.getElementById('import-export-status'),
            exportStartDate: document.getElementById('export-start-date'),
            exportEndDate: document.getElementById('export-end-date'),
            exportAllTime: document.getElementById('export-all-time'),
            exportExpenseGroupCheckboxContainer: document.getElementById('export-expense-group-checkbox-container'),
            // DB Connection
            dbConnectionString: document.getElementById('db-connection-string'),
            dbConnectToggle: document.getElementById('db-connect-toggle'),
            // dbConnectionStatusMessage is created dynamically by DbConnectionUIManager
            // Analytics (if any specific elements needed by DbConnectionUIManager for disabling)
            contentAnalytics: document.getElementById('content-analytics'),
            analyticsFiltersContainer: document.getElementById('analytics-filters-container'),
            analyticsResultsContainer: document.getElementById('analytics-results-container'),
        };
    }

    _initializeSubManagers() {
        // ModalView is foundational
        this.modalView = new ModalView({
            renameModal: this.elements.renameModal,
            renameModalTitle: this.elements.renameModalTitle,
            renameInput: this.elements.renameInput,
            renameSaveBtn: this.elements.renameSaveBtn,
            renameCancelBtn: this.elements.renameCancelBtn,
            deleteModal: this.elements.deleteModal,
            deleteModalTitle: this.elements.deleteModalTitle,
            deleteModalMessage: this.elements.deleteModalMessage,
            deleteConfirmBtn: this.elements.deleteConfirmBtn,
            deleteCancelBtn: this.elements.deleteCancelBtn,
            infoModal: this.elements.infoModal,
            infoModalTitle: this.elements.infoModalTitle,
            infoModalMessage: this.elements.infoModalMessage,
            infoModalOkBtn: this.elements.infoModalOkBtn,
            editExpenseModal: this.elements.editExpenseModal,
            editExpenseId: this.elements.editExpenseId,
            editExpenseDate: this.elements.editExpenseDate,
            editExpenseAmount: this.elements.editExpenseAmount,
            editExpenseGroupSelect: this.elements.editExpenseGroupSelect,
            editExpenseCategorySelect: this.elements.editExpenseCategorySelect,
            editExpensePayerSelect: this.elements.editExpensePayerSelect,
            editExpensePaymentModeSelect: this.elements.editExpensePaymentModeSelect,
            editExpenseDescription: this.elements.editExpenseDescription,
            editExpenseSaveBtn: this.elements.editExpenseSaveBtn,
            editExpenseCancelBtn: this.elements.editExpenseCancelBtn,
        }, this._populateDropdownUtility.bind(this));

        this.tabView = new TabView({
            tabButtons: this.elements.tabButtons,
            tabContents: this.elements.tabContents,
        },
        (tabId) => this.onTabChange(tabId)
        );

        this.entityListView = new EntityListView({
            groupsList: this.elements.groupsList,
            categoriesList: this.elements.categoriesList,
            payersList: this.elements.payersList,
            paymentModesList: this.elements.paymentModesList,
            groupNameInput: this.elements.groupNameInput,
            addGroupBtn: this.elements.addGroupBtn,
            categoryNameInput: this.elements.categoryNameInput,
            addCategoryBtn: this.elements.addCategoryBtn,
            payerNameInput: this.elements.payerNameInput,
            addPayerBtn: this.elements.addPayerBtn,
            paymentModeNameInput: this.elements.paymentModeNameInput,
            addPaymentModeBtn: this.elements.addPaymentModeBtn,
        }, this.modalView, {
            onAddGroup: async (name) => { if (this.callbacks.onAddGroup) return this.callbacks.onAddGroup(name); },
            onRenameGroup: async (id, name) => { if (this.callbacks.onRenameGroup) return this.callbacks.onRenameGroup(id, name); },
            onDeleteGroup: async (id) => { if (this.callbacks.onDeleteGroup) return this.callbacks.onDeleteGroup(id); },
            onAddCategory: async (name) => { if (this.callbacks.onAddCategory) return this.callbacks.onAddCategory(name); },
            onRenameCategory: async (id, name) => { if (this.callbacks.onRenameCategory) return this.callbacks.onRenameCategory(id, name); },
            onDeleteCategory: async (id) => { if (this.callbacks.onDeleteCategory) return this.callbacks.onDeleteCategory(id); },
            onAddPayer: async (name) => { if (this.callbacks.onAddPayer) return this.callbacks.onAddPayer(name); },
            onRenamePayer: async (id, name) => { if (this.callbacks.onRenamePayer) return this.callbacks.onRenamePayer(id, name); },
            onDeletePayer: async (id) => { if (this.callbacks.onDeletePayer) return this.callbacks.onDeletePayer(id); },
            onAddPaymentMode: async (name) => { if (this.callbacks.onAddPaymentMode) return this.callbacks.onAddPaymentMode(name); },
            onRenamePaymentMode: async (id, name) => { if (this.callbacks.onRenamePaymentMode) return this.callbacks.onRenamePaymentMode(id, name); },
            onDeletePaymentMode: async (id) => { if (this.callbacks.onDeletePaymentMode) return this.callbacks.onDeletePaymentMode(id); },
        });

        this.expenseView = new ExpenseView({
            expensesList: this.elements.expensesList,
            expenseDate: this.elements.expenseDate,
            expenseAmount: this.elements.expenseAmount,
            expenseGroupSelect: this.elements.expenseGroupSelect,
            expenseCategorySelect: this.elements.expenseCategorySelect,
            expensePayerSelect: this.elements.expensePayerSelect,
            expensePaymentModeSelect: this.elements.expensePaymentModeSelect,
            expenseDescription: this.elements.expenseDescription,
            addExpenseBtn: this.elements.addExpenseBtn,
        }, this.modalView,
        (title, message) => this.modalView.showInfoModal(title, message),
        {
            onAddExpense: async (data) => { if (this.callbacks.onAddExpense) return this.callbacks.onAddExpense(data); },
            onEditExpense: async (data) => { if (this.callbacks.onEditExpense) return this.callbacks.onEditExpense(data); },
            onDeleteExpense: async (id) => { if (this.callbacks.onDeleteExpense) return this.callbacks.onDeleteExpense(id); },
        }, this._populateDropdownUtility.bind(this));

        this.csvView = new CsvView({
            csvImportFile: this.elements.csvImportFile,
            importCsvBtn: this.elements.importCsvBtn,
            exportCsvBtn: this.elements.exportCsvBtn,
            importExportStatus: this.elements.importExportStatus,
            exportStartDate: this.elements.exportStartDate,
            exportEndDate: this.elements.exportEndDate,
            exportAllTime: this.elements.exportAllTime,
            exportExpenseGroupCheckboxContainer: this.elements.exportExpenseGroupCheckboxContainer,
        }, {
            onImportCsv: async (file) => { if (this.callbacks.onImportCsv) return this.callbacks.onImportCsv(file); },
            onExportCsv: async (filters) => { if (this.callbacks.onExportCsv) return this.callbacks.onExportCsv(filters); },
        },
        (message, isError, isSuccess) => this.displayImportExportStatus(message, isError, isSuccess)
        );

        const allUiElementsForDbManager = { ...this.elements };
        delete allUiElementsForDbManager.dbConnectionString;
        delete allUiElementsForDbManager.dbConnectToggle;
        delete allUiElementsForDbManager.dbConnectionStatusMessage;

        this.dbConnectionView = new DbConnectionView(
            {
                dbConnectionString: this.elements.dbConnectionString,
                dbConnectToggle: this.elements.dbConnectToggle,
            },
            async () => { if (this.callbacks.onConnectToggle) return this.callbacks.onConnectToggle(); },
            allUiElementsForDbManager,
            {
                entityManagerUI: this.entityListView, // Pass updated property name
                expenseUIManager: this.expenseView, // Pass updated property name
                csvUIManager: this.csvView,       // Pass updated property name
            },
            (tabId) => this.tabView.activateTab(tabId)
        );
    }

    setAppCallbacks(callbacks) {
        this.callbacks = callbacks;
    }

    _setupGlobalEventListeners() {
        // Minimal, if any. Most are in sub-managers.
    }

    activateTab(tabId) {
        this.tabView.activateTab(tabId);
    }

    onTabChange(tabId) {
        if(this.callbacks.onTabSwitched) {
            this.callbacks.onTabSwitched(tabId);
        }
        // console.log(`UIManager: Switched to tab: ${tabId}`);
    }

    renderGroups(groups) { this.entityListView.renderGroups(groups); }
    renderCategories(categories) { this.entityListView.renderCategories(categories); }
    renderPayers(payers) { this.entityListView.renderPayers(payers); }
    renderPaymentModes(paymentModes) { this.entityListView.renderPaymentModes(paymentModes); }

    renderExpenses(expenses) { this.expenseView.renderExpenses(expenses); }

    _populateDropdownUtility(selectElement, entities, defaultOptionText) {
        if (!selectElement) return;
        selectElement.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = defaultOptionText;
        selectElement.appendChild(defaultOpt);

        if (entities) {
            entities.forEach(entity => {
                const option = document.createElement('option');
                option.value = entity.id;
                option.textContent = entity.name;
                selectElement.appendChild(option);
            });
        }
    }

    populateAllDropdowns(masterData) {
        this.expenseView.populateExpenseFormDropdowns(masterData);
        this.csvView.populateExpenseGroupCheckboxesForExport(masterData.groups);
    }

    getImportFile() { return this.csvView.getImportFile(); }
    getExportFilters() { return this.csvView.getExportFilters(); }
    triggerCsvDownload(csvString, filename) { this.csvView.triggerCsvDownload(csvString, filename); }

    displayImportExportStatus(message, isError = false, isSuccess = false) {
        const statusEl = this.elements.importExportStatus;
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'text-sm mt-1';
            if (isError) statusEl.classList.add('text-red-600');
            else if (isSuccess) statusEl.classList.add('text-green-600');
            else statusEl.classList.add('text-gray-700');
        }
    }

    getDatabaseConnectionString() { return this.dbConnectionView.getDatabaseConnectionString(); }
    setConnectionStatus(isConnected, message) { this.dbConnectionView.setConnectionStatus(isConnected, message); }

    showInfoModal(title, message) { this.modalView.showInfoModal(title, message); }
}

module.exports = { UIManager };
