// server.js (root)
const express = require('express');
const path = require('path');
const getDatabaseManager = require('./src/models/database'); // Adjusted path
const ExpenseManagerServerController = require('./src/controllers/server/main-controller'); // Adjusted path

async function main() {
    const dbManager = getDatabaseManager(); // Create a DatabaseManager instance
    const PORT = 3000;

    const app = express();

    // Middleware setup (from original _setupMiddleware)
    const bodyParser = require('body-parser'); // bodyParser needs to be required here
    app.use(bodyParser.json());
    // Serve static files - adjust path according to where index.html and client JS will be served
    // For now, assuming 'public' might still be used for bundled assets, or 'src/views' if serving directly
    app.use(express.static(path.join(__dirname, 'public'))); 
    // If index.html is in src/views, and JS is in src/views/js, you might need multiple static paths
    // or adjust where these files are ultimately placed/served from.
    // A common pattern is to have a build step output to 'public' or 'dist'.
    // For now, this line is kept similar to original, but might need review in step 6.

    // Initialize and use routes from the controller
    const controller = new ExpenseManagerServerController(dbManager, app); // Pass app instance
    // The controller's constructor will call _setupRoutes

    try {
        await dbManager.initialize(); // Initialize the database
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to start server due to database error:', err);
        process.exit(1);
    }
}

main();
