const express = require('express');
const request = require('supertest');
const ExpenseManagerServerController = require('./main-controller');
const DatabaseManager = require('../models/database');

// Mock DatabaseManager
jest.mock('../models/database');

describe('ExpenseManagerServerController API Routes', () => {
    let app;
    let mockDbManagerInstance;

    beforeEach(() => {
        app = express();
        app.use(express.json()); // Ensure body-parser is used for POST requests

        // Create a new mock instance for each test
        // DatabaseManager constructor is called with (connectionString, schemaPath)
        // We pass null, null as server.js now passes null for connectionString initially
        mockDbManagerInstance = new DatabaseManager(null, null);

        // Ensure methods that will be called are mocked
        mockDbManagerInstance.initialize = jest.fn();
        mockDbManagerInstance.close = jest.fn();
        // 'pool' is accessed directly to check connection status, so we can mock it as a property
        // We'll control its value (null or an object) in specific tests.
        // Initially, let's say it's null (disconnected).
        mockDbManagerInstance.pool = null;

        // Mock repositories that would be created if dbManager was real
        // and their methods that might be called by guarded routes if pool is active.
        mockDbManagerInstance.getAll = jest.fn().mockResolvedValue([]); // For AuxDataRepository
        mockDbManagerInstance.add = jest.fn().mockResolvedValue({ id: 1, name: 'test' });
        mockDbManagerInstance.update = jest.fn().mockResolvedValue({ id: 1, name: 'updated' });
        mockDbManagerInstance.delete = jest.fn().mockResolvedValue();
        mockDbManagerInstance.getAllExpenses = jest.fn().mockResolvedValue([]); // For ExpenseRepository
        mockDbManagerInstance.addExpense = jest.fn().mockResolvedValue({ id: 1, amount: 100 });
        mockDbManagerInstance.updateExpense = jest.fn().mockResolvedValue({ id: 1, amount: 120 });
        mockDbManagerInstance.deleteExpense = jest.fn().mockResolvedValue();
        mockDbManagerInstance.getAnalyticsData = jest.fn().mockResolvedValue({});


        // Instantiate the controller with the mock DbManager and the test app
        new ExpenseManagerServerController(mockDbManagerInstance, app);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/db/status', () => {
        test('should return { connected: false } when dbManager.pool is null', async () => {
            mockDbManagerInstance.pool = null; // Explicitly set for clarity
            const response = await request(app).get('/api/db/status');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ connected: false });
        });

        test('should return { connected: true } when dbManager.pool is active (mocked)', async () => {
            mockDbManagerInstance.pool = { /* some mock pool object */ }; // Simulate active pool
            const response = await request(app).get('/api/db/status');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({ connected: true });
        });
    });

    describe('POST /api/db/connect', () => {
        test('should connect successfully with a valid connection string', async () => {
            mockDbManagerInstance.initialize.mockResolvedValueOnce(); // Simulate successful initialization

            const response = await request(app)
                .post('/api/db/connect')
                .send({ connectionString: 'valid_string' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true, message: 'Database connected successfully.' });
            expect(mockDbManagerInstance.initialize).toHaveBeenCalledWith('valid_string');
            expect(mockDbManagerInstance.close).not.toHaveBeenCalled(); // Assuming not initially connected
        });

        test('should attempt to close existing connection if pool was active', async () => {
            mockDbManagerInstance.pool = { /* mock active pool */ };
            mockDbManagerInstance.initialize.mockResolvedValueOnce();
            mockDbManagerInstance.close.mockResolvedValueOnce();

            const response = await request(app)
                .post('/api/db/connect')
                .send({ connectionString: 'new_valid_string' });

            expect(response.status).toBe(200);
            expect(mockDbManagerInstance.close).toHaveBeenCalledTimes(1);
            expect(mockDbManagerInstance.initialize).toHaveBeenCalledWith('new_valid_string');
        });

        test('should return 500 if dbManager.initialize fails', async () => {
            mockDbManagerInstance.initialize.mockRejectedValueOnce(new Error('Connection failed'));

            const response = await request(app)
                .post('/api/db/connect')
                .send({ connectionString: 'valid_string' });

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ success: false, message: 'Failed to connect to database.', error: 'Connection failed' });
        });

        test('should return 400 if connectionString is missing', async () => {
            const response = await request(app)
                .post('/api/db/connect')
                .send({}); // No connectionString

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ success: false, message: 'Connection string is required.' });
        });
    });

    describe('POST /api/db/disconnect', () => {
        test('should disconnect successfully if pool is active', async () => {
            mockDbManagerInstance.pool = { /* mock active pool */ };
            mockDbManagerInstance.close.mockResolvedValueOnce();

            const response = await request(app).post('/api/db/disconnect');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true, message: 'Database disconnected successfully.' });
            expect(mockDbManagerInstance.close).toHaveBeenCalledTimes(1);
        });

        test('should return success even if pool is already null (already disconnected)', async () => {
            mockDbManagerInstance.pool = null;

            const response = await request(app).post('/api/db/disconnect');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true, message: 'Database disconnected successfully.' });
            expect(mockDbManagerInstance.close).not.toHaveBeenCalled(); // Or called but does nothing if pool is null
        });

        test('should return 500 if dbManager.close fails', async () => {
            mockDbManagerInstance.pool = { /* mock active pool */ };
            mockDbManagerInstance.close.mockRejectedValueOnce(new Error('Close failed'));

            const response = await request(app).post('/api/db/disconnect');

            expect(response.status).toBe(500);
            expect(response.body).toEqual({ success: false, message: 'Failed to disconnect from database.', error: 'Close failed' });
        });
    });

    describe('Guarded Data Endpoints', () => {
        const guardedEndpoints = [
            { method: 'get', path: '/api/groups' },
            { method: 'post', path: '/api/groups', body: { name: 'Test' } },
            { method: 'put', path: '/api/groups/1', body: { name: 'Test' } },
            { method: 'delete', path: '/api/groups/1' },
            { method: 'get', path: '/api/expenses' },
            // Add more representative endpoints as needed
        ];

        guardedEndpoints.forEach(endpoint => {
            test(`${endpoint.method.toUpperCase()} ${endpoint.path} should return 503 if DB is not connected`, async () => {
                mockDbManagerInstance.pool = null; // Ensure DB is not connected

                let response;
                if (endpoint.method === 'get' || endpoint.method === 'delete') {
                    response = await request(app)[endpoint.method](endpoint.path);
                } else {
                    response = await request(app)[endpoint.method](endpoint.path).send(endpoint.body || {});
                }

                expect(response.status).toBe(503);
                expect(response.body).toEqual({ error: 'Database not connected. Please connect to the database first.' });
            });

            test(`${endpoint.method.toUpperCase()} ${endpoint.path} should attempt operation if DB is connected`, async () => {
                mockDbManagerInstance.pool = { /* mock active pool */ }; // Ensure DB is connected

                // Mock the specific repository method that would be called by this route handler
                // This is a simplified example; more specific mocking might be needed per route.
                if (endpoint.path.includes('/api/groups')) {
                    if (endpoint.method === 'get') mockDbManagerInstance.getAll.mockResolvedValueOnce([]);
                    else if (endpoint.method === 'post') mockDbManagerInstance.add.mockResolvedValueOnce({id:1, name: 'Test'});
                    // ... and so on for other methods and repositories
                } else if (endpoint.path.includes('/api/expenses') && endpoint.method === 'get') {
                     mockDbManagerInstance.getAllExpenses.mockResolvedValueOnce([]);
                }


                let response;
                if (endpoint.method === 'get' || endpoint.method === 'delete') {
                    response = await request(app)[endpoint.method](endpoint.path);
                } else {
                    response = await request(app)[endpoint.method](endpoint.path).send(endpoint.body || {});
                }

                // We expect a non-503 status.
                // For GET (empty data) or successful POST/PUT/DELETE, it's usually 200, 201, or 204.
                // If validation within the handler fails (e.g. missing 'name' for POST), it could be 400.
                expect(response.status).not.toBe(503);
                if (endpoint.method === 'get') expect(response.status).toBe(200); // Assuming successful GET
                // Add more specific status checks if needed based on the mock setup for each path
            });
        });
    });
});
