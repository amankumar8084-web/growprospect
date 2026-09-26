const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('Error connecting to the database:', error.message);
    throw error;
  }
}

module.exports = {
  pool,
  connectDB,
  query: (text, params) => pool.query(text, params),
};
