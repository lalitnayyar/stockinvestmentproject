const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const moment = require('moment');
const yahooFinance = require('yahoo-finance2').default;

const app = express();
const port = 3003;

// Database setup
const db = new sqlite3.Database('investment.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the investment database.');
});

// Drop and recreate the tables to ensure proper schema
db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS sell_transactions`);
    db.run(`DROP TABLE IF EXISTS stocks`);
    db.run(`DROP TABLE IF EXISTS holdings`);
    db.run(`DROP TABLE IF EXISTS transactions`);
    db.run(`DROP TABLE IF EXISTS audit_log`);
    
    // Stocks table with additional fields
    db.run(`CREATE TABLE IF NOT EXISTS stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        current_price DECIMAL(10,2),
        price_change DECIMAL(10,2),
        shares INTEGER NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        purchase_date DATE NOT NULL,
        purchase_source TEXT,
        notes TEXT,
        last_updated DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Sell transactions table
    db.run(`CREATE TABLE IF NOT EXISTS sell_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER NOT NULL,
        shares_sold INTEGER NOT NULL,
        sell_price DECIMAL(10,2) NOT NULL,
        sell_date DATE NOT NULL,
        profit_loss DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(stock_id) REFERENCES stocks(id)
    )`);

    // Holdings table
    db.run(`CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        quantity INTEGER NOT NULL,
        purchase_price DECIMAL(10,2) NOT NULL,
        purchase_date DATE NOT NULL,
        FOREIGN KEY(stock_id) REFERENCES stocks(id)
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id INTEGER,
        type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        transaction_date DATE NOT NULL,
        FOREIGN KEY(stock_id) REFERENCES stocks(id)
    )`);

    // Audit log table
    db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Function to update stock information
async function updateStockInfo(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        return {
            name: quote.longName || quote.shortName,
            currentPrice: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent
        };
    } catch (err) {
        console.error(`Error fetching stock info for ${symbol}:`, err);
        return null;
    }
}

// Function to update all stocks
async function updateAllStocks() {
    db.all('SELECT * FROM stocks', [], async (err, stocks) => {
        if (err) {
            console.error('Error fetching stocks:', err);
            return;
        }

        for (const stock of stocks) {
            const stockInfo = await updateStockInfo(stock.symbol);
            if (stockInfo) {
                db.run(
                    'UPDATE stocks SET name = ?, current_price = ?, price_change = ?, last_updated = CURRENT_TIMESTAMP WHERE symbol = ?',
                    [stockInfo.name, stockInfo.currentPrice, stockInfo.change, stock.symbol],
                    (err) => {
                        if (err) {
                            console.error(`Error updating stock ${stock.symbol}:`, err);
                        }
                    }
                );
            }
        }
    });
}

// Function to search for stock symbols
async function searchStockSymbols(query) {
    try {
        const results = await yahooFinance.search(query);
        return results.quotes
            .filter(quote => quote.quoteType === 'EQUITY')
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname,
                exchange: quote.exchange
            }));
    } catch (err) {
        console.error('Error searching stocks:', err);
        return [];
    }
}

// Function to calculate total portfolio value and profit/loss
function calculatePortfolioSummary(stocks) {
    let summary = {
        totalCost: 0,
        totalValue: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0
    };

    stocks.forEach(stock => {
        const cost = stock.shares * stock.purchase_price;
        const value = stock.shares * (stock.current_price || 0);
        summary.totalCost += cost;
        summary.totalValue += value;
    });

    summary.totalProfitLoss = summary.totalValue - summary.totalCost;
    summary.totalProfitLossPercent = (summary.totalProfitLoss / summary.totalCost) * 100;

    return summary;
}

// Schedule stock updates every 5 minutes
setInterval(updateAllStocks, 5 * 60 * 1000);

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Add route for stock symbol search
app.get('/api/search-stocks', async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 2) {
        return res.json([]);
    }
    const results = await searchStockSymbols(query);
    res.json(results);
});

// Stock routes
app.get('/stocks', async (req, res) => {
    db.all('SELECT stocks.*, COALESCE(SUM(sell_transactions.shares_sold), 0) as shares_sold FROM stocks LEFT JOIN sell_transactions ON stocks.id = sell_transactions.stock_id GROUP BY stocks.id', [], (err, stocks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Calculate available shares
        stocks = stocks.map(stock => ({
            ...stock,
            available_shares: stock.shares - (stock.shares_sold || 0)
        }));

        const summary = calculatePortfolioSummary(stocks);

        res.render('stocks', { 
            stocks,
            summary,
            moment: moment,
            defaultDate: moment().format('YYYY-MM-DD')
        });
    });
});

