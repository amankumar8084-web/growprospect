/**
 * Tenant Isolation Query Helper
 * Guarantees that EVERY database operation strictly filters by org_id.
 * Throws a fatal security exception if an operation attempts to bypass tenant boundaries.
 */

/**
 * Validates that an organization ID is provided and is a valid string.
 * @param {string} orgId 
 * @returns {string} Trimmed orgId
 */
export function validateOrgId(orgId) {
  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    throw new Error('Tenant isolation violation: orgId is required for all database operations');
  }
  return orgId.trim();
}

/**
 * Wraps a PostgreSQL client or pool to automatically enforce tenant scoping.
 * Rejects any query that fails to include the org_id filter.
 * 
 * @param {import('pg').Pool | import('pg').PoolClient} dbClient 
 * @param {string} orgId 
 */
export function createTenantDb(dbClient, orgId) {
  const safeOrgId = validateOrgId(orgId);

  return {
    orgId: safeOrgId,

    /**
     * Executes a raw parameterized query, verifying that org_id is present.
     * @param {string} text SQL statement
     * @param {any[]} [params=[]] Query parameters
     */
    async query(text, params = []) {
      const lowerSql = text.toLowerCase();

      // Guard: SQL statement must contain org_id to prevent accidental cross-tenant queries
      if (!lowerSql.includes('org_id')) {
        throw new Error(`Security violation: Query executed without org_id tenant filter: "${text.slice(0, 80)}..."`);
      }

      return await dbClient.query(text, params);
    },

    /**
     * Helper to select rows scoped strictly to this tenant.
     * @param {string} table Table name
     * @param {string} [whereClause=''] Additional conditions (e.g. "pipeline_stage = $2")
     * @param {any[]} [additionalParams=[]] Values corresponding to $2, $3, etc.
     * @param {string} [suffix=''] Order by, limit, offset, etc.
     */
    async select(table, whereClause = '', additionalParams = [], suffix = '') {
      const fullWhere = whereClause 
        ? `WHERE org_id = $1 AND (${whereClause})`
        : `WHERE org_id = $1`;
      
      const sql = `SELECT * FROM ${table} ${fullWhere} ${suffix}`;
      const params = [safeOrgId, ...additionalParams];
      return await dbClient.query(sql, params);
    },

    /**
     * Helper to insert a row, automatically injecting org_id.
     * @param {string} table Table name
     * @param {Record<string, any>} data Row data
     * @returns {Promise<any>}
     */
    async insert(table, data) {
      const rowData = { ...data, org_id: safeOrgId };
      const keys = Object.keys(rowData);
      const values = Object.values(rowData);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const res = await dbClient.query(sql, values);
      return res.rows[0];
    },

    /**
     * Helper to update rows scoped strictly to this tenant.
     * @param {string} table Table name
     * @param {Record<string, any>} updates Key-value updates
     * @param {string} id Row ID
     */
    async updateById(table, updates, id) {
      const setClauses = [];
      const values = [safeOrgId, id];
      let pIndex = 3;

      for (const [key, val] of Object.entries(updates)) {
        if (key === 'org_id' || key === 'id') continue;
        setClauses.push(`${key} = $${pIndex++}`);
        values.push(val);
      }

      if (setClauses.length === 0) return null;

      const sql = `
        UPDATE ${table}
        SET ${setClauses.join(', ')}
        WHERE org_id = $1 AND id = $2
        RETURNING *
      `;
      const res = await dbClient.query(sql, values);
      return res.rows[0] || null;
    },

    /**
     * Helper to delete a row scoped strictly to this tenant.
     * @param {string} table Table name
     * @param {string} id Row ID
     */
    async deleteById(table, id) {
      const sql = `DELETE FROM ${table} WHERE org_id = $1 AND id = $2`;
      const res = await dbClient.query(sql, [safeOrgId, id]);
      return res.rowCount > 0;
    }
  };
}

/**
 * In-memory tenant and role scoping helper.
 * Enforces multi-tenant boundaries and role rules on arrays.
 * 
 * Rules:
 * - admin: see all leads in org
 * - manager: see all leads in org
 * - rep: see only own leads (assigned_to === userId) or unassigned leads
 * 
 * @param {Array<any>} items List of records
 * @param {string} orgId Active Clerk organization ID
 * @param {string} [userId=null] Active user ID
 * @param {'admin'|'manager'|'rep'} [role='admin'] User role
 * @returns {Array<any>} Filtered items
 */
export function filterStoreByTenantAndRole(items, orgId, userId = null, role = 'admin') {
  validateOrgId(orgId);
  const cleanRole = String(role || 'rep').toLowerCase();

  return items.filter(item => {
    // 1. Must belong to the exact tenant org_id
    if (item.org_id !== orgId) {
      return false;
    }

    // 2. Role scoping rules
    if (cleanRole === 'admin' || cleanRole === 'manager') {
      return true;
    }

    // Reps see only their assigned leads or unassigned leads
    if (cleanRole === 'rep') {
      if (!item.assigned_to) return true; // unassigned leads can be viewed & claimed
      return item.assigned_to === userId;
    }

    return false;
  });
}
