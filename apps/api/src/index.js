require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./db');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await connectDB();
    console.log('Database connected successfully');
    
    app.listen(PORT, () => {
      console.log(`API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
