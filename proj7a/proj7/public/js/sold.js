class SoldStocksModule {
    constructor() {
        this.soldStocksContainer = document.getElementById('soldStocksContent');
        this.loadSoldStocks();
        
        // Add print button
        const printBtn = document.createElement('button');
        printBtn.className = 'btn btn-outline-primary mb-3';
        printBtn.innerHTML = '<i class="bi bi-printer"></i> Print Sold Stocks';
        printBtn.onclick = () => this.printSoldStocks();
        this.soldStocksContainer.parentElement.insertBefore(printBtn, this.soldStocksContainer);
        
        // Listen for stock sold events
        window.addEventListener('stockSold', () => {
            this.loadSoldStocks();
        });
    }

    async loadSoldStocks() {
        try {
            const response = await fetch('/api/stocks/sold', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            this.displaySoldStocks(data.soldStocks);
            this.displaySummary(data.summary);
        } catch (error) {
            console.error('Error loading sold stocks:', error);
            showAlert('Error loading sold stocks', 'error');
        }
    }

    displaySoldStocks(stocks) {
        if (!stocks.length) {
            this.soldStocksContainer.innerHTML = '<p class="text-center">No sold stocks</p>';
            return;
        }

        const html = stocks.map(stock => {
            const profitLoss = stock.profit_loss;
            const profitLossPercentage = (profitLoss / (stock.purchase_price * stock.quantity)) * 100;
            
            return `
                <div class="card mb-3">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <h5 class="card-title mb-0">${stock.symbol}</h5>
                                <small class="text-muted">Sold on ${new Date(stock.sell_date).toLocaleDateString()}</small>
                            </div>
                            <div class="col-md-3">
                                <div>Sell Price: ${formatCurrency(stock.sell_price)}</div>
                                <div>Purchase Price: ${formatCurrency(stock.purchase_price)}</div>
                            </div>
                            <div class="col-md-3">
                                <div>Quantity: ${stock.quantity}</div>
                                <div>Total Value: ${formatCurrency(stock.sell_price * stock.quantity)}</div>
                            </div>
                            <div class="col-md-3 text-end">
                                <div>
                                    <span class="badge ${profitLoss >= 0 ? 'bg-success' : 'bg-danger'}">
                                        ${formatCurrency(profitLoss)} (${formatPercentage(profitLossPercentage)})
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.soldStocksContainer.innerHTML = html;
    }

    displaySummary(summary) {
        const summaryContainer = document.getElementById('soldStocksSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Sold Stocks Summary</h5>
                        <div class="row">
                            <div class="col-md-6">
                                <p class="mb-1">Total Sold Value: ${formatCurrency(summary.totalSoldValue)}</p>
                                <p class="mb-1">Total Investment: ${formatCurrency(summary.totalInvestment)}</p>
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

    printSoldStocks() {
        const stocks = [...this.soldStocksContainer.querySelectorAll('.card')].map(card => {
            const cols = card.querySelectorAll('.col-md-3');
            
            return {
                symbol: cols[0].querySelector('.card-title').textContent,
                sellDate: cols[0].querySelector('small').textContent.replace('Sold on ', ''),
                sellPrice: cols[1].querySelector('div:nth-child(1)').textContent.replace('Sell Price:', '').trim(),
                purchasePrice: cols[1].querySelector('div:nth-child(2)').textContent.replace('Purchase Price:', '').trim(),
                quantity: cols[2].querySelector('div:nth-child(1)').textContent.replace('Quantity:', '').trim(),
                totalValue: cols[2].querySelector('div:nth-child(2)').textContent.replace('Total Value:', '').trim(),
                profitLoss: cols[3].querySelector('.badge').textContent.trim()
            };
        });

        const content = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Sell Date</th>
                        <th>Sell Price</th>
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
                            <td>${stock.sellDate}</td>
                            <td>${stock.sellPrice}</td>
                            <td>${stock.purchasePrice}</td>
                            <td>${stock.quantity}</td>
                            <td>${stock.totalValue}</td>
                            <td>${stock.profitLoss}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        printContent('Sold Stocks Summary', content);
    }
}

// Initialize sold stocks module
document.addEventListener('DOMContentLoaded', () => {
    window.soldStocksModule = new SoldStocksModule();
});
