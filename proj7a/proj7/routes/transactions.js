const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

// Initialize database
const dbPath = path.join(__dirname, '../db/database.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);

// Apply auth middleware to all routes
router.use(authenticateToken);

// Get all transactions with optional filters
router.get('/', function(req, res) {
    const userId = req.user.id;
    const {
        symbol,
        type,
        startDate,
        endDate,
        page = 1,
        limit = 10
    } = req.query;

    const offset = (page - 1) * limit;
    let params = [userId];
    let whereClause = 'WHERE user_id = ?';

    if (symbol) {
        whereClause += ' AND symbol = ?';
        params.push(symbol);
    }

    if (type) {
        whereClause += ' AND transaction_type = ?';
        params.push(type.toUpperCase());
    }

    if (startDate) {
        whereClause += ' AND transaction_date >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND transaction_date <= ?';
        params.push(endDate);
    }

    // Get total count for pagination
    db.get(
        `SELECT COUNT(*) as total FROM transactions ${whereClause}`,
        params,
        (err, row) => {
            if (err) {
                console.error('Error counting transactions:', err);
                return res.status(500).json({ error: 'Failed to fetch transactions' });
            }

            const total = row.total;
            const totalPages = Math.ceil(total / limit);

            // Get paginated results
            params.push(limit, offset);
            db.all(
                `SELECT t.*, s.name as stock_name, s.current_price
                 FROM transactions t
                 LEFT JOIN stocks s ON t.symbol = s.symbol
                 ${whereClause}
                 ORDER BY transaction_date DESC
                 LIMIT ? OFFSET ?`,
                params,
                (err, transactions) => {
                    if (err) {
                        console.error('Error fetching transactions:', err);
                        return res.status(500).json({ error: 'Failed to fetch transactions' });
                    }

                    res.json({
                        transactions,
                        pagination: {
                            total,
                            totalPages,
                            currentPage: parseInt(page),
                            limit: parseInt(limit)
                        }
                    });
                }
            );
        }
    );
});

// Get transaction statistics
router.get('/stats', function(req, res) {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    let params = [userId];
    let whereClause = 'WHERE user_id = ?';

    if (startDate) {
        whereClause += ' AND transaction_date >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND transaction_date <= ?';
        params.push(endDate);
    }

    db.all(
        `SELECT 
            COUNT(*) as total_transactions,
            SUM(CASE WHEN transaction_type = 'BUY' THEN 1 ELSE 0 END) as total_buys,
            SUM(CASE WHEN transaction_type = 'SELL' THEN 1 ELSE 0 END) as total_sells,
            SUM(CASE WHEN transaction_type = 'BUY' THEN price * quantity ELSE 0 END) as total_invested,
            SUM(CASE WHEN transaction_type = 'SELL' THEN price * quantity ELSE 0 END) as total_sold
         FROM transactions ${whereClause}`,
        params,
        (err, rows) => {
            if (err) {
                console.error('Error fetching transaction stats:', err);
                return res.status(500).json({ error: 'Failed to fetch transaction statistics' });
            }

            res.json(rows[0]);
        }
    );
});

module.exports = router;
