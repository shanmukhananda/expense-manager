// EntityListView.js
export class EntityListView {
    /**
     * Manages UI for entities (Groups, Categories, Payers, Payment Modes).
     * @param {Object} elements - DOM elements for entity management.
     *                             e.g., { groupList, categoryList, payerList, paymentModesList,
     *                                     groupNameInput, addGroupBtn, categoryNameInput, addCategoryBtn, ... }
     * @param {ModalManager} modalManager - Instance of ModalManager for showing modals.
     * @param {Object} callbacks - Callbacks for entity actions.
     *                             e.g., { onAddGroup: async (name) => {}, onRenameGroup: async (id, newName) => {}, ... }
     */
    constructor(elements, modalManager, callbacks) {
        this.elements = elements; // Specific elements for each entity type will be passed here
        this.modalManager = modalManager;
        this.callbacks = callbacks; // e.g., { onAddGroup, onRenameGroup, onDeleteGroup, ... per entity }
        this._setupEventListeners();
    }

    _setupEventListeners() {
        // Setup listeners for 'add' buttons for each entity type
        // Example for Groups:
        if (this.elements.addGroupBtn && this.elements.groupNameInput && this.callbacks.onAddGroup) {
            this.elements.addGroupBtn.addEventListener('click', async () => {
                await this._handleAddEntity('group', this.elements.groupNameInput, this.callbacks.onAddGroup);
            });
        }
        // Example for Categories:
        if (this.elements.addCategoryBtn && this.elements.categoryNameInput && this.callbacks.onAddCategory) {
            this.elements.addCategoryBtn.addEventListener('click', async () => {
                await this._handleAddEntity('category', this.elements.categoryNameInput, this.callbacks.onAddCategory);
            });
        }
        // Example for Payers:
        if (this.elements.addPayerBtn && this.elements.payerNameInput && this.callbacks.onAddPayer) {
            this.elements.addPayerBtn.addEventListener('click', async () => {
                await this._handleAddEntity('payer', this.elements.payerNameInput, this.callbacks.onAddPayer);
            });
        }
        // Example for Payment Modes:
        if (this.elements.addPaymentModeBtn && this.elements.paymentModeNameInput && this.callbacks.onAddPaymentMode) {
            this.elements.addPaymentModeBtn.addEventListener('click', async () => {
                await this._handleAddEntity('payment mode', this.elements.paymentModeNameInput, this.callbacks.onAddPaymentMode);
            });
        }
    }

    async _handleAddEntity(entityTypeName, inputElement, addCallback) {
        const name = inputElement.value.trim();
        if (name) {
            try {
                await addCallback(name);
                inputElement.value = ''; // Clear input on success
            } catch (error) {
                console.error(`Error adding ${entityTypeName}:`, error);
                this.modalManager.showInfoModal('Error', `Failed to add ${entityTypeName}. ${error.message}`);
            }
        } else {
            this.modalManager.showInfoModal('Input Required', `Please enter a ${entityTypeName} name.`);
        }
    }

    /**
     * Renders a list of entities into a specified container.
     * @param {Array<Object>} entityArray - The array of entities to render.
     * @param {HTMLElement} containerElement - The DOM element to render into.
     * @param {string} entityTypeName - User-friendly name for the entity type.
     * @param {function(number, string): Promise<void>} onRename - Callback for rename action.
     * @param {function(number): Promise<void>} onDelete - Callback for delete action.
     */
    renderEntityList(entityArray, containerElement, entityTypeName, onRename, onDelete) {
        containerElement.innerHTML = ''; // Clear previous content
        if (!entityArray || entityArray.length === 0) {
            containerElement.innerHTML = `<p class="text-gray-500 text-center py-4">No ${entityTypeName}s added yet. Connect to a database and add some.</p>`;
            return;
        }
        entityArray.forEach(item => {
            const itemDiv = this._createEntityListItem(item, entityTypeName);
            this._addEntityListItemListeners(itemDiv, item, entityTypeName, onRename, onDelete);
            containerElement.appendChild(itemDiv);
        });
    }

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

    _addEntityListItemListeners(itemDiv, item, entityTypeName, onRename, onDelete) {
        itemDiv.querySelector('.edit-btn').addEventListener('click', () => {
            this.modalManager.showRenameModal(`Rename ${entityTypeName}`, item.name, async (newName) => {
                if (newName && newName !== item.name) {
                    try {
                        await onRename(item.id, newName);
                    } catch (error) {
                        console.error(`Error renaming ${entityTypeName}:`, error);
                        this.modalManager.showInfoModal('Error', `Failed to rename ${entityTypeName}. ${error.message}`);
                    }
                }
            });
        });
        itemDiv.querySelector('.delete-btn').addEventListener('click', () => {
            this.modalManager.showDeleteModal(`Delete ${entityTypeName}`, `Are you sure you want to delete "${item.name}"? This action cannot be undone.`, async () => {
                try {
                    await onDelete(item.id);
                } catch (error) {
                    console.error(`Error deleting ${entityTypeName}:`, error);
                    this.modalManager.showInfoModal('Error', `Failed to delete ${entityTypeName}. It might be in use by an expense. ${error.message}`);
                }
            });
        });
    }

    // Placeholder for specific render methods if needed, e.g., called by UIManager
    renderGroups(groups) {
        this.renderEntityList(groups, this.elements.groupsList, 'Group', this.callbacks.onRenameGroup, this.callbacks.onDeleteGroup);
    }

    renderCategories(categories) {
        this.renderEntityList(categories, this.elements.categoriesList, 'Category', this.callbacks.onRenameCategory, this.callbacks.onDeleteCategory);
    }

    renderPayers(payers) {
        this.renderEntityList(payers, this.elements.payersList, 'Payer', this.callbacks.onRenamePayer, this.callbacks.onDeletePayer);
    }

    renderPaymentModes(paymentModes) {
        this.renderEntityList(paymentModes, this.elements.paymentModesList, 'Payment Mode', this.callbacks.onRenamePaymentMode, this.callbacks.onDeletePaymentMode);
    }

    // Method to update placeholders when DB is disconnected
    displayDisconnectedState() {
        const placeholderText = "Connect to a database to manage entities.";
        if (this.elements.groupsList) this.elements.groupsList.innerHTML = `<p class="text-gray-500 text-center py-4">${placeholderText}</p>`;
        if (this.elements.categoriesList) this.elements.categoriesList.innerHTML = `<p class="text-gray-500 text-center py-4">${placeholderText}</p>`;
        if (this.elements.payersList) this.elements.payersList.innerHTML = `<p class="text-gray-500 text-center py-4">${placeholderText}</p>`;
        if (this.elements.paymentModesList) this.elements.paymentModesList.innerHTML = `<p class="text-gray-500 text-center py-4">${placeholderText}</p>`;
    }
}

// No explicit export statement needed here as the class is exported directly
