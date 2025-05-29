console.log('--- SERVER.JS HAS BEEN MODIFIED BY JULES - TESTING FILE UPDATES ---');
// server.js (root)
const express = require('express');
const path = require('path');
const getDatabaseManager = require('./src/models/database');
const ExpenseManagerServerController = require('./src/controllers/server/main-controller');

async function main() {
    const dbManager = getDatabaseManager();
    const PORT = 3000;

    const app = express();

    // Logging middleware - very first thing
    app.use((req, res, next) => {
        console.log('Incoming request:', req.method, req.path);
        next();
    });

    // Middleware setup BEFORE controller
    const bodyParser = require('body-parser'); 
    app.use(bodyParser.json());

    // Initialize and use routes from the controller
    // This ensures API routes are prioritized
    const controller = new ExpenseManagerServerController(dbManager, app); 

    // Static files and root route
    app.use(express.static(path.join(__dirname, 'src'))); 
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
