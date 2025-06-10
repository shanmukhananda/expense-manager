class EntityManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.entityCreationLocks = new Map();
    }

    async _findEntity(tableName, entityNameColumn, entityName, logPrefix = 'Entity', lockKey = '', isRefetch = false) {
        const action = isRefetch ? "final SELECT" : "initial SELECT";
        const rows = await this.dbManager.runQuery(`SELECT id FROM ${tableName} WHERE ${entityNameColumn} = $1`, [entityName]);
        if (rows.length > 0) {
            return rows[0].id;
        }
        return null;
    }

    async _createEntity(tableName, entityNameColumn, entityName, logPrefix = 'Entity', lockKey = '') {
        const insertResult = await this.dbManager.runCommand(`INSERT INTO ${tableName} (${entityNameColumn}) VALUES ($1)`, [entityName]);
        if (insertResult && insertResult.id !== undefined) {
            console.log(`EntityManager: ${logPrefix} '${entityName}' (key: ${lockKey}) created with ID: ${insertResult.id}`);
            return insertResult.id;
        }
        throw new Error(`EntityManager: ${logPrefix} '${entityName}' (key: ${lockKey}) creation did not return a valid ID.`);
    }

    async findOrCreateEntity(tableName, entityName, entityNameColumn = 'name', logPrefix = 'Entity') {
        if (!entityName || String(entityName).trim() === '') {
            console.warn(`EntityManager: Attempted to find or create an entity in table '${tableName}' with an empty name. Skipping.`);
            return null;
        }
        const lockKey = `${tableName}-${entityNameColumn}-${entityName}`;

        if (this.entityCreationLocks.has(lockKey)) {
            return this.entityCreationLocks.get(lockKey);
        }

        let promiseResolver, promiseRejector;
        const newPromise = new Promise((resolve, reject) => {
            promiseResolver = resolve;
            promiseRejector = reject;
        });
        this.entityCreationLocks.set(lockKey, newPromise);

        this._executeFindOrCreateLogic(
            newPromise, promiseResolver, promiseRejector,
            tableName, entityNameColumn, entityName,
            logPrefix, lockKey
        );

        return newPromise;
    }

    async _executeFindOrCreateLogic(
        originalPromise, resolve, reject,
        tableName, entityNameColumn, entityName,
        logPrefix, lockKey
    ) {
        let successfullyResolved = false;
        try {
            let entityId = await this._findEntity(tableName, entityNameColumn, entityName, logPrefix, lockKey);
            if (entityId) {
                successfullyResolved = true;
                resolve(entityId);
                return;
            }

            entityId = await this._createEntity(tableName, entityNameColumn, entityName, logPrefix, lockKey);
            if (entityId) {
                successfullyResolved = true;
                resolve(entityId);
            } else {
                throw new Error(`EntityManager: ${logPrefix} '${entityName}' (key: ${lockKey}) creation did not return an ID (unexpected).`);
            }
        } catch (error) {
            if (error.code === '23505' || (error.message && error.message.includes('duplicate key value violates unique constraint'))) {
                console.warn(`EntityManager: Warn: ${logPrefix} '${entityName}' (key: ${lockKey}) creation failed due to duplicate key. Attempting final find.`);
                try {
                    const entityId = await this._findEntity(tableName, entityNameColumn, entityName, logPrefix, lockKey, true); // Refetch
                    if (entityId) {
                        successfullyResolved = true;
                        resolve(entityId);
                    } else {
                        throw new Error(`EntityManager: Failed to re-fetch ${logPrefix} '${entityName}' (key: ${lockKey}) after duplicate key error.`);
                    }
                } catch (refetchError) {
                    console.error(`EntityManager: Error in ${logPrefix} '${entityName}' (key: ${lockKey}) final find after duplicate: ${refetchError.message}`);
                    reject(refetchError);
                }
            } else {
                console.error(`EntityManager: Error in ${logPrefix} '${entityName}' (key: ${lockKey}) process: ${error.message}`);
                reject(error);
            }
        } finally {
            if (!successfullyResolved && this.entityCreationLocks.get(lockKey) === originalPromise) {
                this.entityCreationLocks.delete(lockKey);
            }
        }
    }
}

module.exports = EntityManager;
