// CsvView.js
export class CsvView {
    /**
     * Manages UI for CSV import and export.
     * @param {Object} elements - DOM elements for CSV operations.
     *                             e.g., { csvImportFile, importCsvBtn, exportCsvBtn, importExportStatus,
     *                                     exportStartDate, exportEndDate, exportAllTime, exportExpenseGroupCheckboxContainer }
     * @param {Object} callbacks - Callbacks for CSV actions.
     *                             e.g., { onImportCsv: async (file) => {}, onExportCsv: async (filters) => {} }
     * @param {function(string, boolean, boolean):void} displayStatusCallback - Function to display status messages.
     */
    constructor(elements, callbacks, displayStatusCallback) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.displayImportExportStatus = displayStatusCallback || this._defaultDisplayStatus;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        if (this.elements.importCsvBtn) {
            this.elements.importCsvBtn.addEventListener('click', async () => {
                const file = this.getImportFile();
                if (file) {
                    if (this.callbacks.onImportCsv) {
                        try {
                            await this.callbacks.onImportCsv(file);
                            // Status success/failure should be handled by AppController via displayImportExportStatus
                        } catch (error) {
                            console.error("Error during CSV import process:", error);
                            this.displayImportExportStatus(`Import error: ${error.message}`, true);
                        }
                    }
                } else {
                    this.displayImportExportStatus('Please select a CSV file first.', true);
                }
            });
        }

        if (this.elements.exportCsvBtn) {
            this.elements.exportCsvBtn.addEventListener('click', async () => {
                if (this.callbacks.onExportCsv) {
                    const filters = this.getExportFilters();
                    try {
                        await this.callbacks.onExportCsv(filters);
                        // Status success/failure should be handled by AppController via displayImportExportStatus
                    } catch (error) {
                        console.error("Error during CSV export process:", error);
                        this.displayImportExportStatus(`Export error: ${error.message}`, true);
                    }
                }
            });
        }

        if (this.elements.exportAllTime && this.elements.exportStartDate && this.elements.exportEndDate) {
            this.elements.exportAllTime.addEventListener('change', () => {
                this._toggleDateInputsDisabled();
            });
            this._toggleDateInputsDisabled(); // Initial state
        }
    }

    _toggleDateInputsDisabled() {
        const isChecked = this.elements.exportAllTime.checked;
        this.elements.exportStartDate.disabled = isChecked;
        this.elements.exportEndDate.disabled = isChecked;
        if (isChecked) {
            this.elements.exportStartDate.value = '';
            this.elements.exportEndDate.value = '';
        }
    }

    _defaultDisplayStatus(message, isError = false, isSuccess = false) {
        // This is a fallback, ideally UIManager provides its own status display logic
        console.log(`[CSV Status] ${message} (Error: ${isError}, Success: ${isSuccess})`);
        if (this.elements.importExportStatus) {
            this.elements.importExportStatus.textContent = message;
            this.elements.importExportStatus.classList.remove('text-red-600', 'text-green-600', 'text-gray-700');
            if (isError) this.elements.importExportStatus.classList.add('text-red-600');
            else if (isSuccess) this.elements.importExportStatus.classList.add('text-green-600');
            else this.elements.importExportStatus.classList.add('text-gray-700');
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
            this.displayImportExportStatus(`Successfully prepared '${filename}' for download.`, false, true);
        } else {
            this.displayImportExportStatus('CSV download failed: Browser does not support this feature.', true);
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
            filters.expenseGroupIds = Array.from(checkedCheckboxes).map(cb => parseInt(cb.value));
        }

        if (filters.allTime) {
            filters.startDate = '';
            filters.endDate = '';
        }
        return filters;
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
     * Populates the export-specific expense group checkbox container.
     * @param {Array<Object>} groups - Array of group objects.
     */
    populateExpenseGroupCheckboxesForExport(groups) {
        const container = this.elements.exportExpenseGroupCheckboxContainer;
        if (!container) return;

        container.innerHTML = ''; // Clear previous checkboxes

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
            container.innerHTML = '<p class="text-gray-500 text-sm">No groups available to filter by.</p>';
        }
    }

    // Method to update status message when DB is disconnected
    displayDisconnectedState(message = "Connect to database to use Import/Export features.") {
        this.displayImportExportStatus(message, false, false);
         if (this.elements.exportExpenseGroupCheckboxContainer) {
            this.elements.exportExpenseGroupCheckboxContainer.innerHTML = '<p class="text-gray-500 text-sm">Connect to database to see group filters.</p>';
        }
    }
}

// No explicit export statement needed here as the class is exported directly
