// server.js (root)
const express = require('express');
const path = require('path');
const readline = require('readline');
const DatabaseManager = require('./src/models/database');
const ExpenseManagerServerController = require('./src/controllers/main-controller');

// Function to prompt user for database connection details
async function promptForDbDetails() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Please enter your PostgreSQL connection string: ', (connectionString) => {
            rl.close();
            resolve(connectionString);
        });
    });
}

async function main() {
    const connectionString = await promptForDbDetails();

    if (!connectionString || connectionString.trim() === '') {
        console.error('PostgreSQL connection string is required. Exiting.');
        process.exit(1);
    }

    const SCHEMA_PATH = path.resolve(__dirname, 'src', 'models', 'schema.sql');
    const dbManager = new DatabaseManager(connectionString, SCHEMA_PATH);
    const PORT = 3000;

    const app = express();

    // Logging middleware - very first thing
    app.use((req, res, next) => {
        console.log('Incoming request:', req.method, req.path);
        next();
    });

    // Then Middleware setup
    const bodyParser = require('body-parser'); 
    app.use(bodyParser.json());
    app.use(express.static(path.join(__dirname, 'src'))); 

    // Initialize and use routes from the controller FIRST
    // This ensures API routes are prioritized
    const controller = new ExpenseManagerServerController(dbManager, app); 
    // Then Serve index.html for the root path
    app.get('/', (req, res) => {
        console.log('Serving index.html for /'); // Added for debugging
        res.sendFile(path.join(__dirname, 'src', 'views', 'index.html'));
    });

    try {
        await dbManager.initialize(); 
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`); 
        });
    } catch (err) {
        console.error('Failed to start server:', err); 
        process.exit(1);
    }
}

main();
