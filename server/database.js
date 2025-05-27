// server/database.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    /**
     * @param {string} dbPath - The path to the SQLite database file.
     * @param {string} schemaPath - The path to the SQL schema file.
     */
    constructor(dbPath, schemaPath) {
        this.dbPath = dbPath;
        this.schemaPath = schemaPath;
        this.db = null; // SQLite database instance
    }

    /**
     * Initializes the SQLite database.
     * If the database file does not exist, it creates it and applies the schema.
     * @returns {Promise<void>} A promise that resolves when the database is ready.
     */
    async initialize() {
        const dbExists = fs.existsSync(this.dbPath);
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error connecting to database:', err.message);
                    return reject(err);
                }
                console.log(`Connected to the SQLite database: ${this.dbPath}`);
                if (!dbExists) {
                    this._applySchema().then(resolve).catch(reject);
                } else {
                    console.log('Database file already exists.');
                    resolve();
                }
            });
        });
    }

    /**
     * Applies the schema from the SQL file to the database.
     * @private
     * @returns {Promise<void>} A promise that resolves when the schema is applied.
     */
    _applySchema() {
        return new Promise((resolve, reject) => {
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            this.db.exec(schema, (err) => {
                if (err) {
                    console.error('Error applying schema:', err.message);
                    return reject(err);
                }
                console.log('Schema applied successfully.');
                resolve();
            });
        });
    }

    /**
     * Executes a database query (SELECT) and returns all results.
     * @param {string} sql - SQL query string.
     * @param {Array<any>} params - Parameters for the SQL query.
     * @returns {Promise<Array<Object>>} Promise resolving to query results.
     */
    runQuery(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not initialized. Call initialize() first.'));
            }
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }

    /**
     * Executes a database command (INSERT, UPDATE, DELETE).
     * @param {string} sql - SQL command string.
     * @param {Array<any>} params - Parameters for the SQL command.
     * @returns {Promise<{id?: number, changes: number}>} Promise resolving to lastID for inserts or changes for update/delete.
     */
    runCommand(sql, params = []) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return reject(new Error('Database not initialized. Call initialize() first.'));
            }
            this.db.run(sql, params, function(err) {
                if (err) {
                    return reject(err);
                }
                resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Closes the database connection.
     * @returns {Promise<void>}
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err.message);
                        return reject(err);
                    }
                    console.log('Database connection closed.');
                    this.db = null;
                    resolve();
                });
            } else {
                resolve(); // Already closed or not initialized
            }
        });
    }
}

/**
 * Creates and returns a new instance of the DatabaseManager.
 * @returns {DatabaseManager} A new DatabaseManager instance.
 */
function getDatabaseManager() {
    const DB_PATH = path.resolve(__dirname, '../expense-manager.db');
    const SCHEMA_PATH = path.resolve(__dirname, '../schema.sql');
    return new DatabaseManager(DB_PATH, SCHEMA_PATH);
}

module.exports = getDatabaseManager;
