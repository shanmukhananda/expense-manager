// server.js (root)
const express = require('express');
const path = require('path');
const readline = require('readline');
const DatabaseManager = require('./src/models/database');
const ExpenseManagerServerController = require('./src/controllers/main-controller');

async function main() {
    const SCHEMA_PATH = path.resolve(__dirname, 'src', 'models', 'schema.sql');
    // Initialize DatabaseManager with null connection string
    const dbManager = new DatabaseManager(null, SCHEMA_PATH);
    const PORT = 3000;

    const app = express();

    // Logging middleware - very first thing
    app.use((req, res, next) => {
        console.log('Incoming request:', req.method, req.path);
        next();
    });

    // Then Middleware setup
    const bodyParser = require('body-parser'); 
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(express.static(path.join(__dirname, 'src'))); 

    // Initialize and use routes from the controller FIRST
    // This ensures API routes are prioritized
    const controller = new ExpenseManagerServerController(dbManager, app); 
    // Then Serve index.html for the root path
    app.get('/', (req, res) => {
        console.log('Serving index.html for /'); // Added for debugging
        res.sendFile(path.join(__dirname, 'src', 'views', 'index.html'));
    });

    // Server starts without immediate DB initialization
    // DB initialization will be triggered by an API call
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Database will be initialized and connected via API endpoints.');
    });
}

main();
