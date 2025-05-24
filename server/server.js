require('dotenv').config(); // Load .env file variables
const express = require('express');
const cors = require('cors');
const path = require('path'); // For resolving database paths
const sqlite3 = require('sqlite3').verbose(); // To create the shared DB instance
const analyticsRoutes = require('./routes/analyticsRoutes');
const { initializeDatabase } = require('./db_init');

const app = express();
const PORT = process.env.PORT || 3001;

// Determine Database Path based on NODE_ENV
const isProduction = process.env.NODE_ENV === 'production';
const dbFileName = isProduction ? 'patreon_data_prod.db' : 'patreon_data_dev.db';
const dbPath = path.resolve(__dirname, dbFileName);

console.log(`Using database: ${dbPath}`);

// Initialize and share database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        // Potentially exit or handle more gracefully if DB connection is critical at start
        process.exit(1); 
    }
    console.log(`Successfully connected to the SQLite database at ${dbPath}.`);
    // Make db connection available to routes
    app.locals.db = db; 

    // Initialize database tables (ensure this runs after DB is connected)
    initializeDatabase(db, dbPath); // Pass the opened db object and path for logging
    // We'll call initializeDatabase after the DB connection is confirmed open and assigned to app.locals.db
    // This ensures that initializeDatabase uses the same db instance logic if it were to need it (though it creates its own for now)
    // For now, initializeDatabase creates its own connection. This is fine.
    // The primary goal here is that analyticsRoutes uses the shared app.locals.db
});

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
// Routes will now access the db via req.app.locals.db
app.use('/api', analyticsRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Patreon Analytics Backend is running!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Graceful shutdown: Close the database connection when the app exits
process.on('SIGINT', () => {
    if (app.locals.db) {
        app.locals.db.close((err) => {
            if (err) {
                console.error('Error closing the database connection:', err.message);
            }
            console.log('Database connection closed.');
            process.exit(0);
        });
    }
});
