// /Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/server/db_init.js

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

function initializeDatabase(db) {
    console.log('Initializing tables on the provided database connection...');

    db.exec(createTablesSQL, (err) => {
        if (err) {
            console.error('Error creating tables:', err.message);
        } else {
            console.log('Tables created or already exist.');
        }
    });
}

module.exports = { initializeDatabase };
