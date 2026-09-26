const express = require('express');
const cors = require('cors');
const { clerkMiddleware } = require('@clerk/express');
const errorHandler = require('./middlewares/errorHandler');
const { protect } = require('./middlewares/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

const locationsRouter = require('./routes/locations');
const importsRouter = require('./routes/imports');
const leadsRouter = require('./routes/leads');
const analysisRouter = require('./routes/analysis');
const dashboardRouter = require('./routes/dashboard');

// Routes will be added here
app.use('/api/locations', locationsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Example protected route
app.get('/api/protected', protect, (req, res) => {
  res.json({ 
    message: 'This is a protected route', 
    userId: req.auth.userId 
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
