// DbConnectionView.js
export class DbConnectionView {
    /**
     * Manages UI for database connection.
     * @param {Object} elements - DOM elements for DB connection.
     *                             e.g., { dbConnectionString, dbConnectToggle, (and a way to create dbConnectionStatusMessage) }
     * @param {function(): Promise<void>} onConnectToggleCallback - Callback when connect/disconnect is triggered.
     * @param {Object} allUiElements - A flat object containing all UI elements that need to be enabled/disabled.
     * @param {Object} uiStateManagers - Object containing other UI managers to call their displayDisconnectedState methods.
     *                                   e.g., { entityManagerUI, expenseUIManager, csvUIManager }
     * @param {function(string): void} activateTabCallback - Callback to activate a specific tab.
     */
    constructor(elements, onConnectToggleCallback, allUiElements, uiStateManagers, activateTabCallback) {
        this.elements = elements; // { dbConnectionString, dbConnectToggle }
        this.onConnectToggle = onConnectToggleCallback;
        this.allUiElements = allUiElements; // Used by _setMainUIEnabled
        this.uiStateManagers = uiStateManagers; // For calling displayDisconnectedState on sub-managers
        this.activateTab = activateTabCallback; // To switch tab on connect
        this._setupEventListeners();
    }

    _setupEventListeners() {
        if (this.elements.dbConnectToggle) {
            this.elements.dbConnectToggle.addEventListener('click', async () => {
                if (this.onConnectToggle) {
                    await this.onConnectToggle();
                }
            });
        }
    }

    getDatabaseConnectionString() {
        return this.elements.dbConnectionString ? this.elements.dbConnectionString.value.trim() : '';
    }

    _updateConnectionButton(isConnected) {
        const button = this.elements.dbConnectToggle;
        if (!button) return;
        if (isConnected) {
            button.textContent = 'Disconnect';
            button.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-red-600', 'hover:bg-red-700');
        } else {
            button.textContent = 'Connect';
            button.classList.remove('bg-red-600', 'hover:bg-red-700', 'bg-green-600', 'hover:bg-green-700');
            button.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }

    _ensureStatusMessageElement() {
        if (!this.elements.dbConnectionStatusMessage && this.elements.dbConnectionString) {
            // Create and cache the status message element if it doesn't exist
            const p = document.createElement('p');
            this.elements.dbConnectionString.parentNode.insertBefore(p, this.elements.dbConnectionString.nextSibling.nextSibling);
            this.elements.dbConnectionStatusMessage = p;
        }
        return this.elements.dbConnectionStatusMessage;
    }

    _updateConnectionStatusMessage(isConnected, connectionMessage) {
        const statusMessageElement = this._ensureStatusMessageElement();
        if (statusMessageElement) {
            statusMessageElement.textContent = connectionMessage;
            statusMessageElement.className = `text-sm mt-1 ${isConnected ? 'text-green-600' : 'text-red-600'}`;
        }
    }

    _updateConnectionInput(isConnected) {
        if (this.elements.dbConnectionString) {
            this.elements.dbConnectionString.disabled = isConnected;
            // Do not clear the input on disconnect, user might want to copy it or retry
        }
    }

    setConnectionStatus(isConnected, connectionMessage) {
        this._updateConnectionButton(isConnected);
        this._updateConnectionStatusMessage(isConnected, connectionMessage);
        this._updateConnectionInput(isConnected);
        this._setMainUIEnabled(isConnected);

        if (isConnected) {
            if (this.activateTab) this.activateTab('tab-expenses'); // Switch to a useful tab on connect
        } else {
            // When disconnected, tell other managers to update their states
            if (this.uiStateManagers.entityManagerUI) this.uiStateManagers.entityManagerUI.displayDisconnectedState();
            if (this.uiStateManagers.expenseUIManager) this.uiStateManagers.expenseUIManager.displayDisconnectedState();
            if (this.uiStateManagers.csvUIManager) this.uiStateManagers.csvUIManager.displayDisconnectedState();
            // Analytics UI would also need this if it were a separate manager
            if (this.allUiElements.analyticsResultsContainer) {
                 this.allUiElements.analyticsResultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Connect to database to view analytics.</p>';
            }
        }
    }

    _setTabButtonsEnabled(enabled) {
        if (this.allUiElements.tabButtons) {
            this.allUiElements.tabButtons.forEach(button => button.disabled = !enabled);
        }
    }

    _setFormElementsEnabled(enabled) {
        const formElements = [
            this.allUiElements.groupNameInput, this.allUiElements.addGroupBtn,
            this.allUiElements.categoryNameInput, this.allUiElements.addCategoryBtn,
            this.allUiElements.payerNameInput, this.allUiElements.addPayerBtn,
            this.allUiElements.paymentModeNameInput, this.allUiElements.addPaymentModeBtn,
            this.allUiElements.expenseDate, this.allUiElements.expenseAmount,
            this.allUiElements.expenseGroupSelect, this.allUiElements.expenseCategorySelect,
            this.allUiElements.expensePayerSelect, this.allUiElements.expensePaymentModeSelect,
            this.allUiElements.expenseDescription, this.allUiElements.addExpenseBtn,
            this.allUiElements.csvImportFile, this.allUiElements.importCsvBtn,
            this.allUiElements.exportCsvBtn,
            this.allUiElements.exportStartDate, this.allUiElements.exportEndDate,
            this.allUiElements.exportAllTime,
            // Note: exportExpenseGroupCheckboxContainer children are handled separately if needed
        ];

        formElements.forEach(el => {
            if (el) {
                // Special handling for date inputs based on "All Time" checkbox for export
                if ((el === this.allUiElements.exportStartDate || el === this.allUiElements.exportEndDate) &&
                    this.allUiElements.exportAllTime && this.allUiElements.exportAllTime.checked && enabled) {
                    el.disabled = true; // Keep disabled if "All Time" is checked, even if overall UI is enabled
                } else {
                    el.disabled = !enabled;
                }
            }
        });

        // Handle checkboxes within the container separately
        if (this.allUiElements.exportExpenseGroupCheckboxContainer) {
             this.allUiElements.exportExpenseGroupCheckboxContainer.style.opacity = enabled ? '1' : '0.5';
             this.allUiElements.exportExpenseGroupCheckboxContainer.style.pointerEvents = enabled ? 'auto' : 'none';
            const checkboxes = this.allUiElements.exportExpenseGroupCheckboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.disabled = !enabled);
        }
         if (this.allUiElements.analyticsFiltersContainer) {
            this.allUiElements.analyticsFiltersContainer.style.opacity = enabled ? '1' : '0.5';
            this.allUiElements.analyticsFiltersContainer.style.pointerEvents = enabled ? 'auto' : 'none';
            const filterInputs = this.allUiElements.analyticsFiltersContainer.querySelectorAll('input, select, button');
            filterInputs.forEach(input => input.disabled = !enabled);
        }
    }

    _setTabContentsVisualState(enabled) {
        if (this.allUiElements.tabContents) {
            this.allUiElements.tabContents.forEach(content => {
                content.style.opacity = enabled ? '1' : '0.5';
                content.style.pointerEvents = enabled ? 'auto' : 'none';
            });
        }
    }


    _setMainUIEnabled(enabled) {
        this._setTabButtonsEnabled(enabled);
        this._setFormElementsEnabled(enabled);
        this._setTabContentsVisualState(enabled);
        // Placeholders are now handled by individual managers calling their displayDisconnectedState methods
    }
}

// No explicit export statement needed here as the class is exported directly
