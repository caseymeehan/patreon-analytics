// /Users/caseymeehan/Documents/base/work/other/code/Patreon_Analytics/server/importCsv.js
const fs = require('fs');
const csv = require('csv-parser');

// --- Helper: Consistent Active Status Check ---
function isStatusActive(status) {
    if (!status) return false;
    const activeStrings = ['active', 'active patron', 'active_patron'];
    return activeStrings.includes(status.trim().toLowerCase());
}

// --- Database Promise Wrappers ---
function promisifyDbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                console.error('DB Run Error - SQL:', sql);
                console.error('DB Run Error - Params:', params);
                reject(err);
            } else {
                resolve(this);
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
async function processPatreonCsv(db, csvFilePath) {
    return new Promise(async (resolveOuter, rejectOuter) => {
        const csvFilename = require('path').basename(csvFilePath);
        console.log(`Processing CSV file: ${csvFilename}`);

        if (!fs.existsSync(csvFilePath)) {
            console.error(`Error: CSV file not found at ${csvFilePath}`);
            return rejectOuter({ message: `CSV file not found at ${csvFilePath}` });
        }

        console.log('Using provided SQLite database connection for CSV import.');

        let uploadId;
        let rowCount = 0;
        let activePatronCount = 0;
        let netPatronChange = 0;
        let lostPatronCount = 0;
        let previousUploadId = null;

        try {
            const latestUpload = await promisifyDbGet(db,
                'SELECT upload_id, active_patron_count FROM uploads ORDER BY upload_id DESC LIMIT 1'
            );

            let previousActiveCount = 0;
            if (latestUpload) {
                console.log(`Found previous upload ID: ${latestUpload.upload_id} with ${latestUpload.active_patron_count} active patrons.`);
                previousActiveCount = latestUpload.active_patron_count || 0;
                previousUploadId = latestUpload.upload_id;
            } else {
                console.log('No previous uploads found. This is the first import.');
            }

            await promisifyDbRun(db, 'BEGIN TRANSACTION');
            console.log('Transaction started.');

            const uploadResult = await promisifyDbRun(
                db,
                'INSERT INTO uploads (filename, row_count, active_patron_count, net_patron_change, lost_patron_count) VALUES (?, ?, ?, ?, ?)',
                [csvFilename, 0, 0, 0, 0]
            );
            uploadId = uploadResult.lastID;
            console.log(`Created upload record with ID: ${uploadId}`);

            const rowProcessingPromises = [];
            const processStream = new Promise((resolve, reject) => {
                const stream = fs.createReadStream(csvFilePath)
                    .pipe(csv())
                    .on('data', async (row) => {
                        const rowPromise = (async () => {
                            if (stream && typeof stream.pause === 'function') {
                                stream.pause();
                            }
                            try {
                                rowCount++;
                                const patreonUserId = row['User ID'];
                                const email = row['Email'];
                                const fullName = row['Name'];
                                const { firstName, lastName } = parseName(fullName);
                                const patronStatus = row['Patron Status'];
                                const pledgeAmountRaw = row['Pledge Amount'];
                                const pledgeAmount = parseFloat(pledgeAmountRaw.replace(/[^\d.-]/g, '')) || 0;

                                if (!patreonUserId) {
                                    console.warn(`Skipping row ${rowCount}: User ID is missing.`);
                                    if (stream && typeof stream.resume === 'function') stream.resume();
                                    return;
                                }
                                
                                if (isStatusActive(patronStatus) && pledgeAmount > 0) {
                                    activePatronCount++;
                                }

                                const upsertSql = `
                                    INSERT INTO supporters (patreon_user_id, email, first_name, last_name)
                                    VALUES (?, ?, ?, ?)
                                    ON CONFLICT(patreon_user_id) DO UPDATE SET
                                        email = excluded.email,
                                        first_name = excluded.first_name,
                                        last_name = excluded.last_name;
                                `;
                                await promisifyDbRun(db, upsertSql, [patreonUserId, email, firstName, lastName]);

                                const supporter = await promisifyDbGet(
                                    db,
                                    'SELECT supporter_id FROM supporters WHERE patreon_user_id = ?',
                                    [patreonUserId]
                                );

                                if (!supporter || !supporter.supporter_id) {
                                    throw new Error(`Failed to find or create supporter for Patreon User ID: ${patreonUserId}`);
                                }
                                const supporterId = supporter.supporter_id;

                                if (previousUploadId) {
                                    const previousSnapshot = await promisifyDbGet(db,
                                        'SELECT patron_status, pledge_amount FROM supporter_snapshots WHERE supporter_id = ? AND upload_id = ?',
                                        [supporterId, previousUploadId]
                                    );

                                    if (previousSnapshot) {
                                        const wasActivePreviously = isStatusActive(previousSnapshot.patron_status) && previousSnapshot.pledge_amount > 0;
                                        const isActiveCurrently = isStatusActive(patronStatus) && pledgeAmount > 0;

                                        if (wasActivePreviously && !isActiveCurrently) {
                                            lostPatronCount++;
                                        }
                                    }
                                }

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
                                 reject(err); 
                            } finally {
                                 if (stream && typeof stream.resume === 'function') {
                                     stream.resume();
                                 }
                            }
                        })(); 
                        rowProcessingPromises.push(rowPromise); 
                    })
                    .on('end', async () => { 
                        try {
                            await Promise.all(rowProcessingPromises); 
                            console.log('CSV file successfully processed and all rows written.');
                            resolve(); 
                        } catch (err) {
                            console.error('Error processing one or more rows:', err);
                            reject(err); 
                        }
                    })
                    .on('error', (err) => {
                        console.error('Error reading CSV stream:', err);
                        reject(err); 
                    });
            });

            await processStream; 

            netPatronChange = activePatronCount - previousActiveCount;
            console.log(`Calculation Complete: Current Active=${activePatronCount}, Previous Active=${previousActiveCount}, Net Change=${netPatronChange}, Lost Patrons=${lostPatronCount}`);

            console.log(`Updating upload record ${uploadId} with final counts: Rows=${rowCount}, Active=${activePatronCount}, Net Change=${netPatronChange}, Lost=${lostPatronCount}`);
            await promisifyDbRun(
                db,
                'UPDATE uploads SET row_count = ?, active_patron_count = ?, net_patron_change = ?, lost_patron_count = ? WHERE upload_id = ?',
                [rowCount, activePatronCount, netPatronChange, lostPatronCount, uploadId]
            );

            await promisifyDbRun(db, 'COMMIT');
            console.log('Transaction committed.');
            console.log(`Import successful! Processed ${rowCount} records.`);
            resolveOuter({ 
                message: 'Import successful!', 
                filename: csvFilename, 
                uploadId: uploadId,
                rowCount: rowCount, 
                activePatronCount: activePatronCount,
                netPatronChange: netPatronChange,
                lostPatronCount: lostPatronCount
            });

        } catch (err) {
            console.error('Error during import process:', err);
            await promisifyDbRun(db, 'ROLLBACK').catch(rbErr => console.error('Error rolling back:', rbErr));
            console.log('Transaction rolled back.');
            rejectOuter({ message: 'Error during import process', details: err.message });
        }
    });
}

// Export the refactored function
module.exports = { processPatreonCsv };
