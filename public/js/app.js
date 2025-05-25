// public/js/app.js
import { ApiService } from './api.js';
import { UIManager } from './ui.js';

/**
 * Main application class to manage state and orchestrate interactions.
 */
class App {
    constructor() {
        this.api = new ApiService();
        this.ui = new UIManager();

        // Bind UI callbacks to App methods
        this.ui.onTabChange = this.handleTabChange.bind(this);
        this.ui.onAddGroup = this.handleAddGroup.bind(this);
        this.ui.onAddCategory = this.handleAddCategory.bind(this);
        this.ui.onAddPayer = this.handleAddPayer.bind(this);
        this.ui.onAddPaymentMode = this.handleAddPaymentMode.bind(this);
        this.ui.onAddExpense = this.handleAddExpense.bind(this);
        this.ui.onEditExpense = this.handleEditExpense.bind(this); // New binding for edit expense

        // Attach add button listeners after callbacks are bound
        this.ui.attachAddButtonListeners();

        // Initialize state
        this.groups = [];
        this.categories = [];
        this.payers = [];
        this.paymentModes = [];
        this.expenses = [];
    }

    /**
     * Initializes the application by fetching initial data and setting up the UI.
     */
    async init() {
        try {
            // Ensure database is initialized on the backend
            await this.api.initDb();
            console.log('Backend database ready.');

            // Fetch all initial data
            await this.fetchAllData();

            // Activate the default tab
            this.ui.activateTab('tab-groups');
            this.ui.renderEntityList(this.groups, this.ui.elements.groupsList, 'Expense Group',
                this.handleRenameGroup.bind(this), this.handleDeleteGroup.bind(this));

        } catch (error) {
            console.error('App initialization failed:', error);
            this.ui.showInfoModal('Initialization Error', `Failed to load application: ${error.message}. Please ensure the backend server is running.`);
        }
    }

    /**
     * Fetches all master data and expenses from the backend.
     */
    async fetchAllData() {
        try {
            this.groups = await this.api.getGroups();
            this.categories = await this.api.getCategories();
            this.payers = await this.api.getPayers();
            this.paymentModes = await this.api.getPaymentModes();
            this.expenses = await this.api.getExpenses();

            // Populate dropdowns for the expenses tab
            this.ui.populateAllDropdowns({
                groups: this.groups,
                categories: this.categories,
                payers: this.payers,
                paymentModes: this.paymentModes
            });
        } catch (error) {
            console.error('Error fetching all data:', error);
            this.ui.showInfoModal('Data Fetch Error', `Failed to load data: ${error.message}`);
        }
    }

    /**
     * Handles tab changes, re-rendering the appropriate list.
     * @param {string} tabId - The ID of the activated tab.
     */
    async handleTabChange(tabId) {
        this.ui.activateTab(tabId); // Visually activate tab

        try {
            switch (tabId) {
                case 'tab-groups':
                    this.groups = await this.api.getGroups();
                    this.ui.renderEntityList(this.groups, this.ui.elements.groupsList, 'Expense Group',
                        this.handleRenameGroup.bind(this), this.handleDeleteGroup.bind(this));
                    break;
                case 'tab-categories':
                    this.categories = await this.api.getCategories();
                    this.ui.renderEntityList(this.categories, this.ui.elements.categoriesList, 'Expense Category',
                        this.handleRenameCategory.bind(this), this.handleDeleteCategory.bind(this));
                    break;
                case 'tab-payers':
                    this.payers = await this.api.getPayers();
                    this.ui.renderEntityList(this.payers, this.ui.elements.payersList, 'Payer',
                        this.handleRenamePayer.bind(this), this.handleDeletePayer.bind(this));
                    break;
                case 'tab-payment-modes':
                    this.paymentModes = await this.api.getPaymentModes();
                    this.ui.renderEntityList(this.paymentModes, this.ui.elements.paymentModesList, 'Payment Mode',
                        this.handleRenamePaymentMode.bind(this), this.handleDeletePaymentMode.bind(this));
                    break;
                case 'tab-expenses':
                    await this.fetchAllData(); // Re-fetch all master data for dropdowns and expenses
                    // Pass handleEditExpense as the second callback
                    this.ui.renderExpenses(this.expenses, this.handleEditExpense.bind(this), this.handleDeleteExpense.bind(this));
                    break;
            }
        } catch (error) {
            console.error(`Error loading tab ${tabId}:`, error);
            this.ui.showInfoModal('Load Error', `Failed to load ${tabId.replace('tab-', '')} data: ${error.message}`);
        }
    }

