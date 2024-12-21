class TransactionsModule {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.currentPage = 1;
        this.limit = 10;
        this.loadTransactions();
    }

    initializeElements() {
        this.transactionsContainer = document.getElementById('transactionsContent');
        this.filterForm = document.getElementById('transactionFilters');
        this.symbolFilter = document.getElementById('symbolFilter');
        this.typeFilter = document.getElementById('typeFilter');
        this.startDateFilter = document.getElementById('startDateFilter');
        this.endDateFilter = document.getElementById('endDateFilter');
        this.paginationContainer = document.getElementById('transactionsPagination');
        this.statsContainer = document.getElementById('transactionsStats');
    }

    bindEvents() {
        if (this.filterForm) {
            this.filterForm.addEventListener('submit', (e) => this.handleFilterSubmit(e));
        }
    }

    async loadTransactions(filters = {}) {
        try {
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: this.limit,
                ...filters
            });

            const response = await fetch(`/api/transactions?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }

            const data = await response.json();
            this.displayTransactions(data.transactions);
            this.displayPagination(data.pagination);
            await this.loadStats(filters);
        } catch (error) {
            console.error('Error loading transactions:', error);
            this.showError('Failed to load transactions');
        }
    }

    async loadStats(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters);
            const response = await fetch(`/api/transactions/stats?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch transaction stats');
            }

            const stats = await response.json();
            this.displayStats(stats);
        } catch (error) {
            console.error('Error loading transaction stats:', error);
        }
    }

    displayTransactions(transactions) {
        if (!this.transactionsContainer) return;

        if (!transactions.length) {
            this.transactionsContainer.innerHTML = '<div class="alert alert-info">No transactions found</div>';
            return;
        }

        const html = transactions.map(transaction => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="card-title">${transaction.symbol}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">${transaction.stock_name || ''}</h6>
                        </div>
                        <span class="badge ${transaction.transaction_type === 'BUY' ? 'bg-success' : 'bg-danger'}">
                            ${transaction.transaction_type}
                        </span>
                    </div>
                    <div class="row mt-3">
                        <div class="col">
                            <p class="mb-1">Quantity: ${transaction.quantity}</p>
                            <p class="mb-1">Price: AED ${transaction.price.toFixed(2)}</p>
                            <p class="mb-0">Total: AED ${(transaction.price * transaction.quantity).toFixed(2)}</p>
                        </div>
                        <div class="col text-end">
                            <p class="text-muted mb-0">
                                ${new Date(transaction.transaction_date).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.transactionsContainer.innerHTML = html;
    }

    displayPagination(pagination) {
        if (!this.paginationContainer) return;

        const { total, totalPages, currentPage, limit } = pagination;
        
        let html = '<nav><ul class="pagination justify-content-center">';
        
        // Previous button
        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
            </li>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            html += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        // Next button
        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
            </li>
        `;

        html += '</ul></nav>';
        
        this.paginationContainer.innerHTML = html;

        // Add click handlers
        this.paginationContainer.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.target.dataset.page);
                if (page && page !== currentPage) {
                    this.currentPage = page;
                    this.loadTransactions(this.getFilters());
                }
            });
        });
    }

    displayStats(stats) {
        if (!this.statsContainer) return;

        const html = `
            <div class="row">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Total Transactions</h5>
                            <p class="card-text display-6">${stats.total_transactions}</p>
                            <div class="text-muted">
                                Buys: ${stats.total_buys} | Sells: ${stats.total_sells}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Total Invested</h5>
                            <p class="card-text display-6">AED ${stats.total_invested?.toFixed(2) || '0.00'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">Total Sold</h5>
                            <p class="card-text display-6">AED ${stats.total_sold?.toFixed(2) || '0.00'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.statsContainer.innerHTML = html;
    }

    handleFilterSubmit(e) {
        e.preventDefault();
        this.currentPage = 1;
        this.loadTransactions(this.getFilters());
    }

    getFilters() {
        const filters = {};
        
        if (this.symbolFilter?.value) {
            filters.symbol = this.symbolFilter.value;
        }
        
        if (this.typeFilter?.value) {
            filters.type = this.typeFilter.value;
        }
        
        if (this.startDateFilter?.value) {
            filters.startDate = this.startDateFilter.value;
        }
        
        if (this.endDateFilter?.value) {
            filters.endDate = this.endDateFilter.value;
        }

        return filters;
    }

    showError(message) {
        if (this.transactionsContainer) {
            this.transactionsContainer.innerHTML = `
                <div class="alert alert-danger" role="alert">
                    ${message}
                </div>
            `;
        }
    }
}

// Initialize transactions module
const transactionsModule = new TransactionsModule();
