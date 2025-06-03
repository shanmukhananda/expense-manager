import { UIManager } from './ui';
import '@testing-library/jest-dom';

describe('UIManager', () => {
    let uiManager;
    let mockDOM;

    beforeEach(() => {
        // Set up a basic HTML structure for each test
        mockDOM = document.createElement('div');
        document.body.appendChild(mockDOM);

        mockDOM.innerHTML = `
            <input type="text" id="db-connection-string" />
            <button id="db-connect-toggle"></button>
            <div id="db-connection-status-message-container"></div>
            {/* Container for status message, UIManager will create <p> inside it or near input */}

            <button id="tab-groups" class="tab-button"></button>
            <button id="tab-categories" class="tab-button"></button>
            <button class="tab-button"></button> {/* Mock other tab buttons for querySelectorAll */}

            <div id="content-groups" class="tab-content"></div>
            <div id="content-categories" class="tab-content"></div>
            <div class="tab-content"></div> {/* Mock other tab contents */}


            <input type="text" id="group-name-input" />
            <button id="add-group-btn"></button>
            <input type="text" id="category-name-input" />
            <button id="add-category-btn"></button>
            <input type="text" id="payer-name-input" />
            <button id="add-payer-btn"></button>
            <input type="text" id="payment-mode-name-input" />
            <button id="add-payment-mode-btn"></button>

            <input type="date" id="expense-date"/>
            <input type="number" id="expense-amount"/>
            <select id="expense-group-select"></select>
            <select id="expense-category-select"></select>
            <select id="expense-payer-select"></select>
            <select id="expense-payment-mode-select"></select>
            <textarea id="expense-description"></textarea>
            <button id="add-expense-btn"></button>

            {/* Minimal Modal Structures */}
            <div id="rename-modal">
                <input type="text" id="rename-input" />
                <button id="rename-save-btn"></button>
                <button id="rename-cancel-btn"></button>
            </div>
            <div id="delete-modal">
                <button id="delete-confirm-btn"></button>
                <button id="delete-cancel-btn"></button>
            </div>
            <div id="info-modal">
                <button id="info-modal-ok-btn"></button>
            </div>
            <div id="edit-expense-modal">
                <input type="hidden" id="edit-expense-id" />
                <input type="date" id="edit-expense-date" />
                <input type="number" id="edit-expense-amount" />
                <select id="edit-expense-group-select"></select>
                <select id="edit-expense-category-select"></select>
                <select id="edit-expense-payer-select"></select>
                <select id="edit-expense-payment-mode-select"></select>
                <textarea id="edit-expense-description"></textarea>
                <button id="edit-expense-save-btn"></button>
                <button id="edit-expense-cancel-btn"></button>
            </div>
             <div id="groups-list"></div>
             <div id="categories-list"></div>
             <div id="payers-list"></div>
             <div id="payment-modes-list"></div>
             <div id="expenses-list"></div>
             <div id="analytics-filters-container"></div>
             <div id="analytics-results-container"></div>
             <div id="content-analytics"></div> {/* Added from UIManager cache list */}
        `;

        // Initialize UIManager after setting up the DOM
        uiManager = new UIManager();
        // Manually create the status message element because UIManager creates it dynamically
        // and we need a reference for some tests if it's not immediately created or if we want to test its absence/presence.
        // However, setConnectionStatus itself creates it, so we might not need this line if tests always call setConnectionStatus.
        // For now, let's assume setConnectionStatus handles its creation.
    });

    afterEach(() => {
        document.body.removeChild(mockDOM);
        mockDOM = null;
        jest.clearAllMocks();
    });

    test('constructor caches required DOM elements', () => {
        expect(uiManager.elements.dbConnectionString).toBeInTheDocument();
        expect(uiManager.elements.dbConnectToggle).toBeInTheDocument();
        expect(uiManager.elements.dbConnectionString).toBeInstanceOf(HTMLInputElement);
        expect(uiManager.elements.dbConnectToggle).toBeInstanceOf(HTMLButtonElement);
    });

    test('getDatabasePath returns the value of the connection string input', () => {
        const connectionStringInput = uiManager.elements.dbConnectionString;
        connectionStringInput.value = 'test_connection_string';
        expect(uiManager.getDatabasePath()).toBe('test_connection_string');
    });

    describe('setConnectionStatus', () => {
        test('sets UI to connected state', () => {
            // Spy on _setMainUIEnabled to check if it's called correctly
            const setMainUIEnabledSpy = jest.spyOn(uiManager, '_setMainUIEnabled');

            uiManager.setConnectionStatus(true, 'Connected successfully');

            expect(uiManager.elements.dbConnectToggle.textContent).toBe('Disconnect');
            expect(uiManager.elements.dbConnectToggle.classList.contains('bg-red-600')).toBe(true); // Example class for connected
            expect(uiManager.elements.dbConnectionString.disabled).toBe(true);

            const statusMessageElement = mockDOM.querySelector('p.text-green-600'); // UIManager adds a <p> tag
            expect(statusMessageElement).toBeInTheDocument();
            expect(statusMessageElement.textContent).toBe('Connected successfully');

            expect(setMainUIEnabledSpy).toHaveBeenCalledWith(true);
            setMainUIEnabledSpy.mockRestore();
        });

        test('sets UI to disconnected state', () => {
            // First set to connected to see changes
            uiManager.setConnectionStatus(true, 'Connected successfully');

            const setMainUIEnabledSpy = jest.spyOn(uiManager, '_setMainUIEnabled');
            uiManager.setConnectionStatus(false, 'Disconnected');

            expect(uiManager.elements.dbConnectToggle.textContent).toBe('Connect');
            // Example class for disconnected - ensure it's not the connected class and has the new one
            expect(uiManager.elements.dbConnectToggle.classList.contains('bg-red-600')).toBe(false);
            expect(uiManager.elements.dbConnectToggle.classList.contains('bg-blue-600')).toBe(true);
            expect(uiManager.elements.dbConnectionString.disabled).toBe(false);

            const statusMessageElement = mockDOM.querySelector('p.text-red-600'); // UIManager adds a <p> tag
            expect(statusMessageElement).toBeInTheDocument();
            expect(statusMessageElement.textContent).toBe('Disconnected');

            expect(setMainUIEnabledSpy).toHaveBeenCalledWith(false);
            setMainUIEnabledSpy.mockRestore();
        });

        test('updates connection message correctly', () => {
            uiManager.setConnectionStatus(false, 'Error message here');
            const statusMessageElement = mockDOM.querySelector('p.text-red-600');
            expect(statusMessageElement).toBeInTheDocument();
            expect(statusMessageElement.textContent).toBe('Error message here');
        });
    });

    test('onConnectToggle event listener is set up and calls callback', () => {
        uiManager.onConnectToggle = jest.fn(); // Mock the callback

        const connectButton = uiManager.elements.dbConnectToggle;
        connectButton.click();

        expect(uiManager.onConnectToggle).toHaveBeenCalledTimes(1);
    });

    // Basic test for _setMainUIEnabled (can be more thorough)
    describe('_setMainUIEnabled', () => {
        test('enables or disables main UI elements', () => {
            // Test enabling
            uiManager._setMainUIEnabled(true);
            expect(uiManager.elements.tabButtons[0].disabled).toBe(false);
            expect(uiManager.elements.groupNameInput.disabled).toBe(false);
            expect(uiManager.elements.addGroupBtn.disabled).toBe(false);
            uiManager.elements.tabContents.forEach(content => {
                expect(content.style.opacity).toBe('1');
                expect(content.style.pointerEvents).toBe('auto');
            });

            // Test disabling
            uiManager._setMainUIEnabled(false);
            expect(uiManager.elements.tabButtons[0].disabled).toBe(true);
            expect(uiManager.elements.groupNameInput.disabled).toBe(true);
            expect(uiManager.elements.addGroupBtn.disabled).toBe(true);
            uiManager.elements.tabContents.forEach(content => {
                expect(content.style.opacity).toBe('0.5');
                expect(content.style.pointerEvents).toBe('none');
            });
        });
    });
});
