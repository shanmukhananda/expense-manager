// src/services/api-service.js

/**
 * ApiService class to handle all API interactions with the backend.
 * Uses Fetch API to make requests to the Node.js server.
 */
export class ApiService {
    // --- Database Connection Methods ---
    async connectDB(connectionString) {
        return this.post('/db/connect', { connectionString });
    }

    async disconnectDB() {
        return this.post('/db/disconnect', {});
    }

    async getDBStatus() {
        return this.get('/db/status');
    }

    constructor() {
        // Ensure this matches your server's port
        this.baseUrl = 'http://localhost:3000/api';
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

    /**
     * Updates an existing expense.
     * @param {number} id - The ID of the expense to update.
     * @param {Object} expenseData - The updated expense data.
     * @returns {Promise<Object>} Promise resolving to the updated expense.
     */
    async updateExpense(id, expenseData) {
        return this.put(`/expenses/${id}`, expenseData);
    }

    async deleteExpense(id) {
        return this.delete(`/expenses/${id}`);
    }

    async getAnalytics(filters = {}) {
        const queryParams = new URLSearchParams();
        if (filters.startDate) {
            queryParams.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
            queryParams.append('endDate', filters.endDate);
        }
        if (filters.categoryIds && Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
            queryParams.append('categoryIds', filters.categoryIds.join(','));
        }
        if (filters.paymentModeIds && Array.isArray(filters.paymentModeIds) && filters.paymentModeIds.length > 0) {
            queryParams.append('paymentModeIds', filters.paymentModeIds.join(','));
        }
        if (filters.groupIds && Array.isArray(filters.groupIds) && filters.groupIds.length > 0) {
            queryParams.append('groupIds', filters.groupIds.join(','));
        }
        if (filters.payerIds && Array.isArray(filters.payerIds) && filters.payerIds.length > 0) {
            queryParams.append('payerIds', filters.payerIds.join(','));
        }
        const queryString = queryParams.toString();
        return this.get(`/expenses/analytics${queryString ? '?' + queryString : ''}`);
    }
}