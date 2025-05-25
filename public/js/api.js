// public/js/api.js

/**
 * ApiService class to handle all API interactions with the backend.
 * Uses Fetch API to make requests to the Node.js server.
 */
export class ApiService { // Added 'export' keyword here
    constructor() {
        this.baseUrl = '/api'; // Base URL for API endpoints
    }

    /**
     * Generic method for making GET requests.
     * @param {string} endpoint - The API endpoint (e.g., '/groups').
     * @returns {Promise<Array<Object>>} Promise resolving to data from the API.
     * @throws {Error} If the network request fails or the server returns an error.
     */
    async get(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Generic method for making POST requests.
     * @param {string} endpoint - The API endpoint.
     * @param {Object} data - The data to send in the request body.
     * @returns {Promise<Object>} Promise resolving to the created resource.
     * @throws {Error} If the network request fails or the server returns an error.
     */
    async post(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error posting to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Generic method for making PUT requests.
     * @param {string} endpoint - The API endpoint (e.g., '/groups/1').
     * @param {Object} data - The data to send in the request body.
     * @returns {Promise<Object>} Promise resolving to the updated resource.
     * @throws {Error} If the network request fails or the server returns an error.
     */
    async put(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error putting to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Generic method for making DELETE requests.
     * @param {string} endpoint - The API endpoint (e.g., '/groups/1').
     * @returns {Promise<void>} Promise that resolves on successful deletion.
     * @throws {Error} If the network request fails or the server returns an error.
     */
    async delete(endpoint) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }
            // No content expected for 204 No Content
        } catch (error) {
            console.error(`Error deleting from ${endpoint}:`, error);
            throw error;
        }
    }

    // Specific API methods for each entity

    async initDb() {
        return this.get('/init-db');
    }

    async getGroups() {
        return this.get('/groups');
    }

    async addGroup(name) {
        return this.post('/groups', { name });
    }

    async updateGroup(id, name) {
        return this.put(`/groups/${id}`, { name });
    }

    async deleteGroup(id) {
        return this.delete(`/groups/${id}`);
    }

    async getCategories() {
        return this.get('/categories');
    }

    async addCategory(name) {
        return this.post('/categories', { name });
    }

    async updateCategory(id, name) {
        return this.put(`/categories/${id}`, { name });
    }

    async deleteCategory(id) {
        return this.delete(`/categories/${id}`);
    }

    async getPayers() {
        return this.get('/payers');
    }

    async addPayer(name) {
        return this.post('/payers', { name });
    }

    async updatePayer(id, name) {
        return this.put(`/payers/${id}`, { name });
    }

    async deletePayer(id) {
        return this.delete(`/payers/${id}`);
    }

    async getPaymentModes() {
        return this.get('/payment-modes');
    }

    async addPaymentMode(name) {
        return this.post('/payment-modes', { name });
    }

    async updatePaymentMode(id, name) {
        return this.put(`/payment-modes/${id}`, { name });
    }

    async deletePaymentMode(id) {
        return this.delete(`/payment-modes/${id}`);
    }

    async getExpenses() {
        return this.get('/expenses');
    }

    async addExpense(expenseData) {
        return this.post('/expenses', expenseData);
    }

    async deleteExpense(id) {
        return this.delete(`/expenses/${id}`);
    }
}
