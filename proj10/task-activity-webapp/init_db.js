const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database/tasks.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        timestamp TEXT NOT NULL
    )`, (err) => {
        if (err) {
            console.error('Error creating table', err.message);
        } else {
            console.log('Table created successfully');
        }
    });
});

db.close();