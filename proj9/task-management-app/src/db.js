const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
let db;

function connect() {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Could not connect to database', err);
        } else {
            console.log('Connected to database');
        }
    });
}

function getDb() {
    return db;
}

module.exports = {
    connect,
    getDb
};