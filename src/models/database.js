
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    /**
     * @param {string | null} connectionString - The PostgreSQL connection string. Can be null initially.
     * @param {string} schemaPath - The path to the SQL schema file.
     */
    constructor(connectionString = null, schemaPath) {
        this.connectionString = connectionString;
        this.schemaPath = schemaPath;
        this.pool = null;
    }

    /**
     * Initializes the PostgreSQL database using pg.Pool.
     * It attempts to connect and then applies the schema.
     * Can accept a new connectionString to re-initialize.
     * @param {string | null} newConnectionString - Optional new connection string.
     * @returns {Promise<void>} A promise that resolves when the database is ready.
     */
    async initialize(newConnectionString = null) {
        if (newConnectionString) {
            if (this.pool) {
                await this.close();
            }
            this.connectionString = newConnectionString;
        }

        if (!this.connectionString) {
            throw new Error('Database connection string not available. Cannot initialize.');
        }

        this.pool = new Pool({ connectionString: this.connectionString });

        try {
            const client = await this.pool.connect();
            console.log(`Connected to the PostgreSQL database.`);
            client.release();

            await this._applySchema();
            console.log('Database initialization completed successfully.');
        } catch (err) {
            console.error('Error initializing PostgreSQL database:', err.message);
            if (this.pool) {
                await this.pool.end().catch(poolErr => console.error('Error closing pool during initialization failure:', poolErr));
            }
            this.pool = null;
            throw err;
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
            throw err;
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
        let paramIndex = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

        let finalSql = pgSql;
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
            finalSql += ' RETURNING id';
        }

        try {
            const result = await this.pool.query(finalSql, params);
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
            } catch (err) {
                console.error('Error closing database pool:', err.message);
                this.pool = null;
                throw err;
            }
            this.pool = null;
        }
    }
}

module.exports = DatabaseManager;
