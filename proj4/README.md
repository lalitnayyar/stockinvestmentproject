# Share Investment Ledger

A comprehensive web application for managing share investments in both international and UAE markets, built with Node.js, Express, and SQLite.

## Features

### Portfolio Management
- Track multiple stock portfolios (International and UAE markets)
- Real-time stock price updates
- Automatic calculation of total portfolio value
- Profit/Loss tracking per stock and overall portfolio
- Portfolio summary dashboard with key metrics

### Stock Management
- Add and manage stocks from different markets
- Real-time stock symbol search and validation
- Track individual stock performance
- Record purchase price and date
- Monitor current market prices
- Calculate profit/loss per position

### Transaction Management
- Record buy transactions with details:
  - Purchase price
  - Number of shares
  - Purchase date
  - Purchase source
  - Additional notes
- Record sell transactions with:
  - Selling price
  - Number of shares sold
  - Sale date
  - Automatic profit/loss calculation

### UAE Stocks Module
- Dedicated section for UAE market stocks
- Real-time UAE stock price tracking
- Portfolio summary specific to UAE investments
- Advanced features:
  - Sortable tables (by symbol, name, shares, price, value, profit/loss)
  - Print functionality for reports and portfolio statements
  - Custom stock symbol search for UAE markets

### Audit and History
- Complete audit log of all activities
- Transaction history tracking
- Historical performance tracking
- Detailed activity timestamps

### User Interface
- Clean, responsive Bootstrap-based design
- Interactive data tables
- Real-time updates
- Print-friendly layouts
- Sorting and filtering capabilities
- Mobile-friendly design

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Running the Application

To start the application in development mode:
```bash
npm run dev
```

To start the application in production mode:
```bash
npm start
```

The application will be available at `http://localhost:3003`

## Database

The application uses SQLite as the database. The database file (`investment.db`) will be created automatically when you first run the application. The schema includes tables for:
- Stocks (International)
- UAE Stocks
- Transactions
- Sell Transactions
- Audit Log

## API Integration

- Yahoo Finance API for international stock data
- Custom UAE market data integration
- Real-time price updates every 5 minutes

## Modules

1. **International Stocks Module**
   - Add and manage international stocks
   - Real-time price updates
   - Transaction recording
   - Performance tracking

2. **UAE Stocks Module**
   - Dedicated UAE market tracking
   - Real-time local market updates
   - Print-friendly portfolio reports
   - Sortable stock tables

3. **Holdings Module**
   - Comprehensive portfolio view
   - Current position tracking
   - Profit/loss calculations
   - Historical performance

4. **Transactions Module**
   - Buy/sell transaction recording
   - Transaction history
   - Profit/loss per transaction
   - Audit trail

5. **Reports Module**
   - Portfolio summaries
   - Performance reports
   - Printable statements
   - Historical data tracking

## Security

- Input validation for all forms
- SQL injection protection
- Secure database operations
- Error handling and logging

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
