const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token, authorization denied' });
        }

        // Verify token
        const decoded = jwt.verify(token, 'your_jwt_secret');
        
        // Add user data to request
        req.user = decoded;
        
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

module.exports = { authenticateToken };
