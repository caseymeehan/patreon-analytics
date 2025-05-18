const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();
const dbPath = path.resolve(__dirname, '../patreon_data.db'); // Path to your SQLite database

// Helper function to promisify db.all
function promisifyDbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('DB all error:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// GET /api/uploads-summary
router.get('/uploads-summary', async (req, res) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return res.status(500).json({ error: 'Failed to connect to database' });
        }
    });

    try {
        const sql = `
            SELECT 
                upload_id,
                filename,
                upload_timestamp,
                row_count,
                active_patron_count,
                net_patron_change,
                lost_patron_count
            FROM uploads
            ORDER BY upload_id ASC; -- Or upload_timestamp ASC for chronological order
        `;
        const uploads = await promisifyDbAll(db, sql);
        res.json(uploads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch uploads summary', details: error.message });
    } finally {
        if (db) {
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                }
            });
        }
    }
});

module.exports = router;