    // --- Handlers for Add Operations ---
    async handleAddGroup(name) {
        try {
            await this.api.addGroup(name);
            await this.handleTabChange('tab-groups'); // Re-render list
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add group: ${error.message}`);
        }
    }

    async handleAddCategory(name) {
        try {
            await this.api.addCategory(name);
            await this.handleTabChange('tab-categories'); // Re-render list
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add category: ${error.message}`);
        }
    }

    async handleAddPayer(name) {
        try {
            await this.api.addPayer(name);
            await this.handleTabChange('tab-payers'); // Re-render list
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add payer: ${error.message}`);
        }
    }

    async handleAddPaymentMode(name) {
        try {
            await this.api.addPaymentMode(name);
            await this.handleTabChange('tab-payment-modes'); // Re-render list
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add payment mode: ${error.message}`);
        }
    }

    async handleAddExpense(expenseData) {
        try {
            await this.api.addExpense(expenseData);
            await this.handleTabChange('tab-expenses'); // Re-render list
        } catch (error) {
            this.ui.showInfoModal('Add Error', `Failed to add expense: ${error.message}`);
        }
    }

    // --- Handlers for Rename Operations ---
    async handleRenameGroup(id, newName) {
        try {
            await this.api.updateGroup(id, newName);
            await this.handleTabChange('tab-groups');
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename group: ${error.message}`);
        }
    }

    async handleRenameCategory(id, newName) {
        try {
            await this.api.updateCategory(id, newName);
            await this.handleTabChange('tab-categories');
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename category: ${error.message}`);
        }
    }

    async handleRenamePayer(id, newName) {
        try {
            await this.api.updatePayer(id, newName);
            await this.handleTabChange('tab-payers');
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename payer: ${error.message}`);
        }
    }

    async handleRenamePaymentMode(id, newName) {
        try {
            await this.api.updatePaymentMode(id, newName);
            await this.handleTabChange('tab-payment-modes');
        } catch (error) {
            this.ui.showInfoModal('Rename Error', `Failed to rename payment mode: ${error.message}`);
        }
    }

    // --- Handlers for Edit Expense Operation ---
    async handleEditExpense(expenseToEdit) {
        // Show the edit modal and pass the expense data and a callback for saving
        this.ui.showEditExpenseModal(expenseToEdit, {
            groups: this.groups,
            categories: this.categories,
            payers: this.payers,
            paymentModes: this.paymentModes
        }, async (updatedExpenseData) => {
            try {
                await this.api.updateExpense(updatedExpenseData.id, updatedExpenseData);
                await this.handleTabChange('tab-expenses'); // Re-render expenses after update
            } catch (error) {
                this.ui.showInfoModal('Edit Error', `Failed to update expense: ${error.message}`);
            }
        });
    }

    // --- Handlers for Delete Operations ---
    async handleDeleteGroup(id) {
        try {
            await this.api.deleteGroup(id);
            await this.handleTabChange('tab-groups');
        } catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete group: ${error.message}`);
        }
    }

    async handleDeleteCategory(id) {
        try {
            await this.api.deleteCategory(id);
            await this.handleTabChange('tab-categories');
        } catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete category: ${error.message}`);
        }
    }

    async handleDeletePayer(id) {
        try {
            await this.api.deletePayer(id);
            await this.handleTabChange('tab-payers');
        }
        catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete payer: ${error.message}`);
        }
    }

    async handleDeletePaymentMode(id) {
        try {
            await this.api.deletePaymentMode(id);
            await this.handleTabChange('tab-payment-modes');
        } catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete payment mode: ${error.message}`);
        }
    }

    async handleDeleteExpense(id) {
        try {
            await this.api.deleteExpense(id);
            await this.handleTabChange('tab-expenses');
        } catch (error) {
            this.ui.showInfoModal('Delete Error', `Failed to delete expense: ${error.message}`);
        }
    }
}

// Initialize the application when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});