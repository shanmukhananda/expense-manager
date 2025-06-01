// src/models/database.js

const { Pool } = require('pg'); // Changed from sqlite3 to pg
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    /**
     * @param {string} connectionString - The PostgreSQL connection string.
     * @param {string} schemaPath - The path to the SQL schema file.
     */
    constructor(connectionString, schemaPath) {
        if (!connectionString) {
            throw new Error('Database connection string is required.');
        }
        this.connectionString = connectionString;
        this.schemaPath = schemaPath;
        this.pool = null; // pg Pool instance
    }

    /**
     * Initializes the PostgreSQL database using pg.Pool.
     * It attempts to connect and then applies the schema.
     * @returns {Promise<void>} A promise that resolves when the database is ready.
     */
    async initialize() {
        this.pool = new Pool({ connectionString: this.connectionString });

        try {
            // Test the connection
            const client = await this.pool.connect();
            console.log(`Connected to the PostgreSQL database.`);
            client.release(); // Release client back to pool

            // Apply schema
            await this._applySchema();
            console.log('Database initialization completed successfully.');
        } catch (err) {
            console.error('Error initializing PostgreSQL database:', err.message);
            // If pool was created, try to close it
            if (this.pool) {
                await this.pool.end().catch(poolErr => console.error('Error closing pool during initialization failure:', poolErr));
            }
            this.pool = null; // Ensure pool is null on failure
            throw err; // Re-throw the error to indicate initialization failure
        }
    }

    /**
     * Applies the schema from the SQL file to the database.
     * @private
     * @returns {Promise<void>} A promise that resolves when the schema is applied.
     */
    async _applySchema() {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        const schema = fs.readFileSync(this.schemaPath, 'utf8');
        const client = await this.pool.connect();
        try {
            await client.query(schema);
            console.log('Schema applied successfully.');
        } catch (err) {
            console.error('Error applying schema:', err.message);
            throw err; // Re-throw to be caught by the caller (initialize)
        } finally {
            client.release();
        }
    }

    /**
     * Executes a database query (SELECT) and returns all results.
     * @param {string} sql - SQL query string.
     * @param {Array<any>} params - Parameters for the SQL query.
     * @returns {Promise<Array<Object>>} Promise resolving to query results.
     */
    async runQuery(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        // Replace ? with $1, $2, etc. for pg
        const pgSql = sql.replace(/\?/g, (match, index, original) => {
            let i = 0;
            for (let j = 0; j < original.length && j < index; j++) {
                if (original[j] === '?') i++;
            }
            return `$${i + 1}`;
        });
        try {
            const result = await this.pool.query(pgSql, params);
            return result.rows;
        } catch (err) {
            console.error('Error running query:', err.message, 'SQL:', pgSql, 'Params:', params);
            throw err;
        }
    }

    /**
     * Executes a database command (INSERT, UPDATE, DELETE).
     * @param {string} sql - SQL command string.
     * @param {Array<any>} params - Parameters for the SQL command.
     * @returns {Promise<{id?: number, changes: number}>} Promise resolving to lastID for inserts or changes for update/delete.
     */
    async runCommand(sql, params = []) {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        // Replace ? with $1, $2, etc. for pg
        let paramIndex = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

        // Append 'RETURNING id' to INSERT queries if not already present
        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
            finalSql += ' RETURNING id';
        }

        try {
            const result = await this.pool.query(finalSql, params);
            // For INSERT, result.rows[0].id will have the id if RETURNING id was used.
            // For UPDATE/DELETE, result.rowCount provides the number of affected rows.
            return {
                id: result.rows && result.rows.length > 0 ? result.rows[0].id : undefined,
                changes: result.rowCount
            };
        } catch (err) {
            console.error('Error running command:', err.message, 'SQL:', finalSql, 'Params:', params);
            throw err;
        }
    }

    /**
     * Closes the database connection.
     * @returns {Promise<void>}
     */
    async close() {
        if (this.pool) {
            try {
                await this.pool.end();
                console.log('Database pool closed.');
                this.pool = null;
            } catch (err) {
                console.error('Error closing database pool:', err.message);
                throw err;
            }
        }
    }
}

module.exports = DatabaseManager;
