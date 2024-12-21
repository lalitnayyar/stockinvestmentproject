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
    db.run(`DROP TABLE IF EXISTS uae_stocks`);
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

    // UAE Stocks table
    db.run(`CREATE TABLE IF NOT EXISTS uae_stocks (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        currency TEXT DEFAULT 'AED'
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

// Function to update UAE stock information
async function updateUAEStockInfo(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol + '.AE');  // Append .AE for UAE market
        return {
            name: quote.longName || quote.shortName,
            currentPrice: quote.regularMarketPrice,
            change: quote.regularMarketChangePercent
        };
    } catch (err) {
        console.error(`Error fetching UAE stock info for ${symbol}:`, err);
        throw err;
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
        const results = await yahooFinance.search(query, { 
            newsCount: 0,
            quotesCount: 10,
            enableNavLinks: false,
            enableEnhancedTrivialQuery: true
        });
        
        const stocks = results.quotes
            .filter(quote => quote.quoteType === 'EQUITY')
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname,
                exchange: quote.exchange
            }));
            
        return stocks;
    } catch (err) {
        console.error('Error searching stocks:', err);
        return [];
    }
}

// Function to search UAE stock symbols
async function searchUAEStockSymbols(query) {
    try {
        const results = await yahooFinance.search(query, { 
            newsCount: 0,
            quotesCount: 5,
            enableFuzzyQuery: true,
            enableNavLinks: false,
            enableEnhancedTrivialQuery: true
        });
        
        // Filter for UAE market symbols and format results
        return results.quotes
            .filter(quote => quote.exchange === 'DFM' || quote.exchange === 'ADX')
            .map(quote => ({
                symbol: quote.symbol.replace('.AE', ''),
                name: quote.shortname || quote.longname,
                exchange: quote.exchange
            }));
    } catch (error) {
        console.error('Error searching UAE stocks:', error);
        throw error;
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

// Function to calculate UAE portfolio summary
function calculateUAEPortfolioSummary(stocks) {
    const summary = {
        totalValue: 0,
        totalInvestment: 0,
        totalProfitLoss: 0
    };

    stocks.forEach(stock => {
        const currentPrice = stock.current_price || stock.purchase_price;
        const currentValue = stock.shares * currentPrice;
        const investment = stock.shares * stock.purchase_price;
        const profitLoss = currentValue - investment;

        summary.totalValue += currentValue;
        summary.totalInvestment += investment;
        summary.totalProfitLoss += profitLoss;
    });

    return summary;
}

// Function to add a stock entry
async function addStock(symbol, shares, purchasePrice, purchaseDate, purchaseSource, notes) {
    try {
        const stockInfo = await updateStockInfo(symbol);
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO stocks (symbol, name, shares, purchase_price, purchase_date, purchase_source, notes, current_price, last_updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [symbol, stockInfo.name, shares, purchasePrice, purchaseDate, purchaseSource, notes, stockInfo.currentPrice, new Date().toISOString()],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });
    } catch (error) {
        throw new Error(`Failed to add stock: ${error.message}`);
    }
}

// Function to add a UAE stock entry
async function addUAEStock(symbol, shares, purchasePrice, purchaseDate, purchaseSource, notes) {
    try {
        const stockInfo = await updateUAEStockInfo(symbol);
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO uae_stocks (symbol, name, shares, purchase_price, purchase_date, purchase_source, notes, current_price, last_updated, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [symbol, stockInfo.name, shares, purchasePrice, purchaseDate, purchaseSource, notes, stockInfo.currentPrice, new Date().toISOString(), 'AED'],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });
    } catch (error) {
        throw new Error(`Failed to add UAE stock: ${error.message}`);
    }
}

// Function to log audit entry
async function addAuditLog(action, details) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO audit_log (action, details) VALUES (?, ?)',
            [action, details],
            (err) => {
                if (err) reject(err);
                resolve();
            }
        );
    });
}

// Function to add a UAE stock sell transaction
async function addUAEStockSellTransaction(stockId, sharesSold, sellPrice, sellDate) {
    try {
        // Get stock info for profit/loss calculation
        const stock = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM uae_stocks WHERE id = ?', [stockId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!stock) {
            throw new Error('Stock not found');
        }

        const profitLoss = (sellPrice - stock.purchase_price) * sharesSold;

        // Insert sell transaction
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO sell_transactions (stock_id, shares_sold, sell_price, sell_date, profit_loss) VALUES (?, ?, ?, ?, ?)',
                [stockId, sharesSold, sellPrice, sellDate, profitLoss],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });

        // Update remaining shares in stock
        const remainingShares = stock.shares - sharesSold;
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE uae_stocks SET shares = ? WHERE id = ?',
                [remainingShares, stockId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        return { transactionId: result, profitLoss };
    } catch (error) {
        throw new Error(`Failed to add sell transaction: ${error.message}`);
    }
}

// Schedule stock updates every 5 minutes
setInterval(updateAllStocks, 5 * 60 * 1000);

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

// Stock search API endpoint
app.get('/api/search-stocks', async (req, res) => {
    if (!req.query.q) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    const query = req.query.q;
    
    try {
        const results = await yahooFinance.search(query, { 
            newsCount: 0,
            quotesCount: 10,
            enableNavLinks: false,
            enableEnhancedTrivialQuery: true
        });
        
        const stocks = results.quotes
            .filter(quote => quote.quoteType === 'EQUITY')
            .map(quote => ({
                symbol: quote.symbol,
                name: quote.shortname || quote.longname,
                exchange: quote.exchange
            }));
            
        res.json(stocks);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search stocks' });
    }
});

// UAE Stock symbol search endpoint
app.get('/api/uae-stocks/search', async (req, res) => {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
        return res.json([]);
    }

    try {
        const results = await searchUAEStockSymbols(query);
        res.json(results);
    } catch (error) {
        console.error('Error searching stocks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current stock price
app.get('/api/stock-price', async (req, res) => {
    const { symbol } = req.query;
    
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    try {
        const quote = await yahooFinance.quote(symbol);
        res.json({ 
            price: quote.regularMarketPrice,
            currency: quote.currency
        });
    } catch (error) {
        console.error('Error fetching stock price:', error);
        res.status(500).json({ error: 'Failed to fetch stock price' });
    }
});

// Stock routes
app.get('/stocks', async (req, res) => {
    db.all('SELECT * FROM stocks', [], (err, stocks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

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

// UAE Stocks routes
app.get('/uae-stocks', async (req, res) => {
    db.all('SELECT * FROM uae_stocks', [], (err, stocks) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const summary = calculateUAEPortfolioSummary(stocks);
        
        res.render('uae_stocks', { 
            stocks, 
            summary,
            moment: moment,
            defaultDate: moment().format('YYYY-MM-DD')
        });
    });
});

app.post('/api/uae-stocks', async (req, res) => {
    const { symbol, shares, purchase_price, purchase_date, purchase_source, notes } = req.body;
    
    try {
        // First, check if the stock already exists in UAE stocks table
        const existingStock = await new Promise((resolve, reject) => {
            db.get('SELECT id, shares FROM uae_stocks WHERE symbol = ?', [symbol], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        let stockId;
        if (existingStock) {
            // Update existing stock with additional shares
            const totalShares = existingStock.shares + shares;
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE uae_stocks SET shares = ? WHERE id = ?',
                    [totalShares, existingStock.id],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });
            stockId = existingStock.id;
        } else {
            // Add new UAE stock entry
            stockId = await addUAEStock(symbol, shares, purchase_price, purchase_date, purchase_source, notes);
        }

        // Log the addition
        await addAuditLog('INSERT', `Added ${shares} shares of ${symbol} (UAE)`);

        res.status(200).json({ message: 'UAE Stock added successfully' });
    } catch (error) {
        console.error('Error adding UAE stock:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/uae-stocks/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Get stock info for audit log
        const stock = await new Promise((resolve, reject) => {
            db.get('SELECT symbol FROM uae_stocks WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        // Delete the stock
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM uae_stocks WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Log the deletion
        await addAuditLog('DELETE', `Deleted UAE stock ${stock.symbol}`);

        res.json({ message: 'UAE Stock deleted successfully' });
    } catch (error) {
        console.error('Error deleting UAE stock:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/uae-stocks/:id/sell', async (req, res) => {
    const { id } = req.params;
    const { shares_sold, sell_price, sell_date } = req.body;

    try {
        // Validate input
        if (!shares_sold || !sell_price || !sell_date) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if stock exists and has enough shares
        const stock = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM uae_stocks WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!stock) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        if (stock.shares < shares_sold) {
            return res.status(400).json({ error: 'Insufficient shares' });
        }

        // Process sell transaction
        const result = await addUAEStockSellTransaction(id, shares_sold, sell_price, sell_date);

        // Add audit log
        await addAuditLog(
            'SELL',
            `Sold ${shares_sold} shares of ${stock.symbol} at AED ${sell_price} (Profit/Loss: AED ${result.profitLoss.toFixed(2)})`
        );

        res.json({ 
            message: 'Stock sold successfully',
            profitLoss: result.profitLoss
        });
    } catch (error) {
        console.error('Error selling stock:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/uae-stocks/:id', async (req, res) => {
    const { id } = req.params;
    const { shares, purchase_price, purchase_date, purchase_source, notes } = req.body;

    try {
        // Get current stock data for audit log
        const oldStock = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM uae_stocks WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!oldStock) {
            return res.status(404).json({ error: 'Stock not found' });
        }

        // Update stock
        await new Promise((resolve, reject) => {
            db.run(
                'UPDATE uae_stocks SET shares = ?, purchase_price = ?, purchase_date = ?, purchase_source = ?, notes = ? WHERE id = ?',
                [shares, purchase_price, purchase_date, purchase_source, notes, id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Create detailed audit log of changes
        const changes = [];
        if (shares !== oldStock.shares) changes.push(`shares: ${oldStock.shares} → ${shares}`);
        if (purchase_price !== oldStock.purchase_price) changes.push(`price: ${oldStock.purchase_price} → ${purchase_price}`);
        if (purchase_date !== oldStock.purchase_date) changes.push(`date: ${oldStock.purchase_date} → ${purchase_date}`);

        await addAuditLog(
            'UPDATE',
            `Updated ${oldStock.symbol}: ${changes.join(', ')}`
        );

        res.json({ message: 'Stock updated successfully' });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ error: error.message });
    }
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

// Add new stock to stocks
app.post('/api/stocks', async (req, res) => {
    const { symbol, shares, purchase_price, purchase_date, purchase_source, notes } = req.body;
    
    try {
        // First, check if the stock already exists in stocks table
        const existingStock = await new Promise((resolve, reject) => {
            db.get('SELECT id, shares FROM stocks WHERE symbol = ?', [symbol], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        let stockId;
        if (existingStock) {
            // Update existing stock with additional shares
            const totalShares = existingStock.shares + shares;
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE stocks SET shares = ? WHERE id = ?',
                    [totalShares, existingStock.id],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });
            stockId = existingStock.id;
        } else {
            // Add new stock entry
            stockId = await addStock(symbol, shares, purchase_price, purchase_date, purchase_source, notes);
        }

        // Log the addition
        await addAuditLog('INSERT', `Added ${shares} shares of ${symbol}`);

        res.status(200).json({ message: 'Stock added successfully' });
    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
