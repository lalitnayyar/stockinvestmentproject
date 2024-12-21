class StocksModule {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.searchTimeout = null;
        this.stocksContainer = document.getElementById('stocksContent');
        this.loadMarketOverview();
        
        // Add print button
        const printBtn = document.createElement('button');
        printBtn.className = 'btn btn-outline-primary mb-3';
        printBtn.innerHTML = '<i class="bi bi-printer"></i> Print Stock List';
        printBtn.onclick = () => this.printStocks();
        this.marketOverview.parentElement.insertBefore(printBtn, this.marketOverview);
    }

    initializeElements() {
        this.searchInput = document.getElementById('stockSearch');
        this.searchResults = document.getElementById('searchResults');
        this.stockDetails = document.getElementById('stockDetails');
        this.marketOverview = document.getElementById('marketOverview');
    }

    bindEvents() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => this.handleSearch(e.target.value), 500);
            });
        }
    }

    async handleSearch(query) {
        if (!query) {
            this.searchResults.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`/api/stocks/search/${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const stocks = await response.json();
            this.displaySearchResults(stocks);
        } catch (error) {
            console.error('Error searching stocks:', error);
            showAlert('Error searching stocks', 'error');
        }
    }

    displaySearchResults(stocks) {
        if (!stocks || stocks.length === 0) {
            this.searchResults.innerHTML = '<p class="text-muted">No stocks found</p>';
            return;
        }

        const html = stocks.map(stock => `
            <div class="card mb-2 stock-result" data-symbol="${stock.symbol}">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-0">${stock.symbol}</h6>
                            <small class="text-muted">${stock.name || 'N/A'}</small>
                        </div>
                        <div class="text-end">
                            ${stock.current_price ? `
                                <div>${formatCurrency(stock.current_price)}</div>
                                <small class="badge ${stock.change_percent >= 0 ? 'bg-success' : 'bg-danger'}">
                                    ${formatPercentage(stock.change_percent)}
                                </small>
                            ` : '<small class="text-muted">Price not available</small>'}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.searchResults.innerHTML = html;

        // Add click handlers
        this.searchResults.querySelectorAll('.stock-result').forEach(card => {
            card.addEventListener('click', () => {
                const symbol = card.dataset.symbol;
                this.loadStockDetails(symbol);
            });
        });
    }

    async loadStockDetails(symbol) {
        try {
            const response = await fetch(`/api/stocks/details/${symbol}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load stock details');
            }

            const stock = await response.json();
            this.displayStockDetails(stock);
        } catch (error) {
            console.error('Error loading stock details:', error);
            showAlert('Error loading stock details', 'error');
        }
    }

    displayStockDetails(stock) {
        if (!this.stockDetails) return;

        const profitLossClass = stock.change_percent >= 0 ? 'text-success' : 'text-danger';
        const changeSign = stock.change_percent >= 0 ? '+' : '';

        const html = `
            <div class="card">
                <div class="card-body">
                    <h4 class="card-title">${stock.symbol}</h4>
                    <h6 class="card-subtitle mb-3 text-muted">${stock.name}</h6>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <p class="mb-1">Current Price</p>
                            <h5>${formatCurrency(stock.current_price)}</h5>
                        </div>
                        <div class="col-md-6">
                            <p class="mb-1">Change</p>
                            <h5 class="${profitLossClass}">
                                ${changeSign}${formatPercentage(stock.change_percent)}
                            </h5>
                        </div>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <p class="mb-1">Volume</p>
                            <h5>${stock.volume?.toLocaleString() || 'N/A'}</h5>
                        </div>
                        <div class="col-md-6">
                            <p class="mb-1">Market Cap</p>
                            <h5>${formatCurrency(stock.market_cap)}</h5>
                        </div>
                    </div>

                    <button class="btn btn-primary" onclick="stocksModule.showBuyModal('${stock.symbol}', ${stock.current_price})">
                        Buy Stock
                    </button>
                </div>
            </div>
        `;

        this.stockDetails.innerHTML = html;
    }

    async loadMarketOverview() {
        try {
            const response = await fetch('/api/stocks', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const stocks = await response.json();
            this.displayMarketOverview(stocks);
        } catch (error) {
            console.error('Error loading market overview:', error);
            showAlert('Error loading market overview', 'error');
        }
    }

    displayMarketOverview(stocks) {
        if (!stocks.length) {
            this.marketOverview.innerHTML = '<p class="text-center">No stocks available</p>';
            return;
        }

        const html = stocks.map(stock => {
            const changeClass = stock.change_percent >= 0 ? 'bg-success' : 'bg-danger';
            const changeSign = stock.change_percent >= 0 ? '+' : '';
            
            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <h5 class="card-title mb-0">${stock.symbol}</h5>
                                <small class="text-muted">${stock.name || ''}</small>
                            </div>
                            <div class="col-md-3">
                                <div>Price: ${formatCurrency(stock.current_price)}</div>
                                <span class="badge ${changeClass}">
                                    ${changeSign}${formatPercentage(stock.change_percent)}
                                </span>
                            </div>
                            <div class="col-md-3">
                                <div>Volume: ${stock.volume?.toLocaleString() || 'N/A'}</div>
                                <div>Market Cap: ${formatCurrency(stock.market_cap)}</div>
                            </div>
                            <div class="col-md-3 text-end">
                                <button class="btn btn-outline-primary btn-sm" onclick="stocksModule.addToWatchlist('${stock.symbol}')">
                                    Add to Watchlist
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.marketOverview.innerHTML = html;
    }

    renderStockList(stocks) {
        return stocks.map(stock => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <strong>${stock.symbol}</strong>
                    <small class="text-muted d-block">${stock.name}</small>
                </div>
                <div class="text-end">
                    <div>AED ${stock.current_price}</div>
                    <small class="${stock.change_percent >= 0 ? 'text-success' : 'text-danger'}">
                        ${stock.change_percent}%
                    </small>
                </div>
            </div>
        `).join('');
    }

    showTradeModal(symbol, price) {
        const modal = new bootstrap.Modal(document.getElementById('tradeModal'));
        document.getElementById('tradeSymbol').value = symbol;
        document.getElementById('tradePrice').value = price;
        modal.show();
    }

    async addToWatchlist(symbol) {
        // Implement watchlist functionality
        showAlert('Watchlist feature coming soon!', 'info');
    }

    printStocks() {
        const stocks = [...this.marketOverview.querySelectorAll('.card')].map(card => {
            const cardBody = card.querySelector('.card-body');
            const cols = cardBody.querySelectorAll('.col-md-3');
            
            const data = {
                symbol: cols[0].querySelector('.card-title')?.textContent?.trim() || '',
                name: cols[0].querySelector('.text-muted')?.textContent?.trim() || '',
                price: cols[1].querySelector('div:nth-child(1)')?.textContent?.replace('Price:', '')?.trim() || '',
                change: cols[1].querySelector('.badge')?.textContent?.trim() || '',
                volume: cols[2].querySelector('div:nth-child(1)')?.textContent?.replace('Volume:', '')?.trim() || '',
                marketCap: cols[2].querySelector('div:nth-child(2)')?.textContent?.replace('Market Cap:', '')?.trim() || ''
            };
            
            return `
                <tr>
                    <td>${data.symbol}<br><small class="text-muted">${data.name}</small></td>
                    <td>${data.price}</td>
                    <td>${data.change}</td>
                    <td>${data.volume}</td>
                    <td>${data.marketCap}</td>
                </tr>
            `;
        }).join('');

        const content = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Price</th>
                        <th>Change</th>
                        <th>Volume</th>
                        <th>Market Cap</th>
                    </tr>
                </thead>
                <tbody>
                    ${stocks}
                </tbody>
            </table>
        `;

        printContent('UAE Stock Market List', content);
    }
}

// Initialize stocks module
const stocksModule = new StocksModule();
