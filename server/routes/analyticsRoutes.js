const express = require('express');
const path = require('path');
const multer = require('multer'); 
const { processPatreonCsv } = require('../importCsv'); 
const fs = require('fs'); 

const router = express.Router();

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
    const db = req.app.locals.db; 

    if (!db) { 
        console.error('Database connection not found in app.locals');
        return res.status(500).json({ error: 'Database connection not available' });
    }

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
            ORDER BY upload_id DESC; 
        `;
        const uploads = await promisifyDbAll(db, sql);
        res.json(uploads);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch uploads summary', details: error.message });
    } 
});

router.post('/upload-csv', upload.single('patreonCsv'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type incorrect.' });
    }

    const csvFilePath = req.file.path;
    const db = req.app.locals.db; 

    if (!db) { 
        console.error('Database connection not found in app.locals for CSV upload');
        fs.unlink(csvFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting temporary upload file after DB error:', unlinkErr);
        });
        return res.status(500).json({ error: 'Database connection not available for CSV processing' });
    }

    try {
        console.log(`Route: Attempting to process CSV: ${csvFilePath}`);
        const result = await processPatreonCsv(csvFilePath, db); 
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
