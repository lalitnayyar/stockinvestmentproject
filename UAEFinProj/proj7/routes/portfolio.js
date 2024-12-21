const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

// Initialize database
const dbPath = path.join(__dirname, '../db/database.db');
console.log('Portfolio database path:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('Error connecting to portfolio database:', err);
        process.exit(1);
    }
});

// Apply auth middleware to all routes
router.use(authenticateToken);

// Get user's portfolio with total investment and profit/loss
router.get('/', function(req, res) {
    const userId = req.user.id;
    
    db.all(
        'SELECT * FROM portfolio WHERE user_id = ?',
        [userId],
        async (err, portfolio) => {
            if (err) {
                console.error('Error fetching portfolio:', err);
                return res.status(500).json({ error: 'Failed to fetch portfolio' });
            }

            try {
                let totalInvestment = 0;
                let currentValue = 0;

                // Get current prices and calculate values
                const portfolioWithPrices = await Promise.all(portfolio.map(async (item) => {
                    try {
                        const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}`);
                        const currentPrice = response.data.chart.result[0].meta.regularMarketPrice;
                        
                        const currentItemValue = currentPrice * item.quantity;
                        const investmentValue = item.purchase_price * item.quantity;
                        const profitLoss = currentItemValue - investmentValue;
                        const profitLossPercentage = ((profitLoss / investmentValue) * 100).toFixed(2);
                        
                        totalInvestment += investmentValue;
                        currentValue += currentItemValue;

                        return {
                            ...item,
                            current_price: currentPrice,
                            current_value: currentItemValue,
                            investment_value: investmentValue,
                            profit_loss: profitLoss,
                            profit_loss_percentage: profitLossPercentage
                        };
                    } catch (error) {
                        console.error(`Error fetching price for ${item.symbol}:`, error);
                        return {
                            ...item,
                            current_price: item.purchase_price,
                            current_value: item.purchase_price * item.quantity,
                            investment_value: item.purchase_price * item.quantity,
                            profit_loss: 0,
                            profit_loss_percentage: '0.00'
                        };
                    }
                }));

                const totalProfitLoss = currentValue - totalInvestment;
                const totalProfitLossPercentage = ((totalProfitLoss / totalInvestment) * 100).toFixed(2);

                res.json({
                    portfolio: portfolioWithPrices,
                    summary: {
                        total_investment: totalInvestment,
                        current_value: currentValue,
                        total_profit_loss: totalProfitLoss,
                        total_profit_loss_percentage: totalProfitLossPercentage
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
router.post('/add', function(req, res) {
    const { symbol, quantity, purchase_price, purchase_date } = req.body;
    const userId = req.user.id;
    
    db.run('BEGIN TRANSACTION', function(err) {
        if (err) {
            console.error('Error starting transaction:', err);
            return res.status(500).json({ error: 'Failed to process purchase' });
        }

        // Add to portfolio
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
                console.log(userId, symbol, quantity, purchase_price, "insert into transactions");
                db.run(
                    'INSERT INTO transactions (user_id, symbol, quantity, price, transaction_type, transaction_date) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                    [userId, symbol, quantity, purchase_price, 'BUY'],
                    function(err) {
                        if (err) {
                            console.error('Error recording transaction:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to record transaction' });
                        }

                        db.run('COMMIT', function(err) {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Failed to complete purchase' });
                            }
                            res.json({ 
                                message: 'Stock added successfully',
                                portfolio_id: portfolioId,
                                transaction_id: this.lastID
                            });
                        });
                    }
                );
            }
        );
    });
});

// Sell stock
router.post('/sell', function(req, res) {
    const { symbol, quantity, sell_price } = req.body;
    const userId = req.user.id;
    console.log(userId, symbol, quantity, sell_price, "/sell");
    // Check if user has enough stocks to sell
    db.get(
        'SELECT SUM(quantity) as total_quantity FROM portfolio WHERE user_id = ? AND symbol = ?',
        [userId, symbol],
        function(err, row) {
            if (err) {
                console.error('Error checking stock quantity:', err);
                return res.status(500).json({ error: 'Failed to process sale' });
            }

            if (!row || row.total_quantity < quantity) {
                return res.status(400).json({ error: 'Insufficient quantity' });
            }

            // Begin transaction
            db.run('BEGIN TRANSACTION', function(err) {
                if (err) {
                    console.error('Error starting transaction:', err);
                    return res.status(500).json({ error: 'Failed to process sale' });
                }

                // Record transaction first
                console.log(userId, symbol, quantity, sell_price, "insert into transactions ***");
                db.run(
                    'INSERT INTO transactions (user_id, symbol, quantity, price, transaction_type, transaction_date) VALUES (?, ?, ?, ?, ?, datetime("now"))',
                    [userId, symbol, quantity, sell_price, 'SELL'],
                    function(err) {
                        if (err) {
                            console.error('Error recording transaction:', err);
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Failed to record transaction' });
                        }

                        const transactionId = this.lastID;

                        // Add to sold_stocks
                        db.run(
                            'INSERT INTO sold_stocks (user_id, symbol, quantity, sell_price, sell_date) VALUES (?, ?, ?, ?, datetime("now"))',
                            [userId, symbol, quantity, sell_price],
                            function(err) {
                                if (err) {
                                    console.error('Error recording sale:', err);
                                    db.run('ROLLBACK');
                                    return res.status(500).json({ error: 'Failed to record sale' });
                                }

                                // Update portfolio quantity
                                const query = `SELECT id, quantity, purchase_date 
                                             FROM portfolio 
                                             WHERE user_id = ? AND symbol = ? 
                                             ORDER BY purchase_date ASC`;
                                
                                db.all(query, [userId, symbol], function(err, rows) {
                                    if (err) {
                                        console.error('Error fetching portfolio rows:', err);
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Failed to process sale' });
                                    }

                                    let remainingQuantityToSell = quantity;
                                    const updates = [];

                                    for (const row of rows) {
                                        if (remainingQuantityToSell <= 0) break;

                                        const quantityToSell = Math.min(row.quantity, remainingQuantityToSell);
                                        remainingQuantityToSell -= quantityToSell;

                                        if (row.quantity === quantityToSell) {
                                            updates.push(new Promise((resolve, reject) => {
                                                db.run(
                                                    'DELETE FROM portfolio WHERE id = ?',
                                                    [row.id],
                                                    function(err) {
                                                        if (err) reject(err);
                                                        else resolve();
                                                    }
                                                );
                                            }));
                                        } else {
                                            updates.push(new Promise((resolve, reject) => {
                                                db.run(
                                                    'UPDATE portfolio SET quantity = quantity - ? WHERE id = ?',
                                                    [quantityToSell, row.id],
                                                    function(err) {
                                                        if (err) reject(err);
                                                        else resolve();
                                                    }
                                                );
                                            }));
                                        }
                                    }

                                    Promise.all(updates)
                                        .then(() => {
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
                                        })
                                        .catch(err => {
                                            console.error('Error updating portfolio:', err);
                                            db.run('ROLLBACK');
                                            return res.status(500).json({ error: 'Failed to update portfolio' });
                                        });
                                });
                            }
                        );
                    }
                );
            });
        }
    );
});

// Get transaction history with search criteria
router.get('/transactions', function(req, res) {
    const userId = req.user.id;
    const { symbol, type, startDate, endDate, page = 1, limit = 10, print = false } = req.query;
    
    let params = [userId];
    let conditions = ['t.user_id = ?'];
    
    if (symbol) {
        conditions.push('t.stock_symbol LIKE ?');
        params.push(`%${symbol}%`);
    }
    
    if (type) {
        conditions.push('t.transaction_type = ?');
        params.push(type.toUpperCase());
    }
    
    if (startDate) {
        conditions.push('date(t.transaction_date) >= date(?)');
        params.push(startDate);
    }
    
    if (endDate) {
        conditions.push('date(t.transaction_date) <= date(?)');
        params.push(endDate);
    }

    // Get total count for pagination (only if not printing)
    const countQuery = `
        SELECT COUNT(*) as total
        FROM transactions t
        WHERE ${conditions.join(' AND ')}
    `;
    
    // Get filtered transactions
    const query = `
        SELECT 
            t.id,
            t.user_id,
            t.stock_symbol,
            t.quantity,
            t.price,
            t.transaction_type,
            t.transaction_date,
            s.name as stock_name,
            (t.quantity * t.price) as total_amount
        FROM transactions t
        LEFT JOIN stocks s ON t.stock_symbol = s.symbol
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.transaction_date DESC
        ${!print ? 'LIMIT ? OFFSET ?' : ''}
    `;
    
    // Get transaction statistics
    const statsQuery = `
        SELECT 
            COUNT(*) as total_transactions,
            SUM(CASE WHEN transaction_type = 'BUY' THEN 1 ELSE 0 END) as total_buys,
            SUM(CASE WHEN transaction_type = 'SELL' THEN 1 ELSE 0 END) as total_sells,
            SUM(CASE WHEN transaction_type = 'BUY' THEN quantity * price ELSE 0 END) as total_invested,
            SUM(CASE WHEN transaction_type = 'SELL' THEN quantity * price ELSE 0 END) as total_sold
        FROM transactions
        WHERE user_id = ?
        ${symbol ? 'AND stock_symbol LIKE ?' : ''}
        ${type ? 'AND transaction_type = ?' : ''}
        ${startDate ? 'AND date(transaction_date) >= date(?)' : ''}
        ${endDate ? 'AND date(transaction_date) <= date(?)' : ''}
    `;

    // Get user info for print header
    const userQuery = `
        SELECT username, email
        FROM users
        WHERE id = ?
    `;
    
    if (print) {
        // For print view, get all data without pagination
        Promise.all([
            new Promise((resolve, reject) => {
                db.all(query, params, (err, transactions) => {
                    if (err) reject(err);
                    else resolve(transactions);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(statsQuery, params, (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(userQuery, [userId], (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            })
        ]).then(([transactions, stats, user]) => {
            res.json({
                transactions,
                stats,
                user,
                filters: {
                    symbol,
                    type,
                    startDate,
                    endDate
                },
                generated_at: new Date().toISOString()
            });
        }).catch(err => {
            console.error('Error preparing print data:', err);
            res.status(500).json({ error: 'Failed to prepare print data' });
        });
    } else {
        // For normal view, use pagination
        const offset = (page - 1) * limit;
        
        db.get(countQuery, params, function(err, countRow) {
            if (err) {
                console.error('Error getting transaction count:', err);
                return res.status(500).json({ error: 'Failed to fetch transactions' });
            }
            
            const totalCount = countRow.total;
            const totalPages = Math.ceil(totalCount / limit);
            
            // Get transactions with pagination
            db.all(query, [...params, limit, offset], function(err, transactions) {
                if (err) {
                    console.error('Error fetching transactions:', err);
                    return res.status(500).json({ error: 'Failed to fetch transactions' });
                }
                
                // Get statistics
                db.get(statsQuery, params, function(err, stats) {
                    if (err) {
                        console.error('Error fetching transaction stats:', err);
                        return res.status(500).json({ error: 'Failed to fetch transaction stats' });
                    }
                    
                    res.json({
                        transactions,
                        pagination: {
                            total: totalCount,
                            current_page: page,
                            total_pages: totalPages,
                            limit
                        },
                        stats: {
                            total_transactions: stats.total_transactions,
                            total_buys: stats.total_buys,
                            total_sells: stats.total_sells,
                            total_invested: stats.total_invested,
                            total_sold: stats.total_sold,
                            net_position: stats.total_sold - stats.total_invested
                        }
                    });
                });
            });
        });
    }
});

// Get printable transaction history
router.get('/transactions/print', function(req, res) {
    const userId = req.user.id;
    const { symbol, type, startDate, endDate } = req.query;
    
    let params = [userId];
    let conditions = ['t.user_id = ?'];
    
    if (symbol) {
        conditions.push('t.stock_symbol LIKE ?');
        params.push(`%${symbol}%`);
    }
    
    if (type) {
        conditions.push('t.transaction_type = ?');
        params.push(type.toUpperCase());
    }
    
    if (startDate) {
        conditions.push('date(t.transaction_date) >= date(?)');
        params.push(startDate);
    }
    
    if (endDate) {
        conditions.push('date(t.transaction_date) <= date(?)');
        params.push(endDate);
    }

    // Get all transactions for printing
    const query = `
        SELECT 
            t.id,
            t.stock_symbol,
            s.name as stock_name,
            t.quantity,
            t.price,
            (t.quantity * t.price) as total_amount,
            t.transaction_type,
            t.transaction_date
        FROM transactions t
        LEFT JOIN stocks s ON t.stock_symbol = s.symbol
        WHERE ${conditions.join(' AND ')}
        ORDER BY t.transaction_date DESC
    `;
    
    // Get transaction statistics
    const statsQuery = `
        SELECT 
            COUNT(*) as total_transactions,
            SUM(CASE WHEN transaction_type = 'BUY' THEN 1 ELSE 0 END) as total_buys,
            SUM(CASE WHEN transaction_type = 'SELL' THEN 1 ELSE 0 END) as total_sells,
            SUM(CASE WHEN transaction_type = 'BUY' THEN quantity * price ELSE 0 END) as total_invested,
            SUM(CASE WHEN transaction_type = 'SELL' THEN quantity * price ELSE 0 END) as total_sold
        FROM transactions
        WHERE user_id = ?
        ${symbol ? 'AND stock_symbol LIKE ?' : ''}
        ${type ? 'AND transaction_type = ?' : ''}
        ${startDate ? 'AND date(transaction_date) >= date(?)' : ''}
        ${endDate ? 'AND date(transaction_date) <= date(?)' : ''}
    `;
    
    db.all(query, params, function(err, transactions) {
        if (err) {
            console.error('Error fetching transactions for print:', err);
            return res.status(500).json({ error: 'Failed to fetch transactions' });
        }
        
        db.get(statsQuery, params, function(err, stats) {
            if (err) {
                console.error('Error fetching transaction stats for print:', err);
                return res.status(500).json({ error: 'Failed to fetch transaction stats' });
            }
            
            res.json({
                transactions,
                stats,
                filters: {
                    symbol,
                    type,
                    startDate,
                    endDate
                },
                generated_at: new Date().toISOString()
            });
        });
    });
});

// Get portfolio chart data
router.get('/chart', function(req, res) {
    const userId = req.user.id;
    const { period = '1M' } = req.query;  // Default to 1 month

    // Calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();
    switch(period) {
        case '1W':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '1M':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case '3M':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
        case '6M':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
        case '1Y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
        case 'ALL':
            // Get earliest transaction date
            db.get(
                'SELECT MIN(transaction_date) as first_date FROM transactions WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err || !row.first_date) {
                        startDate.setFullYear(startDate.getFullYear() - 1); // Default to 1 year
                    } else {
                        startDate = new Date(row.first_date);
                    }
                }
            );
            break;
    }

    // Get daily portfolio value within date range
    const query = `
        WITH RECURSIVE dates(date) AS (
            SELECT date(?)
            UNION ALL
            SELECT date(date, '+1 day')
            FROM dates
            WHERE date < date(?)
        ),
        daily_transactions AS (
            SELECT 
                date(transaction_date) as date,
                stock_symbol as symbol,
                CASE 
                    WHEN transaction_type = 'BUY' THEN quantity
                    ELSE -quantity
                END as quantity,
                price
            FROM transactions
            WHERE user_id = ? 
            AND date(transaction_date) <= date(?)
        ),
        cumulative_holdings AS (
            SELECT 
                d.date,
                dt.symbol,
                SUM(COALESCE(dt.quantity, 0)) OVER (
                    PARTITION BY dt.symbol 
                    ORDER BY d.date
                ) as quantity
            FROM dates d
            LEFT JOIN daily_transactions dt ON d.date >= dt.date
            WHERE quantity > 0
            GROUP BY d.date, dt.symbol
        )
        SELECT 
            d.date,
            COALESCE(
                SUM(
                    CASE 
                        WHEN ch.quantity > 0 THEN 
                            ch.quantity * COALESCE(
                                (
                                    SELECT price 
                                    FROM daily_transactions dt2 
                                    WHERE dt2.symbol = ch.symbol 
                                    AND dt2.date <= d.date 
                                    ORDER BY dt2.date DESC 
                                    LIMIT 1
                                ),
                                (
                                    SELECT price 
                                    FROM transactions 
                                    WHERE stock_symbol = ch.symbol 
                                    AND date(transaction_date) <= d.date 
                                    ORDER BY transaction_date DESC 
                                    LIMIT 1
                                )
                            )
                        ELSE 0 
                    END
                ),
                0
            ) as portfolio_value
        FROM dates d
        LEFT JOIN cumulative_holdings ch ON d.date = ch.date
        GROUP BY d.date
        ORDER BY d.date
    `;

    db.all(query, [startDate.toISOString(), endDate.toISOString(), userId, endDate.toISOString()], (err, rows) => {
        if (err) {
            console.error('Error fetching portfolio chart data:', err);
            return res.status(500).json({ error: 'Failed to fetch portfolio chart data' });
        }

        // Calculate additional metrics
        let previousValue = rows[0]?.portfolio_value || 0;
        const chartData = rows.map(row => {
            const currentValue = row.portfolio_value;
            const dailyChange = currentValue - previousValue;
            const dailyChangePercent = previousValue ? (dailyChange / previousValue) * 100 : 0;
            previousValue = currentValue;

            return {
                date: row.date,
                value: currentValue,
                daily_change: dailyChange,
                daily_change_percent: dailyChangePercent
            };
        });

        // Calculate overall metrics
        const totalDays = chartData.length;
        const startValue = chartData[0]?.value || 0;
        const endValue = chartData[totalDays - 1]?.value || 0;
        const totalChange = endValue - startValue;
        const totalChangePercent = startValue ? (totalChange / startValue) * 100 : 0;
        const maxValue = Math.max(...chartData.map(d => d.value));
        const minValue = Math.min(...chartData.map(d => d.value));

        res.json({
            chart_data: chartData,
            metrics: {
                start_value: startValue,
                end_value: endValue,
                total_change: totalChange,
                total_change_percent: totalChangePercent,
                max_value: maxValue,
                min_value: minValue,
                period_days: totalDays
            }
        });
    });
});

module.exports = router;
