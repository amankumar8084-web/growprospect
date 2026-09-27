import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('[DB] Successfully connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('[DB] Error connecting to the database:', error.message);
    throw error;
  }
}

export const query = (text, params) => pool.query(text, params);
