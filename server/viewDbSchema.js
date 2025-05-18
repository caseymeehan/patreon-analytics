const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'patreon_data.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the SQLite database.');
});

async function getTableSchema(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName});`, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function printAllTableSchemas() {
    console.log('\n--- Database Schema ---');
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", [], async (err, tables) => {
        if (err) {
            console.error('Error fetching tables:', err.message);
            db.close();
            return;
        }

        if (tables.length === 0) {
            console.log('No user tables found in the database.');
        } else {
            for (const table of tables) {
                console.log(`\nTable: ${table.name}`);
                try {
                    const schema = await getTableSchema(table.name);
                    if (schema.length === 0) {
                        console.log('  (No columns found or table is empty/definition issue)');
                    } else {
                        schema.forEach(col => {
                            console.log(`  Column: ${col.name}, Type: ${col.type}, NotNull: ${col.notnull}, PK: ${col.pk}`);
                        });
                    }
                } catch (schemaErr) {
                    console.error(`  Error fetching schema for table ${table.name}:`, schemaErr.message);
                }
            }
        }

        // Close the database connection
        db.close((closeErr) => {
            if (closeErr) {
                console.error('Error closing database:', closeErr.message);
            }
            console.log('\nDatabase connection closed.');
        });
    });
}

printAllTableSchemas();
