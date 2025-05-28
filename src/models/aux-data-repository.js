// server/repositories/aux-data-repository.js
class AuxDataRepository {
    constructor(dbManager, tableName, fkColumnName = null) {
        this.dbManager = dbManager;
        this.tableName = tableName;
        this.fkColumnName = fkColumnName; // Foreign key column name if this entity can be referenced by expenses
    }

    /**
     * Fetches all records from the table.
     * @returns {Promise<Array<Object>>}
     */
    async getAll() {
        const sql = `SELECT * FROM ${this.tableName}`;
        return this.dbManager.runQuery(sql);
    }

    /**
     * Adds a new record to the table.
     * @param {string} name - The name of the new entity.
     * @returns {Promise<Object>} The created entity with its ID.
     */
    async add(name) {
        const sql = `INSERT INTO ${this.tableName} (name) VALUES (?)`;
        const result = await this.dbManager.runCommand(sql, [name]);
        return { id: result.id, name };
    }

    /**
     * Updates an existing record in the table.
     * @param {number} id - The ID of the record to update.
     * @param {string} name - The new name for the entity.
     * @returns {Promise<Object>} The updated entity.
     * @throws {Error} If the record is not found.
     */
    async update(id, name) {
        const sql = `UPDATE ${this.tableName} SET name = ? WHERE id = ?`;
        const result = await this.dbManager.runCommand(sql, [name, id]);
        if (result.changes === 0) {
            throw new Error(`${this.tableName.slice(0, -1)} not found or no changes made.`);
        }
        return { id: parseInt(id), name };
    }

    /**
     * Deletes a record from the table.
     * @param {number} id - The ID of the record to delete.
     * @returns {Promise<void>}
     * @throws {Error} If the record is not found or is referenced by expenses.
     */
    async delete(id) {
        if (this.fkColumnName && await this._isReferenced(id)) {
            throw new Error(`Cannot delete ${this.tableName.slice(0, -1)}: it is associated with existing expenses.`);
        }
        const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
        const result = await this.dbManager.runCommand(sql, [id]);
        if (result.changes === 0) {
            throw new Error(`${this.tableName.slice(0, -1)} not found.`);
        }
    }

    /**
     * Checks if an entity is referenced by any expenses.
     * @private
     * @param {number} entityId - The ID of the entity to check.
     * @returns {Promise<boolean>} True if referenced, false otherwise.
     */
    async _isReferenced(entityId) {
        if (!this.fkColumnName) return false; // Not a foreign key table for expenses
        const sql = `SELECT COUNT(*) AS count FROM Expenses WHERE ${this.fkColumnName} = ?`;
        const rows = await this.dbManager.runQuery(sql, [entityId]);
        return rows[0].count > 0;
    }
}

module.exports = AuxDataRepository;