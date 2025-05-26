require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const analyticsRoutes = require('./routes/analyticsRoutes');
const { initializeDatabase } = require('./db_init');

const app = express();
const PORT = process.env.PORT || 3001;

// Determine DB path based on environment
const dbFilename = process.env.NODE_ENV === 'production' ? 'patreon_data_prod.db' : 'patreon_data_dev.db';
const dbPath = path.join(__dirname, dbFilename);

// Middleware setup (can happen before DB connection)
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// API Routes (will use app.locals.db later)
app.use('/api', analyticsRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Patreon Analytics Backend is running!');
});

// Asynchronous function to start the server
async function startServer() {
  try {
    // Create/open the database connection for the application
    const db = await new Promise((resolve, reject) => {
      const instance = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error(`Error opening database ${dbPath} in server.js:`, err.message);
          return reject(err);
        }
        console.log(`Successfully connected to the SQLite database: ${dbPath}`);
        resolve(instance);
      });
    });

    app.locals.db = db; // Make db connection available to routes via req.app.locals.db

    // Call initializeDatabase with the shared connection
    initializeDatabase(app.locals.db); 

    // Start server only after DB connection is established
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

  } catch (error) {
    console.error("Failed to start the server due to a critical error:", error);
    process.exit(1); // Exit if we can't connect to DB or encounter other startup errors
  }
}

// Start the server
startServer();
