// Show alert toast
function showAlert(message, type = 'info') {
    const toast = document.getElementById('alertToast');
    const toastBody = toast.querySelector('.toast-body');
    
    // Set message and style
    toastBody.textContent = message;
    toast.className = `toast ${type === 'error' ? 'bg-danger' : type === 'success' ? 'bg-success' : 'bg-info'} text-white`;
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Show/hide modules
function showModule(moduleName) {
    // Hide all modules
    document.querySelectorAll('.module-content').forEach(module => {
        module.classList.add('d-none');
    });
    
    // Show selected module
    const selectedModule = document.getElementById(`${moduleName}-module`);
    if (selectedModule) {
        selectedModule.classList.remove('d-none');
        
        // Load module data
        switch (moduleName) {
            case 'dashboard':
                portfolioModule.loadPortfolio();
                stocksModule.loadMarketOverview();
                break;
            case 'portfolio':
                portfolioModule.loadPortfolio();
                break;
            case 'stocks':
                stocksModule.loadMarketOverview();
                break;
            case 'transactions':
                loadTransactionHistory();
                break;
        }
    }
}

// Load transaction history
async function loadTransactionHistory(filters = {}) {
    try {
        const queryParams = new URLSearchParams({
            page: filters.page || 1,
            limit: filters.limit || 10,
            ...(filters.symbol && { symbol: filters.symbol }),
            ...(filters.type && { type: filters.type }),
            ...(filters.startDate && { startDate: filters.startDate }),
            ...(filters.endDate && { endDate: filters.endDate })
        });

        const response = await fetch(`/api/portfolio/transactions?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load transactions');
        }

        const data = await response.json();
        displayTransactionHistory(data.transactions);
        displayTransactionStats(data.stats);
        displayPagination(data.pagination);
    } catch (error) {
        console.error('Error loading transactions:', error);
        showAlert('Error loading transactions', 'error');
    }
}

// Display transaction history
function displayTransactionHistory(transactions) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No transaction history</div>';
        return;
    }
    
    const html = transactions.map(transaction => `
        <div class="card mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="card-title mb-0">${transaction.stock_symbol}</h5>
                        ${transaction.stock_name ? `<small class="text-muted">${transaction.stock_name}</small>` : ''}
                    </div>
                    <span class="badge ${transaction.transaction_type === 'BUY' ? 'bg-success' : 'bg-danger'}">
                        ${transaction.transaction_type}
                    </span>
                </div>
                <div class="row mt-3">
                    <div class="col">
                        <p class="mb-1">Quantity: ${transaction.quantity}</p>
                        <p class="mb-1">Price: AED ${formatCurrency(transaction.price)}</p>
                        <p class="mb-0">Total: AED ${formatCurrency(transaction.total_amount)}</p>
                    </div>
                    <div class="col text-end">
                        <small class="text-muted">
                            ${new Date(transaction.transaction_date).toLocaleString()}
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Display transaction statistics
function displayTransactionStats(stats) {
    const container = document.getElementById('transactionStats');
    if (!container) return;
    
    const html = `
        <div class="row g-3">
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Total Transactions</h6>
                        <p class="card-text h4">${stats.total_transactions}</p>
                        <small class="text-muted">
                            Buys: ${stats.total_buys} | Sells: ${stats.total_sells}
                        </small>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Total Invested</h6>
                        <p class="card-text h4">AED ${formatCurrency(stats.total_invested)}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Net Position</h6>
                        <p class="card-text h4 ${stats.net_position >= 0 ? 'text-success' : 'text-danger'}">
                            AED ${formatCurrency(Math.abs(stats.net_position))}
                            ${stats.net_position >= 0 ? '▲' : '▼'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Display pagination
function displayPagination(pagination) {
    const container = document.getElementById('transactionsPagination');
    if (!container) return;
    
    const pages = [];
    const currentPage = pagination.current_page;
    const totalPages = pagination.total_pages;
    
    // Previous button
    if (currentPage > 1) {
        pages.push(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">Previous</a>
            </li>
        `);
    }
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 || // First page
            i === totalPages || // Last page
            (i >= currentPage - 2 && i <= currentPage + 2) // Pages around current
        ) {
            pages.push(`
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `);
        } else if (
            (i === 2 && currentPage > 4) || // Ellipsis after first page
            (i === totalPages - 1 && currentPage < totalPages - 3) // Ellipsis before last page
        ) {
            pages.push('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
    }
    
    // Next button
    if (currentPage < totalPages) {
        pages.push(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">Next</a>
            </li>
        `);
    }
    
    container.innerHTML = `
        <nav aria-label="Transaction history navigation">
            <ul class="pagination justify-content-center">
                ${pages.join('')}
            </ul>
        </nav>
    `;
}

// Handle page change
function changePage(page) {
    const filters = getCurrentFilters();
    loadTransactionHistory({ ...filters, page });
}

// Get current filter values
function getCurrentFilters() {
    return {
        symbol: document.getElementById('symbolFilter')?.value,
        type: document.getElementById('typeFilter')?.value,
        startDate: document.getElementById('startDateFilter')?.value,
        endDate: document.getElementById('endDateFilter')?.value,
        page: 1
    };
}

// Initialize transaction filters
function initTransactionFilters() {
    const form = document.getElementById('transactionFilters');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        loadTransactionHistory(getCurrentFilters());
    });
    
    form.addEventListener('reset', function(e) {
        setTimeout(() => loadTransactionHistory(), 0);
    });
}

// Print transaction history
async function printTransactionHistory() {
    try {
        const filters = getCurrentFilters();
        const queryParams = new URLSearchParams({
            ...filters,
            print: true
        });

        const response = await fetch(`/api/portfolio/transactions?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch print data');
        }

        const data = await response.json();
        
        // Create print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Transaction History - ${new Date(data.generated_at).toLocaleDateString()}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .user-info {
                        text-align: right;
                        margin-bottom: 20px;
                        font-size: 0.9em;
                        color: #666;
                    }
                    .filters {
                        margin-bottom: 20px;
                        padding: 10px;
                        background: #f5f5f5;
                        border-radius: 4px;
                    }
                    .stats {
                        margin-bottom: 20px;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 10px;
                    }
                    .stat-card {
                        padding: 10px;
                        background: #fff;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        font-size: 0.9em;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background-color: #f8f9fa;
                        font-weight: bold;
                    }
                    .text-success { color: #28a745; }
                    .text-danger { color: #dc3545; }
                    .text-end { text-align: right; }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 0.8em;
                        color: #666;
                    }
                    @media print {
                        .no-print { display: none; }
                        body { margin: 0; }
                        .filters { background: none; }
                        @page {
                            size: A4;
                            margin: 2cm;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Transaction History</h1>
                    <p>Generated on ${new Date(data.generated_at).toLocaleString()}</p>
                </div>

                <div class="user-info">
                    <p>User: ${data.user.username}</p>
                    <p>Email: ${data.user.email}</p>
                </div>
                
                <div class="filters">
                    <strong>Filters:</strong>
                    ${data.filters.symbol ? `Symbol: ${data.filters.symbol}` : ''}
                    ${data.filters.type ? `Type: ${data.filters.type}` : ''}
                    ${data.filters.startDate ? `From: ${data.filters.startDate}` : ''}
                    ${data.filters.endDate ? `To: ${data.filters.endDate}` : ''}
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>Transactions</h3>
                        <p>Total: ${data.stats.total_transactions}</p>
                        <p>Buys: ${data.stats.total_buys}</p>
                        <p>Sells: ${data.stats.total_sells}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Total Invested</h3>
                        <p>AED ${formatCurrency(data.stats.total_invested)}</p>
                    </div>
                    <div class="stat-card">
                        <h3>Net Position</h3>
                        <p class="${data.stats.total_sold - data.stats.total_invested >= 0 ? 'text-success' : 'text-danger'}">
                            AED ${formatCurrency(Math.abs(data.stats.total_sold - data.stats.total_invested))}
                            ${data.stats.total_sold - data.stats.total_invested >= 0 ? '▲' : '▼'}
                        </p>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Symbol</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th class="text-end">Quantity</th>
                            <th class="text-end">Price</th>
                            <th class="text-end">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.transactions.map(t => `
                            <tr>
                                <td>${new Date(t.transaction_date).toLocaleString()}</td>
                                <td>${t.stock_symbol}</td>
                                <td>${t.stock_name || '-'}</td>
                                <td class="${t.transaction_type === 'BUY' ? 'text-success' : 'text-danger'}">
                                    ${t.transaction_type}
                                </td>
                                <td class="text-end">${t.quantity}</td>
                                <td class="text-end">AED ${formatCurrency(t.price)}</td>
                                <td class="text-end">AED ${formatCurrency(t.total_amount)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Stock Portfolio Management System</p>
                    <p>Report generated at ${new Date(data.generated_at).toLocaleString()}</p>
                </div>
                
                <div class="no-print" style="text-align: center; margin-top: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">
                        Print Report
                    </button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    } catch (error) {
        console.error('Error preparing print view:', error);
        showAlert('Error preparing print view', 'error');
    }
}

// Add print button to transaction filters
function addPrintButton() {
    const container = document.getElementById('transactionFilters');
    if (!container) return;
    
    const printButton = document.createElement('button');
    printButton.type = 'button';
    printButton.className = 'btn btn-outline-secondary ms-2';
    printButton.innerHTML = '<i class="fas fa-print"></i> Print';
    printButton.onclick = printTransactionHistory;
    
    const submitButton = container.querySelector('button[type="submit"]');
    if (submitButton) {
        submitButton.parentNode.insertBefore(printButton, submitButton.nextSibling);
    } else {
        container.appendChild(printButton);
    }
}

// Initialize transaction module
function initTransactionModule() {
    initTransactionFilters();
    addPrintButton();
    loadTransactionHistory();
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency: 'AED'
    }).format(amount);
}

// Format percentage
function formatPercentage(value) {
    return new Intl.NumberFormat('en-AE', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value / 100);
}

// Initialize portfolio chart
let portfolioChart = null;

// Load portfolio chart
async function loadPortfolioChart(period = '1M') {
    try {
        const response = await fetch(`/api/portfolio/chart?period=${period}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();
        displayPortfolioChart(data);
        displayPortfolioMetrics(data.metrics);
    } catch (error) {
        console.error('Error loading portfolio chart:', error);
        showAlert('Error loading portfolio chart', 'error');
    }
}

// Display portfolio chart
function displayPortfolioChart(data) {
    const ctx = document.getElementById('portfolioChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (portfolioChart) {
        portfolioChart.destroy();
    }

    const dates = data.chart_data.map(d => d.date);
    const values = data.chart_data.map(d => d.value);
    const changes = data.chart_data.map(d => d.daily_change_percent);

    // Calculate gradient colors
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(75, 192, 192, 0.4)');
    gradient.addColorStop(1, 'rgba(75, 192, 192, 0.0)');

    portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Portfolio Value',
                    data: values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: gradient,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Daily Change %',
                    data: changes,
                    borderColor: 'rgba(255, 99, 132, 0.8)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    borderDash: [5, 5],
                    tension: 0.4,
                    hidden: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Portfolio Performance'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.datasetIndex === 0) {
                                label += 'AED ' + formatCurrency(context.raw);
                            } else {
                                label += context.raw.toFixed(2) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM d'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Portfolio Value (AED)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'AED ' + formatCurrency(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false
                    },
                    title: {
                        display: true,
                        text: 'Daily Change %'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2) + '%';
                        }
                    }
                }
            }
        }
    });
}

