// public/js/app.js
import { ApiService } from './api.js';
import { UIManager } from './ui.js';
import { AnalyticsManager } from './AnalyticsManager.js';

/**
 * Main application class to manage state and orchestrate interactions.
 * Adheres to the Facade pattern, providing a simplified interface to the
 * underlying API and UI managers.
 */
class App {
    constructor() {
        this.api = new ApiService();
        this.ui = new UIManager();
        this.analyticsManager = new AnalyticsManager(
            this.ui, 
            this.ui.elements.analyticsFiltersContainer, 
            this.ui.elements.analyticsResultsContainer
        );

        this._bindEventHandlers();
        this.ui.attachAddButtonListeners(); // Attach listeners after binding callbacks

        this.groups = [];
        this.categories = [];
        this.payers = [];
        this.paymentModes = [];
        this.expenses = [];
    }

    /**
     * Binds UI event callbacks to App class methods.
     * @private
     */
    _bindEventHandlers() {
        this.ui.onTabChange = this._handleTabChange.bind(this);
        this.ui.onAddGroup = this._handleAddGroup.bind(this);
        this.ui.onAddCategory = this._handleAddCategory.bind(this);
        this.ui.onAddPayer = this._handleAddPayer.bind(this);
        this.ui.onAddPaymentMode = this._handleAddPaymentMode.bind(this);
        this.ui.onAddExpense = this._handleAddExpense.bind(this);
        this.ui.onEditExpense = this._handleEditExpense.bind(this);
    }

    /**
     * Initializes the application by fetching initial data and setting up the UI.
     */
    async init() {
        try {
            await this.api.initDb();
            console.log('Backend database ready.');
            await this._fetchAllData();
            this.ui.activateTab('tab-groups');
            this._renderGroups();
        } catch (error) {
            console.error('App initialization failed:', error);
            this.ui.showInfoModal('Initialization Error', `Failed to load application: ${error.message}. Please ensure the backend server is running.`);
        }
    }

    /**
     * Fetches all master data and expenses from the backend.
     * @private
     */
    async _fetchAllData() {
        try {
            [this.groups, this.categories, this.payers, this.paymentModes, this.expenses] = await Promise.all([
                this.api.getGroups(),
                this.api.getCategories(),
                this.api.getPayers(),
                this.api.getPaymentModes(),
                this.api.getExpenses()
            ]);
            this.ui.populateAllDropdowns({
                groups: this.groups,
                categories: this.categories,
                payers: this.payers,
                paymentModes: this.paymentModes
            });
        } catch (error) {
            console.error('Error fetching all data:', error);
            this.ui.showInfoModal('Data Fetch Error', `Failed to load data: ${error.message}`);
            throw error; // Re-throw to prevent further operations on incomplete data
        }
    }

    /**
     * Handles tab changes, re-rendering the appropriate list.
     * @private
     * @param {string} tabId - The ID of the activated tab.
     */
    async _handleTabChange(tabId) {
        this.ui.activateTab(tabId);

        try {
            switch (tabId) {
                case 'tab-groups':
                    this.groups = await this.api.getGroups();
                    this._renderGroups();
                    break;
                case 'tab-categories':
                    this.categories = await this.api.getCategories();
                    this._renderCategories();
                    break;
                case 'tab-payers':
                    this.payers = await this.api.getPayers();
                    this._renderPayers();
                    break;
                case 'tab-payment-modes':
                    this.paymentModes = await this.api.getPaymentModes();
                    this._renderPaymentModes();
                    break;
                case 'tab-expenses':
                    await this._fetchAllData(); // Re-fetch all master data for dropdowns and expenses
                    this._renderExpenses();
                    break;
                case 'tab-analytics':
                    if (!this.categories || this.categories.length === 0 || !this.paymentModes || this.paymentModes.length === 0 || !this.groups || this.groups.length === 0 || !this.payers || this.payers.length === 0) {
                        await this._fetchAllData(); 
                    }
                    this.analyticsManager.renderAnalyticsFilters({
                        categories: this.categories,
                        paymentModes: this.paymentModes,
                        groups: this.groups,
                        payers: this.payers
                    }, this._handleApplyAnalyticsFilters.bind(this));
                    this.analyticsManager.renderAnalyticsResults(null); // Clear previous results
                    break;
            }
        } catch (error) {
            console.error(`Error loading tab ${tabId}:`, error);
            this.ui.showInfoModal('Load Error', `Failed to load ${tabId.replace('tab-', '')} data: ${error.message}`);
        }
    }

    async _handleApplyAnalyticsFilters() {
        try {
            const filters = this.analyticsManager.getAnalyticsFilterValues();
            const analyticsData = await this.api.getAnalytics(filters);
            this.analyticsManager.renderAnalyticsResults(analyticsData);
        } catch (error) {
            console.error('Error applying analytics filters:', error);
            this.ui.showInfoModal('Analytics Error', `Failed to load analytics data: ${error.message}`);
        }
    }

