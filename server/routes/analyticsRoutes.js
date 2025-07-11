const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer'); 
const { processPatreonCsv } = require('../importCsv'); 
const fs = require('fs'); 

const router = express.Router();
const dbPath = path.resolve(__dirname, '../patreon_data.db'); 

const UPLOAD_DIR = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (path.extname(file.originalname).toLowerCase() !== '.csv') {
            return cb(new Error('Only .csv files are allowed!'), false);
        }
        cb(null, true);
    }
});

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

router.get('/uploads-summary', async (req, res) => {
    let db; // Declare db outside try so finally can access it

    try {
        // Promisify the database connection
        db = await new Promise((resolve, reject) => {
            const connection = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err); // Reject the promise on connection error
                } else {
                    resolve(connection); // Resolve with the connected db object
                }
            });
        });

        const sql = `
            SELECT 
                u.upload_id,
                u.filename,
                u.upload_timestamp,
                u.row_count,
                u.active_patron_count,
                u.net_patron_change,
                u.lost_patron_count,
                COALESCE(r.total_revenue, 0) as total_revenue,
                COALESCE(r.total_revenue * 0.90, 0) as estimated_payment
            FROM uploads u
            LEFT JOIN (
                SELECT 
                    ss.upload_id,
                    SUM(ss.pledge_amount) as total_revenue
                FROM supporter_snapshots ss
                WHERE ss.patron_status = 'Active patron'
                GROUP BY ss.upload_id
            ) r ON u.upload_id = r.upload_id
            ORDER BY u.upload_id DESC; 
        `;
        const uploads = await promisifyDbAll(db, sql);
        res.json(uploads);

    } catch (error) {
        // Ensure we send a response even if the DB connection itself failed
        if (!res.headersSent) {
             res.status(500).json({ error: 'Failed to fetch uploads summary', details: error.message });
        }
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

router.post('/upload-csv', upload.single('patreonCsv'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type incorrect.' });
    }

    const csvFilePath = req.file.path;

    try {
        console.log(`Route: Attempting to process CSV: ${csvFilePath}`);
        const result = await processPatreonCsv(csvFilePath);
        console.log('Route: CSV processing successful:', result);
        res.status(200).json({ 
            message: 'CSV processed successfully!', 
            data: result 
        });
    } catch (error) {
        console.error('Route: Error processing CSV:', error);
        const errorMessage = error && error.message ? error.message : 'An unexpected error occurred during CSV processing.';
        const errorDetails = error && error.details ? error.details : null;
        res.status(500).json({ 
            message: 'Error processing CSV file.', 
            error: errorMessage,
            details: errorDetails 
        });
    } finally {
        // Optionally, delete the uploaded file after processing
        // fs.unlink(csvFilePath, (err) => {
        //     if (err) console.error('Error deleting temporary upload file:', err);
        //     else console.log('Temporary upload file deleted:', csvFilePath);
        // });
    }
});

module.exports = router;
