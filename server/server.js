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

// Define middleware and routes first
app.use(cors());
app.use(express.json());
app.use('/api', analyticsRoutes);
app.get('/', (req, res) => {
  res.send('Patreon Analytics Backend is running!');
});

async function startServer() {
    try {
        // Promisify database opening
        const db = await new Promise((resolve, reject) => {
            const instance = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err); // Reject the promise on error
                } else {
                    console.log(`Successfully connected to the SQLite database at ${dbPath}.`);
                    resolve(instance); // Resolve with the db instance
                }
            });
        });

        app.locals.db = db; // Make db connection available to routes

        await initializeDatabase(db, dbPath); // Await table initialization

        // Start server only after DB is fully ready and initialized
        app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
        });

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1); // Exit if server fails to start
    }
}

startServer(); // Call the async function to start the server

// Graceful shutdown: Close the database connection when the app exits
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    if (app.locals.db) {
        app.locals.db.close((err) => {
            if (err) {
                console.error('Error closing the database connection:', err.message);
            }
            console.log('Database connection closed.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
