const { requireAuth } = require('@clerk/express');

// Middleware to protect routes that require authentication
const protect = requireAuth({
  signInUrl: 'http://localhost:5173/sign-in', // Adjust based on your frontend URL
});

module.exports = {
  protect
};
