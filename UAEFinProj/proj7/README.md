# UAE Stock Portfolio Application

A web application for managing UAE stock investments with real-time portfolio tracking and trading capabilities.

## Features

- User Authentication (Register/Login)
- Stock Search and Trading
- Portfolio Management
- Transaction History
- Real-time Stock Price Updates
- Responsive Design

## Prerequisites

- Node.js (v14 or higher)
- SQLite3

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. (Optional) Reset the server:
   ```bash
   npm run start:reset
   ```

5. Access the application at `http://localhost:3000`

## Technology Stack

- Backend: Node.js with Express
- Database: SQLite3
- Frontend: HTML5, CSS3, JavaScript
- UI Framework: Bootstrap 5
- Authentication: JWT

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user

### Portfolio
- GET `/api/portfolio` - Get user's portfolio
- POST `/api/portfolio/buy` - Buy stock
- POST `/api/portfolio/sell` - Sell stock
- GET `/api/portfolio/transactions` - Get transaction history

### Stocks
- GET `/api/stocks` - Get all UAE stocks
- GET `/api/stocks/:symbol` - Get single stock details
- GET `/api/stocks/search/:query` - Search stocks
- POST `/api/stocks/update-prices` - Update stock prices

## Security

- Password hashing using bcrypt
- JWT-based authentication
- Input validation and sanitization
- CORS enabled
- Protected API endpoints

## License

MIT
Navigation Menu:
Dashboard
Portfolio
Stocks
Transactions
Dashboard Module:
Portfolio overview with performance chart
Portfolio summary
Market overview with top gainers and losers
Portfolio Module:
Current holdings with detailed information
Add new stock form with Yahoo Finance integration
Profit/loss tracking for each position
Stocks Module:
Real-time stock search
Detailed stock information
Trading functionality
Market overview
Transactions Module:
Complete transaction history
Filtering and sorting capabilities
Transaction details with dates and prices
UI Improvements:
Modern and clean design
Responsive layout
Animated transitions
Toast notifications
Interactive charts
Bootstrap icons
To use the application:

Login or register to access the features
Navigate between modules using the top menu
In the Portfolio module:
View your current holdings
Add new stocks with the form
Monitor profit/loss
In the Stocks module:
Search for stocks
View detailed information
Execute trades
Monitor your transaction history in the Transactions module
The application now provides a complete solution for managing UAE stock investments with real-time data and analytics.

Let me know if you want to test any specific feature or need help with anything else!