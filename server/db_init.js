// /Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/server/db_init.js
const path = require('path');

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS uploads (
    upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    row_count INTEGER,
    active_patron_count INTEGER,
    net_patron_change INTEGER,
    lost_patron_count INTEGER
);

CREATE TABLE IF NOT EXISTS supporters (
    supporter_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patreon_user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT
);

CREATE TABLE IF NOT EXISTS supporter_snapshots (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER,
    supporter_id INTEGER,
    patron_status TEXT,
    pledge_amount REAL,
    FOREIGN KEY (upload_id) REFERENCES uploads(upload_id) ON DELETE CASCADE,
    FOREIGN KEY (supporter_id) REFERENCES supporters(supporter_id) ON DELETE CASCADE
);
`;

function execPromise(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, function(err) { 
            if (err) {
                console.error(`Error executing SQL batch: ${sql.substring(0,100)}...`, err.message);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

async function initializeDatabase(db, databasePath) {
    console.log(`Initializing database at path (async): ${databasePath}`);
    try {
        await execPromise(db, createTablesSQL);
        console.log('Tables created or already exist (async).');
    } catch (err) {
        console.error('Failed to initialize database tables (async):', err);
        throw err; 
    }
}

module.exports = { initializeDatabase };
