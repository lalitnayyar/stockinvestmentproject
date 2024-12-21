// Global state
let token = localStorage.getItem('token');
let currentUser = null;

// DOM Elements
const authButtons = document.getElementById('auth-buttons');
const userInfo = document.getElementById('user-info');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authForms = document.getElementById('auth-forms');
const mainContent = document.getElementById('main-content');
const tradeModal = new bootstrap.Modal(document.getElementById('tradeModal'));

// Event Listeners
loginBtn.addEventListener('click', () => showForm('login'));
registerBtn.addEventListener('click', () => showForm('register'));
logoutBtn.addEventListener('click', logout);
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
document.getElementById('searchBtn').addEventListener('click', searchStocks);
document.getElementById('submitTrade').addEventListener('click', submitTrade);

// Check authentication status on load
checkAuth();

// Authentication Functions
function showForm(type) {
    loginForm.classList.add('d-none');
    registerForm.classList.add('d-none');
    
    if (type === 'login') {
        loginForm.classList.remove('d-none');
    } else {
        registerForm.classList.remove('d-none');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            checkAuth();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Login failed');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = registerForm.querySelector('input[type="text"]').value;
    const email = registerForm.querySelector('input[type="email"]').value;
    const password = registerForm.querySelector('input[type="password"]').value;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        if (response.ok) {
            token = data.token;
            localStorage.setItem('token', token);
            checkAuth();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Registration failed');
    }
}

function logout() {
    token = null;
    localStorage.removeItem('token');
    checkAuth();
}

async function checkAuth() {
    if (token) {
        authButtons.classList.add('d-none');
        userInfo.classList.remove('d-none');
        authForms.classList.add('d-none');
        mainContent.classList.remove('d-none');
        loadPortfolio();
        loadTransactions();
    } else {
        authButtons.classList.remove('d-none');
        userInfo.classList.add('d-none');
        authForms.classList.remove('d-none');
        mainContent.classList.add('d-none');
    }
}

// Portfolio Functions
async function loadPortfolio() {
    try {
        const response = await fetch('/api/portfolio', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const portfolio = await response.json();
        displayPortfolio(portfolio);
    } catch (error) {
        alert('Failed to load portfolio');
    }
}

function displayPortfolio(portfolio) {
    const container = document.getElementById('portfolioSummary');
    
    if (portfolio.length === 0) {
        container.innerHTML = '<p>No stocks in portfolio</p>';
        return;
    }
    
    const html = portfolio.map(item => `
        <div class="portfolio-item">
            <div>
                <span class="symbol">${item.stock_symbol}</span>
                <span class="name">${item.stock_name}</span>
            </div>
            <div>
                <span class="quantity">${item.quantity} shares</span>
                <span class="price">@ AED ${item.current_price}</span>
                <span class="value">Total: AED ${(item.quantity * item.current_price).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Transaction Functions
async function loadTransactions() {
    try {
        const response = await fetch('/api/portfolio/transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const transactions = await response.json();
        displayTransactions(transactions);
    } catch (error) {
        alert('Failed to load transactions');
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionHistory');
    
    if (transactions.length === 0) {
        container.innerHTML = '<p>No transaction history</p>';
        return;
    }
    
    const html = transactions.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-${transaction.transaction_type.toLowerCase()}">
                ${transaction.transaction_type} ${transaction.quantity} ${transaction.stock_symbol}
                @ AED ${transaction.price}
            </div>
            <div class="transaction-date">
                ${new Date(transaction.transaction_date).toLocaleDateString()}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Stock Search Functions
async function searchStocks() {
    const query = document.getElementById('stockSearch').value;
    
    try {
        const response = await fetch(`/api/stocks/search/${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const stocks = await response.json();
        displaySearchResults(stocks);
    } catch (error) {
        alert('Search failed');
    }
}

function displaySearchResults(stocks) {
    const container = document.getElementById('searchResults');
    
    if (stocks.length === 0) {
        container.innerHTML = '<p>No stocks found</p>';
        return;
    }
    
    const html = stocks.map(stock => `
        <div class="stock-item" onclick="showTradeModal('${stock.symbol}', ${stock.current_price})">
            <div class="symbol">${stock.symbol}</div>
            <div class="name">${stock.name}</div>
            <div class="price">
                AED ${stock.current_price}
                <span class="${stock.change_percent >= 0 ? 'change-positive' : 'change-negative'}">
                    ${stock.change_percent}%
                </span>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Trading Functions
function showTradeModal(symbol, price) {
    document.getElementById('tradeSymbol').value = symbol;
    document.getElementById('tradePrice').value = price;
    tradeModal.show();
}

async function submitTrade() {
    const symbol = document.getElementById('tradeSymbol').value;
    const type = document.getElementById('tradeType').value;
    const quantity = parseInt(document.getElementById('tradeQuantity').value);
    const price = parseFloat(document.getElementById('tradePrice').value);
    
    try {
        const response = await fetch(`/api/portfolio/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ symbol, quantity, price })
        });
        
        const data = await response.json();
        if (response.ok) {
            tradeModal.hide();
            loadPortfolio();
            loadTransactions();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Trade failed');
    }
}