app.post('/stocks', async (req, res) => {
    const { symbol, shares, purchase_price, purchase_date, purchase_source, notes } = req.body;

    try {
        // Get stock details from Yahoo Finance
        const quote = await yahooFinance.quote(symbol);
        const stockName = quote.displayName || quote.longName || quote.shortName;
        
        db.run(
            'INSERT INTO stocks (symbol, name, shares, purchase_price, purchase_date, purchase_source, notes, current_price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [symbol, stockName, shares, purchase_price, purchase_date, purchase_source, notes, quote.regularMarketPrice, new Date().toISOString()],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Add audit log
                db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                    ['ADD_STOCK', `Added ${shares} shares of ${symbol} at $${purchase_price} from ${purchase_source || 'N/A'}`]);

                res.redirect('/stocks');
            }
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add update stock route
app.post('/update-stock/:id', async (req, res) => {
    const { id } = req.params;
    const { shares, purchase_price, purchase_date, purchase_source, notes } = req.body;

    db.run(
        'UPDATE stocks SET shares = ?, purchase_price = ?, purchase_date = ?, purchase_source = ?, notes = ? WHERE id = ?',
        [shares, purchase_price, purchase_date, purchase_source, notes, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Add audit log
            db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                ['UPDATE_STOCK', `Updated stock ID ${id} with new details`]);

            res.redirect('/stocks');
        }
    );
});

// Add delete stock route
app.post('/delete-stock/:id', async (req, res) => {
    const { id } = req.params;

    // First check if there are any sell transactions
    db.get('SELECT COUNT(*) as count FROM sell_transactions WHERE stock_id = ?', [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (result.count > 0) {
            return res.status(400).json({ error: 'Cannot delete stock with sell transactions' });
        }

        // If no sell transactions, proceed with deletion
        db.run('DELETE FROM stocks WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Add audit log
            db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                ['DELETE_STOCK', `Deleted stock ID ${id}`]);

            res.redirect('/stocks');
        });
    });
});

// Add sell stock route
app.post('/sell-stock', async (req, res) => {
    const { stock_id, shares_sold, sell_price, sell_date } = req.body;

    // Get stock information
    db.get('SELECT * FROM stocks WHERE id = ?', [stock_id], (err, stock) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        // Calculate profit/loss
        const profit_loss = (sell_price - stock.purchase_price) * shares_sold;

        // Insert sell transaction
        db.run(
            'INSERT INTO sell_transactions (stock_id, shares_sold, sell_price, sell_date, profit_loss) VALUES (?, ?, ?, ?, ?)',
            [stock_id, shares_sold, sell_price, sell_date || moment().format('YYYY-MM-DD'), profit_loss],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Add audit log
                db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                    ['SELL_STOCK', `Sold ${shares_sold} shares of ${stock.symbol} at $${sell_price} (Profit/Loss: $${profit_loss.toFixed(2)})`]);

                res.redirect('/stocks');
            }
        );
    });
});

// Add sell transactions route
app.get('/sell-transactions', async (req, res) => {
    db.all(`
        SELECT 
            st.*,
            s.symbol,
            s.name,
            s.purchase_price,
            (st.sell_price - s.purchase_price) * st.shares_sold as profit_loss
        FROM sell_transactions st
        JOIN stocks s ON st.stock_id = s.id
        ORDER BY st.created_at DESC
    `, [], (err, transactions) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Calculate totals
        const totals = transactions.reduce((acc, trans) => {
            acc.totalShares += trans.shares_sold;
            acc.totalProfit += trans.profit_loss;
            return acc;
        }, { totalShares: 0, totalProfit: 0 });

        res.render('sell-transactions', { 
            transactions,
            totals,
            moment: moment 
        });
    });
});

// Holdings routes
app.get('/holdings', async (req, res) => {
    // First get all stocks
    db.all('SELECT * FROM stocks', [], (err, stocks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Then get all holdings with stock information
        db.all(`
            SELECT h.*, s.symbol, s.name, s.current_price 
            FROM holdings h 
            JOIN stocks s ON h.stock_id = s.id
        `, [], (err, holdings) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.render('holdings', { 
                holdings,
                stocks,
                moment: moment,
                defaultDate: moment().format('YYYY-MM-DD')
            });
        });
    });
});

app.post('/holdings', async (req, res) => {
    const { stock_id, quantity, purchase_price, purchase_date } = req.body;
    
    db.run(
        'INSERT INTO holdings (stock_id, quantity, purchase_price, purchase_date) VALUES (?, ?, ?, ?)',
        [stock_id, quantity, purchase_price, purchase_date || moment().format('YYYY-MM-DD')],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Get stock info for audit log
            db.get('SELECT symbol, name FROM stocks WHERE id = ?', [stock_id], (err, stock) => {
                if (!err && stock) {
                    // Add audit log
                    db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                        ['ADD_HOLDING', `Added holding: ${stock.symbol} - ${quantity} shares at $${purchase_price}`]);
                }
                res.redirect('/holdings');
            });
        }
    );
});

// Sell shares route
app.post('/sell', (req, res) => {
    const { holding_id, quantity, sell_price, sell_date } = req.body;
    
    db.get('SELECT * FROM holdings WHERE id = ?', [holding_id], (err, holding) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (holding.quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient shares' });
        }

        const newQuantity = holding.quantity - quantity;
        
        db.run('UPDATE holdings SET quantity = ? WHERE id = ?', [newQuantity, holding_id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Add transaction and audit log
            db.run('INSERT INTO transactions (stock_id, type, quantity, price, transaction_date) VALUES (?, ?, ?, ?, ?)',
                [holding.stock_id, 'SELL', quantity, sell_price, sell_date]);
            db.run('INSERT INTO audit_log (action, details) VALUES (?, ?)',
                ['SELL_SHARES', `Sold ${quantity} shares at ${sell_price}`]);
            
            res.redirect('/holdings');
        });
    });
});

// Audit log route
app.get('/audit', (req, res) => {
    db.all('SELECT * FROM audit_log ORDER BY timestamp DESC', [], (err, logs) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.render('audit', { logs });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
