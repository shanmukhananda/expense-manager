// TabView.js
class TabView {
    /**
     * Manages tab switching behavior.
     * @param {Object} elements - Object containing DOM elements for tabs.
     * @param {NodeListOf<Element>} elements.tabButtons - The tab buttons.
     * @param {NodeListOf<Element>} elements.tabContents - The tab content panes.
     * @param {function(string): void} onTabChangeCallback - Callback executed when a tab is changed.
     */
    constructor(elements, onTabChangeCallback) {
        this.elements = elements;
        this.onTabChangeCallback = onTabChangeCallback;
        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.currentTarget.id;
                this.activateTab(tabId);
                if (this.onTabChangeCallback) {
                    this.onTabChangeCallback(tabId); // Notify UIManager or AppController
                }
            });
        });
    }

    /**
     * Activates a specific tab and hides others.
     * @param {string} tabId - The ID of the tab to activate (e.g., 'tab-groups').
     */
    activateTab(tabId) {
        this.elements.tabButtons.forEach(button => {
            const isActive = button.id === tabId;
            button.classList.toggle('bg-blue-600', isActive);
            button.classList.toggle('hover:bg-blue-700', isActive); // Maintained for active state
            button.classList.toggle('text-white', isActive);
            button.classList.toggle('bg-gray-200', !isActive);
            button.classList.toggle('hover:bg-gray-300', !isActive); // Maintained for inactive state
            button.classList.toggle('text-gray-800', !isActive);
            button.classList.toggle('focus:ring-blue-500', isActive);
            button.classList.toggle('focus:ring-gray-400', !isActive);
        });

        this.elements.tabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `content-${tabId.replace('tab-', '')}`);
        });
    }
}

module.exports = TabView;
