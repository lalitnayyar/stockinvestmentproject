const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Import routes
const authRoutes = require('./routes/auth');
const portfolioRoutes = require('./routes/portfolio');
const stockRoutes = require('./routes/stocks');

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database
const dbPath = path.join(__dirname, 'db/database.db');
console.log('Database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1); // Exit if we can't connect to the database
    } else {
        console.log('Connected to database successfully');
        // Check for --drop-tables argument
        if (process.argv.includes('--drop-tables')) {
            dropAllTables(() => initializeDatabase());
        } else {
            initializeDatabase();
        }
    }
});

// Function to drop all tables
function dropAllTables(callback) {
    db.serialize(() => {
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
            if (err) {
                console.error('Error getting tables:', err);
                return;
            }
            
            tables.forEach(table => {
                db.run(`DROP TABLE IF EXISTS ${table.name}`, (err) => {
                    if (err) {
                        console.error(`Error dropping table ${table.name}:`, err);
                    } else {
                        console.log(`Dropped table ${table.name}`);
                    }
                });
            });
            
            callback();
        });
    });
}

// Database initialization function
function initializeDatabase() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Portfolio table
        db.run(`CREATE TABLE IF NOT EXISTS portfolio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            symbol TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            purchase_price REAL NOT NULL,
            purchase_date DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Sold stocks table for transaction history
        db.run(`CREATE TABLE IF NOT EXISTS sold_stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            symbol TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            sell_price REAL NOT NULL,
            sell_date DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Transactions table
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY', 'SELL')),
            transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Stocks table for UAE market
        db.run(`CREATE TABLE IF NOT EXISTS stocks (
            symbol TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            current_price REAL,
            change_percent REAL,
            market_cap REAL,
            volume INTEGER,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/stocks', stockRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
