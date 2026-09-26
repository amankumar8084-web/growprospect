require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith('.sql')) {
        console.log(`Running migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);
        console.log(`Successfully migrated: ${file}`);
      }
    }
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations();