    // --- Render Methods ---
    _renderGroups() {
        this.ui.renderEntityList(this.groups, this.ui.elements.groupsList, 'Expense Group',
            this._handleRenameGroup.bind(this), this._handleDeleteGroup.bind(this));
    }

    _renderCategories() {
        this.ui.renderEntityList(this.categories, this.ui.elements.categoriesList, 'Expense Category',
            this._handleRenameCategory.bind(this), this._handleDeleteCategory.bind(this));
    }

    _renderPayers() {
        this.ui.renderEntityList(this.payers, this.ui.elements.payersList, 'Payer',
            this._handleRenamePayer.bind(this), this._handleDeletePayer.bind(this));
    }

    _renderPaymentModes() {
        this.ui.renderEntityList(this.paymentModes, this.ui.elements.paymentModesList, 'Payment Mode',
            this._handleRenamePaymentMode.bind(this), this._handleDeletePaymentMode.bind(this));
    }

    _renderExpenses() {
        this.ui.renderExpenses(this.expenses, this._handleEditExpense.bind(this), this._handleDeleteExpense.bind(this));
    }

    // --- Generic CRUD Handlers ---
    async _handleAddEntity(apiCall, entityTypeName, successTab) {
        try {
            await apiCall();
            await this._handleTabChange(successTab);
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add ${entityTypeName}: ${error.message}`);
        }
    }

    async _handleRenameEntity(apiCall, entityTypeName, successTab) {
        try {
            await apiCall();
            await this._handleTabChange(successTab);
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename ${entityTypeName}: ${error.message}`);
        }
    }

    async _handleDeleteEntity(apiCall, entityTypeName, successTab) {
        try {
            await apiCall();
            await this._handleTabChange(successTab);
        } catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete ${entityTypeName}: ${error.message}`);
        }
    }

    // --- Specific Add Handlers (delegating to generic) ---
    async _handleAddGroup(name) {
        await this._handleAddEntity(() => this.api.addGroup(name), 'group', 'tab-groups');
    }

    async _handleAddCategory(name) {
        await this._handleAddEntity(() => this.api.addCategory(name), 'category', 'tab-categories');
    }

    async _handleAddPayer(name) {
        await this._handleAddEntity(() => this.api.addPayer(name), 'payer', 'tab-payers');
    }

    async _handleAddPaymentMode(name) {
        await this._handleAddEntity(() => this.api.addPaymentMode(name), 'payment mode', 'tab-payment-modes');
    }

    async _handleAddExpense(expenseData) {
        await this._handleAddEntity(() => this.api.addExpense(expenseData), 'expense', 'tab-expenses');
    }

    // --- Specific Rename Handlers (delegating to generic) ---
    async _handleRenameGroup(id, newName) {
        await this._handleRenameEntity(() => this.api.updateGroup(id, newName), 'group', 'tab-groups');
    }

    async _handleRenameCategory(id, newName) {
        await this._handleRenameEntity(() => this.api.updateCategory(id, newName), 'category', 'tab-categories');
    }

    async _handleRenamePayer(id, newName) {
        await this._handleRenameEntity(() => this.api.updatePayer(id, newName), 'payer', 'tab-payers');
    }

    async _handleRenamePaymentMode(id, newName) {
        await this._handleRenameEntity(() => this.api.updatePaymentMode(id, newName), 'payment mode', 'tab-payment-modes');
    }

    // --- Specific Edit Expense Handler ---
    async _handleEditExpense(expenseToEdit) {
        this.ui.showEditExpenseModal(expenseToEdit, {
            groups: this.groups,
            categories: this.categories,
            payers: this.payers,
            paymentModes: this.paymentModes
        }, async (updatedExpenseData) => {
            try {
                await this.api.updateExpense(updatedExpenseData.id, updatedExpenseData);
                await this._handleTabChange('tab-expenses');
            } catch (error) {
                this.ui.showInfoModal('Edit Error', `Failed to update expense: ${error.message}`);
            }
        });
    }

    // --- Specific Delete Handlers (delegating to generic) ---
    async _handleDeleteGroup(id) {
        await this._handleDeleteEntity(() => this.api.deleteGroup(id), 'group', 'tab-groups');
    }

    async _handleDeleteCategory(id) {
        await this._handleDeleteEntity(() => this.api.deleteCategory(id), 'category', 'tab-categories');
    }

    async _handleDeletePayer(id) {
        await this._handleDeleteEntity(() => this.api.deletePayer(id), 'payer', 'tab-payers');
    }

    async _handleDeletePaymentMode(id) {
        await this._handleDeleteEntity(() => this.api.deletePaymentMode(id), 'payment mode', 'tab-payment-modes');
    }

    async _handleDeleteExpense(id) {
        await this._handleDeleteEntity(() => this.api.deleteExpense(id), 'expense', 'tab-expenses');
    }
}

// Initialize the application when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
