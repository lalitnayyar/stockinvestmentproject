class PortfolioModule {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.symbolSearchTimeout = null;
        this.portfolioContainer = document.getElementById('portfolioContent');
        this.loadPortfolio();
        
        // Add print button
        const printBtn = document.createElement('button');
        printBtn.className = 'btn btn-outline-primary mb-3';
        printBtn.innerHTML = '<i class="bi bi-printer"></i> Print Portfolio';
        printBtn.onclick = () => this.printPortfolio();
        this.portfolioContainer.parentElement.insertBefore(printBtn, this.portfolioContainer);
    }

    initializeElements() {
        this.addStockForm = document.getElementById('addStockForm');
        this.portfolioSummary = document.getElementById('portfolioSummary');
        this.transactionHistory = document.getElementById('transactionHistory');
        this.performanceChart = document.getElementById('performanceChart');
        
        // Symbol search elements
        this.symbolSearchInput = document.getElementById('symbolSearch');
        this.symbolSearchResults = document.getElementById('symbolSearchResults');
        this.selectedSymbolInput = document.getElementById('selectedSymbol');
    }

    bindEvents() {
        if (this.addStockForm) {
            this.addStockForm.addEventListener('submit', (e) => this.handleAddStock(e));
        }
        
        if (this.symbolSearchInput) {
            // Handle input changes with debouncing
            this.symbolSearchInput.addEventListener('input', (e) => {
                clearTimeout(this.symbolSearchTimeout);
                const query = e.target.value.trim();
                
                if (query) {
                    this.symbolSearchTimeout = setTimeout(() => this.handleSymbolSearch(query), 300);
                } else {
                    this.hideSearchResults();
                }
            });

            // Handle input focus
            this.symbolSearchInput.addEventListener('focus', () => {
                if (this.symbolSearchResults.children.length > 0) {
                    this.showSearchResults();
                }
            });

            // Close search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.symbolSearchInput.contains(e.target) && 
                    !this.symbolSearchResults.contains(e.target)) {
                    this.hideSearchResults();
                }
            });
        }
    }

    async handleSymbolSearch(query) {
        try {
            const response = await fetch(`/api/stocks/search-symbol/${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to search symbols');
            }

            const stocks = await response.json();
            this.displaySearchResults(stocks);
        } catch (error) {
            console.error('Error searching symbols:', error);
            this.displaySearchResults([]);
        }
    }

    displaySearchResults(stocks) {
        if (!stocks.length) {
            this.symbolSearchResults.innerHTML = '<div class="p-2 text-muted">No results found</div>';
        } else {
            const html = stocks.map(stock => `
                <div class="search-result p-2 cursor-pointer hover-bg-light" 
                     onclick="portfolioModule.selectSymbol('${stock.symbol}', '${stock.name.replace(/'/g, "\\'")}')">
                    <div class="fw-bold">${stock.symbol}</div>
                    <div class="small text-muted">${stock.name}</div>
                </div>
            `).join('');
            
            this.symbolSearchResults.innerHTML = html;
        }
        
        this.showSearchResults();
    }

    selectSymbol(symbol, name) {
        this.symbolSearchInput.value = `${symbol} - ${name}`;
        this.selectedSymbolInput.value = symbol;
        this.hideSearchResults();
    }

    showSearchResults() {
        this.symbolSearchResults.style.display = 'block';
    }

    hideSearchResults() {
        this.symbolSearchResults.style.display = 'none';
    }

    async loadPortfolio() {
        try {
            const response = await fetch('/api/stocks/portfolio', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            this.displayPortfolio(data.portfolio);
            this.displaySummary(data.summary);
        } catch (error) {
            console.error('Error loading portfolio:', error);
            showAlert('Error loading portfolio', 'error');
        }
    }

    displayPortfolio(stocks) {
        if (!stocks.length) {
            this.portfolioContainer.innerHTML = '<p class="text-center">No stocks in portfolio</p>';
            return;
        }

        const html = stocks.map(stock => {
            const profitLoss = (stock.current_price - stock.purchase_price) * stock.quantity;
            const profitLossPercentage = ((stock.current_price - stock.purchase_price) / stock.purchase_price) * 100;
            
            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <h5 class="card-title mb-0">${stock.symbol}</h5>
                                <small class="text-muted">${stock.stock_name || ''}</small>
                            </div>
                            <div class="col-md-3">
                                <div>Current Price: ${formatCurrency(stock.current_price)}</div>
                                <div>Purchase Price: ${formatCurrency(stock.purchase_price)}</div>
                            </div>
                            <div class="col-md-3">
                                <div>Quantity: ${stock.quantity}</div>
                                <div>Total Value: ${formatCurrency(stock.current_price * stock.quantity)}</div>
                            </div>
                            <div class="col-md-3 text-end">
                                <div class="mb-2">
                                    <span class="badge ${profitLoss >= 0 ? 'bg-success' : 'bg-danger'}">
                                        ${formatCurrency(profitLoss)} (${formatPercentage(profitLossPercentage)})
                                    </span>
                                </div>
                                <button class="btn btn-outline-danger btn-sm" onclick="portfolioModule.showSellModal('${stock.symbol}', ${stock.quantity}, ${stock.current_price})">
                                    Sell
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.portfolioContainer.innerHTML = html;
    }

    displaySummary(summary) {
        if (this.portfolioSummary) {
            this.portfolioSummary.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Portfolio Summary</h5>
                        <div class="row">
                            <div class="col-md-6">
                                <p class="mb-1">Total Investment: ${formatCurrency(summary.totalInvestment)}</p>
                                <p class="mb-1">Current Value: ${formatCurrency(summary.currentValue)}</p>
                            </div>
                            <div class="col-md-6 text-end">
                                <p class="mb-1 ${summary.totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                    Total Profit/Loss: ${formatCurrency(summary.totalProfitLoss)}
                                </p>
                                <p class="mb-0 ${summary.totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}">
                                    Return: ${formatPercentage(summary.totalProfitLossPercentage)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    async handleAddStock(e) {
        e.preventDefault();
        
        const symbol = this.selectedSymbolInput.value;
        if (!symbol) {
            showAlert('Please select a valid stock symbol', 'error');
            return;
        }

        const formData = new FormData(e.target);
        const stockData = {
            symbol: symbol,
            quantity: parseInt(formData.get('quantity')),
            purchase_price: parseFloat(formData.get('purchase_price')),
            purchase_date: formData.get('purchase_date')
        };

        try {
            const response = await fetch('/api/stocks/portfolio/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(stockData)
            });

            const data = await response.json();
            if (response.ok) {
                showAlert('Stock added successfully', 'success');
                this.loadPortfolio();
                e.target.reset();
                this.symbolSearchInput.value = '';
                this.selectedSymbolInput.value = '';
            } else {
                showAlert(data.error || 'Failed to add stock', 'error');
            }
        } catch (error) {
            console.error('Error adding stock:', error);
            showAlert('Error adding stock to portfolio', 'error');
        }
    }

    async showSellModal(symbol, maxQuantity, currentPrice) {
        const { value: formValues } = await Swal.fire({
            title: `Sell ${symbol}`,
            html: `
                <div class="card mb-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">${symbol}</h5>
                    </div>
                    <div class="card-body">
                        <div class="row mb-3">
                            <div class="col-6">
                                <label class="form-label">Quantity Available</label>
                                <input type="text" class="form-control" value="${maxQuantity}" readonly>
                            </div>
                            <div class="col-6">
                                <label class="form-label">Current Price</label>
                                <input type="text" class="form-control" value="${formatCurrency(currentPrice)}" readonly>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-6">
                                <label class="form-label">Quantity to Sell</label>
                                <input id="sellQuantity" class="form-control" type="number" min="1" max="${maxQuantity}" value="1">
                            </div>
                            <div class="col-6">
                                <label class="form-label">Selling Price</label>
                                <input id="sellPrice" class="form-control" type="number" step="0.01" value="${currentPrice}">
                            </div>
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Sell',
            preConfirm: () => {
                const quantity = document.getElementById('sellQuantity').value;
                const sellPrice = document.getElementById('sellPrice').value;
                
                if (!quantity || !sellPrice) {
                    Swal.showValidationMessage('Please fill in all fields');
                    return false;
                }
                
                if (parseInt(quantity) > maxQuantity) {
                    Swal.showValidationMessage(`Maximum quantity is ${maxQuantity}`);
                    return false;
                }
                
                return {
                    symbol: symbol,
                    quantity: parseInt(quantity),
                    sell_price: parseFloat(sellPrice)
                };
            }
        });

        if (formValues) {
            try {
                const response = await fetch('/api/stocks/portfolio/sell', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(formValues)
                });

                const data = await response.json();
                if (response.ok) {
                    showAlert('Stock sold successfully', 'success');
                    this.loadPortfolio();
                } else {
                    showAlert(data.error || 'Failed to sell stock', 'error');
                }
            } catch (error) {
                console.error('Error selling stock:', error);
                showAlert('Error selling stock', 'error');
            }
        }
    }

    printPortfolio() {
        const stocks = [...this.portfolioContainer.querySelectorAll('.card')].map(card => {
            const cols = card.querySelectorAll('.col-md-3');
            return {
                symbol: cols[0].querySelector('.card-title').textContent,
                name: cols[0].querySelector('small').textContent,
                current: cols[1].querySelector('div:nth-child(1)').textContent.replace('Current Price:', '').trim(),
                purchase: cols[1].querySelector('div:nth-child(2)').textContent.replace('Purchase Price:', '').trim(),
                quantity: cols[2].querySelector('div:nth-child(1)').textContent.replace('Quantity:', '').trim(),
                total: cols[2].querySelector('div:nth-child(2)').textContent.replace('Total Value:', '').trim(),
                profitLoss: cols[3].querySelector('.badge').textContent.trim()
            };
        });

        const content = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Name</th>
                        <th>Current Price</th>
                        <th>Purchase Price</th>
                        <th>Quantity</th>
                        <th>Total Value</th>
                        <th>Profit/Loss</th>
                    </tr>
                </thead>
                <tbody>
                    ${stocks.map(stock => `
                        <tr>
                            <td>${stock.symbol}</td>
                            <td>${stock.name}</td>
                            <td>${stock.current}</td>
                            <td>${stock.purchase}</td>
                            <td>${stock.quantity}</td>
                            <td>${stock.total}</td>
                            <td>${stock.profitLoss}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        printContent('Portfolio Summary', content);
    }
}

// Initialize portfolio module
const portfolioModule = new PortfolioModule();
