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
document.addEventListener('DOMContentLoaded', () => {
    loginBtn.addEventListener('click', () => showForm('login'));
    registerBtn.addEventListener('click', () => showForm('register'));
    logoutBtn.addEventListener('click', logout);
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    document.getElementById('submitTrade').addEventListener('click', handleTrade);

    // Check authentication status
    checkAuth();
});

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
            showAlert('Login successful', 'success');
            showModule('dashboard');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Login failed', 'error');
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
            showAlert('Registration successful', 'success');
            showModule('dashboard');
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Registration failed', 'error');
    }
}

function logout() {
    token = null;
    localStorage.removeItem('token');
    checkAuth();
    showAlert('Logged out successfully', 'success');
}

async function checkAuth() {
    if (token) {
        authButtons.classList.add('d-none');
        userInfo.classList.remove('d-none');
        authForms.classList.add('d-none');
        mainContent.classList.remove('d-none');
        
        // Load initial data
        showModule('dashboard');
    } else {
        authButtons.classList.remove('d-none');
        userInfo.classList.add('d-none');
        authForms.classList.remove('d-none');
        mainContent.classList.add('d-none');
    }
}

async function handleTrade() {
    const symbol = document.getElementById('tradeSymbol').value;
    const type = document.getElementById('tradeType').value;
    const quantity = parseInt(document.getElementById('tradeQuantity').value);
    const price = parseFloat(document.getElementById('tradePrice').value);
    
    if (!symbol || !quantity || !price) {
        showAlert('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/portfolio/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                symbol,
                quantity,
                price
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            showAlert(`${type.toUpperCase()} order executed successfully`, 'success');
            tradeModal.hide();
            
            // Refresh portfolio data
            portfolioModule.loadPortfolio();
            loadTransactionHistory();
        } else {
            showAlert(data.error, 'error');
        }
    } catch (error) {
        showAlert('Trade execution failed', 'error');
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Show dashboard by default for authenticated users
    if (token) {
        showModule('dashboard');
    }
});
