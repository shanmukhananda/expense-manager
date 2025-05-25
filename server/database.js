// server/database.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'expense_manager.db');
const SCHEMA_PATH = path.resolve(__dirname, '../schema.sql'); // Path to your schema.sql

/**
 * Initializes the SQLite database.
 * If the database file does not exist, it creates it and applies the schema.
 * @returns {Promise<sqlite3.Database>} A promise that resolves with the database instance.
 */
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const dbExists = fs.existsSync(DB_PATH);
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                console.error('Error connecting to database:', err.message);
                reject(err);
            } else {
                console.log(`Connected to the SQLite database: ${DB_PATH}`);
                if (!dbExists) {
                    console.log('Database file did not exist, creating tables from schema...');
                    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
                    db.exec(schema, (err) => {
                        if (err) {
                            console.error('Error applying schema:', err.message);
                            reject(err);
                        } else {
                            console.log('Schema applied successfully.');
                            resolve(db);
                        }
                    });
                } else {
                    console.log('Database file already exists.');
                    resolve(db);
                }
            }
        });
    });
}

module.exports = { initializeDatabase };
