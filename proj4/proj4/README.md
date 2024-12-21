# Share Investment Ledger

A web application for managing share investments, built with Node.js and SQLite.

## Features

- Add and manage stocks
- Track share holdings
- Record buy/sell transactions
- View audit log of all activities

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

The application will be available at `http://localhost:3000`

## Database

The application uses SQLite as the database. The database file (`investment.db`) will be created automatically when you first run the application.

## Modules

1. **Stocks Module**
   - Add new stocks
   - View list of available stocks

2. **Holdings Module**
   - Add new holdings
   - View current holdings
   - Sell shares

3. **Audit Log**
   - View history of all transactions and changes
   - Automatic logging of all activities
