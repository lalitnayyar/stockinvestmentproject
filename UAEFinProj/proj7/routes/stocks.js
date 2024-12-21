const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// Initialize database and create tables
const dbPath = path.join(__dirname, '../db/database.db');
console.log('Stocks database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to stocks database:', err);
        process.exit(1);
    }
});

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        purchase_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sold_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        sell_price REAL NOT NULL,
        sell_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        stock_symbol TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        transaction_type TEXT NOT NULL,
        transaction_date DATETIME NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Search for stock symbols
router.get('/search-symbol/:query', function(req, res) {
    const query = req.params.query;
    
    axios.get(`https://query1.finance.yahoo.com/v1/finance/search?q=${query}`)
        .then(response => {
            if (response.data && response.data.quotes) {
                const stocks = response.data.quotes
                    .filter(quote => quote.quoteType === 'EQUITY')
                    .map(quote => ({
                        symbol: quote.symbol,
                        name: quote.shortname || quote.longname
                    }));
                res.json(stocks);
            } else {
                res.json([]);
            }
        })
        .catch(error => {
            console.error('Error searching symbols:', error);
            res.status(500).json({ error: 'Failed to search symbols' });
        });
});

// Get portfolio
router.get('/portfolio', function(req, res) {
    // Get portfolio stocks
    db.all(
        'SELECT * FROM portfolio WHERE user_id = ?',
        [req.user.id],
        async (err, stocks) => {
            if (err) {
                console.error('Error fetching portfolio:', err);
                return res.status(500).json({ error: 'Failed to fetch portfolio' });
            }

            try {
                let totalInvestment = 0;
                let currentValue = 0;

                // Fetch current prices for all stocks
                const stocksWithPrices = await Promise.all(stocks.map(async (stock) => {
                    try {
                        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.symbol}`);
                        const currentPrice = response.data.chart.result[0].meta.regularMarketPrice;
                        
                        totalInvestment += stock.purchase_price * stock.quantity;
                        currentValue += currentPrice * stock.quantity;

                        return {
                            ...stock,
                            current_price: currentPrice
                        };
                    } catch (error) {
                        console.error(`Error fetching price for ${stock.symbol}:`, error);
                        return {
                            ...stock,
                            current_price: stock.purchase_price // fallback to purchase price
                        };
                    }
                }));

                const totalProfitLoss = currentValue - totalInvestment;
                const totalProfitLossPercentage = totalInvestment > 0 ? (totalProfitLoss / totalInvestment) * 100 : 0;

                res.json({
                    portfolio: stocksWithPrices,
                    summary: {
                        totalInvestment,
                        currentValue,
                        totalProfitLoss,
                        totalProfitLossPercentage
                    }
                });
            } catch (error) {
                console.error('Error processing portfolio:', error);
                res.status(500).json({ error: 'Failed to process portfolio data' });
            }
        }
    );
});

// Add stock to portfolio
router.post('/portfolio/add', function(req, res) {
    const { symbol, quantity, purchase_price, purchase_date } = req.body;
    const userId = req.user.id;

    // Begin transaction
    db.run('BEGIN TRANSACTION', function(err) {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Failed to process purchase' });
        }

        // Add to portfolio first
        db.run(
            'INSERT INTO portfolio (user_id, symbol, quantity, purchase_price, purchase_date) VALUES (?, ?, ?, ?, ?)',
            [userId, symbol, quantity, purchase_price, purchase_date],
            function(err) {
                if (err) {
                    console.error('Error adding stock:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to add stock' });
                }

                const portfolioId = this.lastID;

                // Record transaction
                console.log(userId, symbol, quantity, purchase_price, "insert into transactions from stocks/portfolio/add");
                db.run(
                    'INSERT INTO transactions (user_id, stock_symbol, quantity, price, transaction_type, transaction_date) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                    [userId, symbol, quantity, purchase_price, 'BUY'],
                    function(err) {
                        if (err) {
                            console.error('Error recording transaction:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to record transaction' });
                        }

                        const transactionId = this.lastID;

                        db.run('COMMIT', function(err) {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Failed to complete purchase' });
                            }

                            res.json({ 
                                message: 'Stock added successfully',
                                portfolio_id: portfolioId,
                                transaction_id: transactionId
                            });
                        });
                    }
                );
            }
        );
    });
});

// Sell stock
router.post('/portfolio/sell', function(req, res) {
    const { symbol, quantity, sell_price } = req.body;
    const userId = req.user.id;

    // Check if user has enough stocks to sell
    db.get(
        'SELECT SUM(quantity) as total_quantity FROM portfolio WHERE user_id = ? AND symbol = ?',
        [userId, symbol],
        (err, row) => {
            if (err) {
                console.error('Error checking stock quantity:', err);
                return res.status(500).json({ error: 'Failed to process sale' });
            }

            if (!row || row.total_quantity < quantity) {
                return res.status(400).json({ error: 'Insufficient quantity' });
            }

            // Begin transaction
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    console.error('Error starting transaction:', err);
                    return res.status(500).json({ error: 'Failed to process sale' });
                }

                // Record transaction first
                console.log(userId, symbol, quantity, sell_price, "insert into transactions from stocks route");
                db.run(
                    'INSERT INTO transactions (user_id, stock_symbol, quantity, price, transaction_type, transaction_date) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                    [userId, symbol, quantity, sell_price, 'SELL'],
                    function(err) {
                        if (err) {
                            console.error('Error recording transaction:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to record transaction' });
                        }

                        const transactionId = this.lastID;

                        // Add to sold_stocks
                        console.log(userId, symbol, quantity, sell_price, "insert into sold_stocks");
                        db.run(
                            `INSERT INTO sold_stocks (user_id, symbol, quantity, sell_price, sell_date) 
                             VALUES (?, ?, ?, ?, date('now'))`,
                            [userId, symbol, quantity, sell_price],
                            function(err) {
                                if (err) {
                                    console.error('Error recording sale:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Failed to record sale' });
                                }

                                // Update portfolio quantity
                                db.run(
                                    `UPDATE portfolio 
                                     SET quantity = quantity - ? 
                                     WHERE user_id = ? AND symbol = ? AND quantity >= ?`,
                                    [quantity, userId, symbol, quantity],
                                    function(err) {
                                        if (err) {
                                            console.error('Error updating portfolio:', err);
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Failed to update portfolio' });
                                        }

                                        // Delete any rows with quantity 0
                                        db.run(
                                            'DELETE FROM portfolio WHERE quantity <= 0',
                                            function(err) {
                                                if (err) {
                                                    console.error('Error cleaning up portfolio:', err);
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: 'Failed to clean up portfolio' });
                                                }

                                                db.run('COMMIT', function(err) {
                                                    if (err) {
                                                        console.error('Error committing transaction:', err);
                                                        db.run('ROLLBACK');
                                                        return res.status(500).json({ error: 'Failed to complete sale' });
                                                    }

                                                    res.json({
                                                        message: 'Stock sold successfully',
                                                        transaction_id: transactionId
                                                    });
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            });
        }
    );
});

module.exports = router;