// Display portfolio metrics
function displayPortfolioMetrics(metrics) {
    const container = document.getElementById('portfolioMetrics');
    if (!container) return;

    const html = `
        <div class="row g-3">
            <div class="col-md-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Current Value</h6>
                        <p class="card-text h4">AED ${formatCurrency(metrics.end_value)}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Total Change</h6>
                        <p class="card-text h4 ${metrics.total_change >= 0 ? 'text-success' : 'text-danger'}">
                            AED ${formatCurrency(Math.abs(metrics.total_change))}
                            ${metrics.total_change >= 0 ? '▲' : '▼'}
                        </p>
                        <small class="text-muted">
                            ${metrics.total_change_percent.toFixed(2)}%
                        </small>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Highest Value</h6>
                        <p class="card-text h4">AED ${formatCurrency(metrics.max_value)}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 col-lg-3">
                <div class="card">
                    <div class="card-body">
                        <h6 class="card-title">Lowest Value</h6>
                        <p class="card-text h4">AED ${formatCurrency(metrics.min_value)}</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Initialize portfolio chart controls
function initPortfolioChartControls() {
    const container = document.getElementById('portfolioChartControls');
    if (!container) return;

    const periods = [
        { value: '1W', label: '1 Week' },
        { value: '1M', label: '1 Month' },
        { value: '3M', label: '3 Months' },
        { value: '6M', label: '6 Months' },
        { value: '1Y', label: '1 Year' },
        { value: 'ALL', label: 'All Time' }
    ];

    const html = `
        <div class="btn-group" role="group" aria-label="Chart period controls">
            ${periods.map(period => `
                <button type="button" 
                    class="btn btn-outline-secondary period-btn" 
                    data-period="${period.value}">
                    ${period.label}
                </button>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;

    // Add event listeners
    container.querySelectorAll('.period-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Update active state
            container.querySelectorAll('.period-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');

            // Load chart data
            loadPortfolioChart(this.dataset.period);
        });
    });

    // Set default active period
    container.querySelector('[data-period="1M"]').classList.add('active');
}

// Initialize dashboard
function initDashboard() {
    initPortfolioChartControls();
    loadPortfolioChart();
}
