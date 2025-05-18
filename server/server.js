const express = require('express');
const cors = require('cors');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 3001; // Backend port, React default is 3000

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api', analyticsRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Patreon Analytics Backend is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
