function printContent(title, content) {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                @media print {
                    .no-print { display: none; }
                    @page { margin: 2cm; }
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #ddd;
                }
                .print-date {
                    text-align: right;
                    margin-bottom: 20px;
                }
                .print-footer {
                    text-align: center;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }
            </style>
        </head>
        <body class="container mt-4">
            <div class="print-header">
                <h2>${title}</h2>
            </div>
            <div class="print-date">
                <strong>Date:</strong> ${currentDate}
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="print-footer">
                <p>UAE Stock Portfolio - Generated on ${currentDate}</p>
            </div>
            <div class="no-print text-center mt-4">
                <button class="btn btn-primary" onclick="window.print()">Print</button>
                <button class="btn btn-secondary" onclick="window.close()">Close</button>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}
