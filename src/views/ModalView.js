// ModalView.js
export class ModalView {
    /**
     * Manages all modal dialog interactions.
     * @param {Object} elements - Object containing DOM elements for modals.
     *                               e.g., { renameModal, renameModalTitle, renameInput, renameSaveBtn, renameCancelBtn,
     *                                       deleteModal, deleteModalTitle, deleteModalMessage, deleteConfirmBtn, deleteCancelBtn,
     *                                       infoModal, infoModalTitle, infoModalMessage, infoModalOkBtn,
     *                                       editExpenseModal, editExpenseId, editExpenseDate, editExpenseAmount,
     *                                       editExpenseGroupSelect, editExpenseCategorySelect, editExpensePayerSelect,
     *                                       editExpensePaymentModeSelect, editExpenseDescription,
     *                                       editExpenseSaveBtn, editExpenseCancelBtn }
     * @param {function} populateDropdownUtil - Utility function to populate select dropdowns.
     */
    constructor(elements, populateDropdownUtil) {
        this.elements = elements;
        this.populateDropdown = populateDropdownUtil; // Util for populating dropdowns in editExpenseModal

        this.currentRenameCallback = null;
        this.currentDeleteConfirmCallback = null;
        this.currentEditExpenseSaveCallback = null;

        this._setupAllModalListeners();
    }

    _setupAllModalListeners() {
        this._setupRenameModalListeners();
        this._setupDeleteModalListeners();
        this._setupInfoModalListeners();
        this._setupEditExpenseModalListeners();
    }

    _setupRenameModalListeners() {
        if (this.elements.renameSaveBtn) {
            this.elements.renameSaveBtn.addEventListener('click', () => {
                if (this.currentRenameCallback) {
                    this.currentRenameCallback(this.elements.renameInput.value.trim());
                }
                this.hideRenameModal();
            });
        }
        if (this.elements.renameCancelBtn) {
            this.elements.renameCancelBtn.addEventListener('click', () => this.hideRenameModal());
        }
    }

    _setupDeleteModalListeners() {
        if (this.elements.deleteConfirmBtn) {
            this.elements.deleteConfirmBtn.addEventListener('click', () => {
                if (this.currentDeleteConfirmCallback) {
                    this.currentDeleteConfirmCallback();
                }
                this.hideDeleteModal();
            });
        }
        if (this.elements.deleteCancelBtn) {
            this.elements.deleteCancelBtn.addEventListener('click', () => this.hideDeleteModal());
        }
    }

    _setupInfoModalListeners() {
        if (this.elements.infoModalOkBtn) {
            this.elements.infoModalOkBtn.addEventListener('click', () => this.hideInfoModal());
        }
    }

    _setupEditExpenseModalListeners() {
        if (this.elements.editExpenseSaveBtn) {
            this.elements.editExpenseSaveBtn.addEventListener('click', () => {
                if (this.currentEditExpenseSaveCallback) {
                    this.currentEditExpenseSaveCallback();
                }
            });
        }
        if (this.elements.editExpenseCancelBtn) {
            this.elements.editExpenseCancelBtn.addEventListener('click', () => this.hideEditExpenseModal());
        }
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
        this.currentDeleteConfirmCallback = onConfirm;
        this.elements.deleteModal.classList.remove('hidden');
    }

    /** Hides the delete confirmation modal. */
    hideDeleteModal() {
        this.elements.deleteModal.classList.add('hidden');
        this.currentDeleteConfirmCallback = null;
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
     * Shows the edit expense modal and populates it with existing data.
     * @param {Object} expense - The expense object to edit.
     * @param {Object} masterData - Object containing arrays of groups, categories, payers, payment modes.
     * @param {function(): void} onSave - Callback function when save is clicked. The callback should handle data fetching and validation.
     */
    showEditExpenseModal(expense, masterData, onSave) {
        this._populateEditExpenseForm(expense, masterData);
        this.currentEditExpenseSaveCallback = onSave;
        this.elements.editExpenseModal.classList.remove('hidden');
    }

    /**
     * Populates the edit expense form with provided data.
     * @private
     * @param {Object} expense - The expense object to populate the form with.
     * @param {Object} masterData - Object containing arrays of groups, categories, payers, payment modes.
     */
    _populateEditExpenseForm(expense, masterData) {
        this.elements.editExpenseId.value = expense.id; // Store ID for the save operation
        this.elements.editExpenseDate.value = expense.date;
        this.elements.editExpenseAmount.value = expense.amount;
        this.elements.editExpenseDescription.value = expense.expense_description || '';

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
        this.currentEditExpenseSaveCallback = null;
    }

    /**
     * Retrieves the current data from the edit expense form.
     * @returns {Object} The data from the edit expense form.
     */
    getEditExpenseFormData() {
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
}

// No explicit export statement needed here as the class is exported directly
