// /Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/server/importCsv.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sqlite3 = require('sqlite3').verbose(); // Use verbose for more detailed errors

// --- Configuration ---
const dbPath = path.resolve(__dirname, 'patreon_data.db');

// --- Get CSV Path from Arguments ---
if (process.argv.length < 3) {
    console.error('Usage: node importCsv.js <path_to_csv_file>');
    process.exit(1); // Exit if no path provided
}
const csvFilePath = process.argv[2];
if (!fs.existsSync(csvFilePath)) {
    console.error(`Error: CSV file not found at ${csvFilePath}`);
    process.exit(1);
}
const csvFilename = path.basename(csvFilePath);
console.log(`Processing CSV file: ${csvFilename}`);

// --- Database Promise Wrappers ---
function promisifyDbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { // Use function() to access 'this'
            if (err) {
                console.error('DB Run Error - SQL:', sql);
                console.error('DB Run Error - Params:', params);
                reject(err);
            } else {
                resolve(this); // 'this' contains lastID and changes
            }
        });
    });
}

function promisifyDbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error('DB Get Error - SQL:', sql);
                console.error('DB Get Error - Params:', params);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function promisifyDbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('DB All Error - SQL:', sql);
                console.error('DB All Error - Params:', params);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// --- Helper Functions ---
function parseName(fullName) {
    if (!fullName) return { firstName: '', lastName: '' };
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    return { firstName, lastName };
}

// --- Main Import Function ---
async function importCsv() {
    console.log(`Starting import for: ${csvFilename}`);
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Connected to the SQLite database.');
    });

    let uploadId;
    let rowCount = 0;
    let activePatronCount = 0;
    let netPatronChange = 0; // Initialize net change

    try {
        // Find the latest previous upload
        const latestUpload = await promisifyDbGet(db,
            'SELECT upload_id, active_patron_count FROM uploads ORDER BY upload_id DESC LIMIT 1'
        );

        let previousActiveCount = 0; // Default for first upload
        if (latestUpload) {
            console.log(`Found previous upload ID: ${latestUpload.upload_id} with ${latestUpload.active_patron_count} active patrons.`);
            previousActiveCount = latestUpload.active_patron_count || 0; // Use 0 if null/undefined
        } else {
            console.log('No previous uploads found. This is the first import.');
        }

        // Start Transaction
        await promisifyDbRun(db, 'BEGIN TRANSACTION');
        console.log('Transaction started.');

        // Insert initial upload record (placeholder for net change)
        const uploadResult = await promisifyDbRun(
            db,
            'INSERT INTO uploads (filename, row_count, active_patron_count, net_patron_change) VALUES (?, ?, ?, ?)',
            [csvFilename, 0, 0, 0] // Initial counts are 0
        );
        uploadId = uploadResult.lastID;
        console.log(`Created upload record with ID: ${uploadId}`);

        // Process CSV Stream
        const processStream = new Promise((resolve, reject) => {
            const stream = fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', async (row) => {
                    // Pause stream to wait for async db operations
                   if (stream && typeof stream.pause === 'function') {
                       stream.pause();
                    }

                    try {
                        rowCount++;
                        const patreonUserId = row['User ID'];
                        const patronStatus = row['Patron Status'];

                        if (!patreonUserId) {
                             console.warn(`Skipping row ${rowCount}: Missing User ID.`);
                             if (stream && typeof stream.resume === 'function') stream.resume();
                             return; // Skip row if essential identifier is missing
                        }

                        const pledgeAmount = parseFloat(row['Pledge Amount']) || 0.0; // Handle potential NaN

                        if (patronStatus === 'Active patron' && pledgeAmount > 0) {
                            activePatronCount++;
                        }

                        const email = row['Email'];
                        const name = row['Name'];
                        const { firstName, lastName } = parseName(name);

                        // 1. Upsert Supporter
                        const upsertSql = `
                            INSERT INTO supporters (patreon_user_id, email, first_name, last_name)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT(patreon_user_id) DO UPDATE SET
                                email = excluded.email,
                                first_name = excluded.first_name,
                                last_name = excluded.last_name;
                        `;
                        await promisifyDbRun(db, upsertSql, [patreonUserId, email, firstName, lastName]);

                        // 2. Get Supporter ID
                        const supporter = await promisifyDbGet(
                            db,
                            'SELECT supporter_id FROM supporters WHERE patreon_user_id = ?',
                            [patreonUserId]
                        );

                        if (!supporter || !supporter.supporter_id) {
                            throw new Error(`Failed to find or create supporter for Patreon User ID: ${patreonUserId}`);
                        }
                        const supporterId = supporter.supporter_id;

                        // 3. Insert Snapshot
                        const snapshotSql = `
                            INSERT INTO supporter_snapshots (upload_id, supporter_id, patron_status, pledge_amount)
                            VALUES (?, ?, ?, ?);
                        `;
                        await promisifyDbRun(db, snapshotSql, [uploadId, supporterId, patronStatus, pledgeAmount]);

                        if (rowCount % 100 === 0) {
                           console.log(`Processed ${rowCount} rows...`);
                        }

                    } catch (err) {
                         console.error(`Error processing row ${rowCount}:`, row);
                         console.error('Row processing error:', err);
                         // Stop further processing on row error? Or just log and continue?
                         // For now, let's reject the stream promise to trigger rollback
                         reject(err); // This will stop the stream processing
                    } finally {
                         // Resume stream for next row
                         if (stream && typeof stream.resume === 'function') {
                             stream.resume();
                         }
                    }
                })
                .on('end', () => {
                    console.log('CSV file successfully processed.');
                    resolve(); // Resolve the stream promise
                })
                .on('error', (err) => {
                    console.error('Error reading CSV stream:', err);
                    reject(err); // Reject the stream promise
                });
            });

        await processStream; // Wait for the stream processing to complete or fail

        // Calculate Net Change
        netPatronChange = activePatronCount - previousActiveCount;
        console.log(`Calculation Complete: Current Active=${activePatronCount}, Previous Active=${previousActiveCount}, Net Change=${netPatronChange}`);

        // Update upload record with final counts and net change
        console.log(`Updating upload record ${uploadId} with final counts: Rows=${rowCount}, Active=${activePatronCount}, Net Change=${netPatronChange}`);
        await promisifyDbRun(
            db,
            'UPDATE uploads SET row_count = ?, active_patron_count = ?, net_patron_change = ? WHERE upload_id = ?',
            [rowCount, activePatronCount, netPatronChange, uploadId]
        );

        // Commit Transaction
        await promisifyDbRun(db, 'COMMIT');
        console.log('Transaction committed.');
        console.log(`Import successful! Processed ${rowCount} records.`);

    } catch (err) {
        console.error('Error during import process:', err);
        console.log('Rolling back transaction...');
        await promisifyDbRun(db, 'ROLLBACK').catch(rbErr => console.error('Error rolling back:', rbErr));
        console.log('Transaction rolled back.');
    } finally {
        // Close the database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed.');
            }
        });
    }
}

// Run the import
importCsv();
