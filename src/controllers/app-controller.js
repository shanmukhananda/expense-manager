// src/controllers/app-controller.js

import { ApiService } from '../services/api-service.js';
import { UIManager } from '../views/ui.js';
import { AnalyticsManager } from './analytics-controller.js';

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

        this.dbConnected = false;
        this.groups = [];
        this.categories = [];
        this.payers = [];
        this.paymentModes = [];
        this.expenses = [];

        this._bindEventHandlers();
        // onConnectToggle is bound in _bindEventHandlers now
        this.ui.attachAddButtonListeners(); // Attach listeners after binding callbacks

        // Set initial UI state for DB connection
        this.ui.setConnectionStatus(false, 'Enter database URI and click Connect.');
    }

    /**
     * Binds UI event callbacks to App class methods.
     * @private
     */
    _bindEventHandlers() {
        this.ui.onTabChange = this._handleTabChange.bind(this);
        this.ui.onConnectToggle = this.handleConnectToggle.bind(this); // Added
        this.ui.onAddGroup = this._handleAddGroup.bind(this);
        this.ui.onAddCategory = this._handleAddCategory.bind(this);
        this.ui.onAddPayer = this._handleAddPayer.bind(this);
        this.ui.onAddPaymentMode = this._handleAddPaymentMode.bind(this);
        this.ui.onAddExpense = this._handleAddExpense.bind(this);
        this.ui.onEditExpense = this._handleEditExpense.bind(this);
    }

    /**
     * Initializes the application by checking DB status and setting up the UI.
     */
    async init() {
        // The main UI is initially disabled by UIManager.setConnectionStatus in constructor.
        // We check the DB status and enable UI + load data if already connected.
        try {
            await this.checkInitialDbStatus();
        } catch (error) {
            console.error('Error during initial DB status check:', error);
            // UIManager already shows "Enter database URI..."
            // Optionally, show a more specific error if checkInitialDbStatus itself fails badly
            this.ui.showInfoModal('Initialization Check Error', `Could not verify database status: ${error.message}`);
        }
    }

    /**
     * Loads initial data if connected to the database.
     * Renamed from _fetchAllData
     */
    async loadInitialData() {
        if (!this.dbConnected) {
            console.log('loadInitialData skipped: Not connected to DB.');
            // UI should reflect that no data can be loaded / actions performed.
            // uiManager._setMainUIEnabled(false) handles clearing lists.
            return;
        }
        console.log('loadInitialData: Connected, fetching data...');
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
            // Do not re-throw, allow app to continue in disconnected state if user retries
        }
    }

    /**
     * Handles tab changes, re-rendering the appropriate list.
     * @private
     * @param {string} tabId - The ID of the activated tab.
     */
    async _handleTabChange(tabId) {
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', 'Please connect to the database to view data.');
            // Ensure the previously active tab (if any) remains visually selected,
            // or reset to a default non-data view if one exists.
            // For now, UIManager._setMainUIEnabled(false) should have cleared content.
            // If a tab was previously active, it will remain visually so.
            return;
        }
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
                    await this.loadInitialData(); // Re-fetch all master data for dropdowns and expenses
                    this._renderExpenses();
                    break;
                case 'tab-analytics':
                    if (!this.categories || this.categories.length === 0 || !this.paymentModes || this.paymentModes.length === 0 || !this.groups || this.groups.length === 0 || !this.payers || this.payers.length === 0) {
                        await this.loadInitialData();
                    }
                    // Guard against analytics rendering if data is still not available (e.g. loadInitialData failed silently)
                    if (!this.dbConnected) return;
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

    // --- Database Connection Management ---
    async handleConnectToggle() {
        if (this.dbConnected) {
            // Attempt to disconnect
            try {
                await this.api.disconnectDB();
                this.dbConnected = false;
                this.ui.setConnectionStatus(false, 'Disconnected from database.');
                // Clearing UI lists is handled by UIManager._setMainUIEnabled(false)
                // which is called by setConnectionStatus.
                // Reset data arrays
                this.groups = [];
                this.categories = [];
                this.payers = [];
                this.paymentModes = [];
                this.expenses = [];
                // Optionally, switch to a default non-data tab or clear active tab state
                // this.ui.activateTab('some-default-tab-id'); // If you have one
            } catch (error) {
                console.error('Failed to disconnect from database:', error);
                this.ui.showInfoModal('Error', `Failed to disconnect from database: ${error.message}`);
                // UI remains in connected state as disconnect failed.
            }
        } else {
            // Attempt to connect
            const connectionString = this.ui.getDatabasePath();
            if (!connectionString) {
                this.ui.showInfoModal('Input Required', 'Please enter a database connection string.');
                return;
            }
            try {
                await this.api.connectDB(connectionString);
                this.dbConnected = true;
                this.ui.setConnectionStatus(true, 'Successfully connected to database.');
                await this.loadInitialData(); // Fetch and display data
                // Activate a default tab if none is active or to refresh view
                if (this.expenses.length > 0) { // Prioritize expenses tab if data exists
                    this._handleTabChange('tab-expenses');
                } else {
                    this._handleTabChange('tab-groups'); // Default to groups tab
                }
            } catch (error) {
                console.error('Failed to connect to database:', error);
                this.dbConnected = false; // Ensure state is updated
                this.ui.setConnectionStatus(false, `Failed to connect. ${error.message}`);
                this.ui.showInfoModal('Connection Error', `Failed to connect to the database. Please check the connection string and ensure the database server is running. Details: ${error.message}`);
            }
        }
    }

    async checkInitialDbStatus() {
        try {
            const status = await this.api.getDBStatus(); // Assumes API returns { connected: true/false, message?: string }
            if (status && status.connected) {
                this.dbConnected = true;
                this.ui.setConnectionStatus(true, status.message || 'Connected to database.');
                await this.loadInitialData();
                // Activate a default tab, e.g., groups or expenses if they have content
                if (this.expenses && this.expenses.length > 0) {
                     this._handleTabChange('tab-expenses');
                } else if (this.groups && this.groups.length > 0) {
                    this._handleTabChange('tab-groups');
                } else {
                    // If no data, pick a default sensible tab.
                    this.ui.activateTab('tab-groups'); // Or some other default tab
                }
            } else {
                this.dbConnected = false;
                // Message is already set by constructor, but can be reinforced by status.message if provided
                this.ui.setConnectionStatus(false, status.message || 'Enter database URI and click Connect.');
            }
        } catch (error) {
            console.error('Failed to get initial DB status:', error);
            this.dbConnected = false;
            this.ui.setConnectionStatus(false, `Failed to check DB status: ${error.message}. Enter URI and connect.`);
            // No need to showInfoModal here as the default message is already shown
        }
    }

    // --- Render Methods ---
    _renderGroups() {
        if (!this.dbConnected) return;
        this.ui.renderEntityList(this.groups, this.ui.elements.groupsList, 'Expense Group',
            this._handleRenameGroup.bind(this), this._handleDeleteGroup.bind(this));
    }

    _renderCategories() {
        if (!this.dbConnected) return;
        this.ui.renderEntityList(this.categories, this.ui.elements.categoriesList, 'Expense Category',
            this._handleRenameCategory.bind(this), this._handleDeleteCategory.bind(this));
    }

    _renderPayers() {
        if (!this.dbConnected) return;
        this.ui.renderEntityList(this.payers, this.ui.elements.payersList, 'Payer',
            this._handleRenamePayer.bind(this), this._handleDeletePayer.bind(this));
    }

    _renderPaymentModes() {
        if (!this.dbConnected) return;
        this.ui.renderEntityList(this.paymentModes, this.ui.elements.paymentModesList, 'Payment Mode',
            this._handleRenamePaymentMode.bind(this), this._handleDeletePaymentMode.bind(this));
    }

    _renderExpenses() {
        if (!this.dbConnected) return;
        this.ui.renderExpenses(this.expenses, this._handleEditExpense.bind(this), this._handleDeleteExpense.bind(this));
    }

    // --- Generic CRUD Handlers ---
    async _handleAddEntity(apiCall, entityTypeName, successTab) {
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', `Please connect to the database to add a ${entityTypeName}.`);
            return;
        }
        try {
            await apiCall();
            await this._handleTabChange(successTab); // This will re-fetch and re-render
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add ${entityTypeName}: ${error.message}`);
        }
    }

    async _handleRenameEntity(apiCall, entityTypeName, successTab) {
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', `Please connect to the database to rename a ${entityTypeName}.`);
            return;
        }
        try {
            await apiCall();
            await this._handleTabChange(successTab); // This will re-fetch and re-render
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename ${entityTypeName}: ${error.message}`);
        }
    }

    async _handleDeleteEntity(apiCall, entityTypeName, successTab) {
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', `Please connect to the database to delete a ${entityTypeName}.`);
            return;
        }
        try {
            await apiCall();
            await this._handleTabChange(successTab); // This will re-fetch and re-render
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
        // Guard is in _handleAddEntity, but good to be explicit if params are involved before call
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', 'Please connect to the database to add an expense.');
            return;
        }
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
        if (!this.dbConnected) {
            this.ui.showInfoModal('Not Connected', 'Please connect to the database to edit an expense.');
            return;
        }
        // Ensure master data for dropdowns is available
        if (!this.groups.length || !this.categories.length || !this.payers.length || !this.paymentModes.length) {
            console.log('_handleEditExpense: Master data missing, attempting to load.');
            await this.loadInitialData(); // Load data if not already present
            if (!this.dbConnected) return; // loadInitialData might fail if DB is still down
            // If still missing after load, inform user and don't open modal
            if (!this.groups.length || !this.categories.length || !this.payers.length || !this.paymentModes.length) {
                 this.ui.showInfoModal('Data Missing', 'Could not load necessary master data (groups, categories, etc.) for editing. Please try again.');
                 return;
            }
        }

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
