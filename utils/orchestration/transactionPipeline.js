const { parseTransactionRow } = require('./parsers');

function parseTransactions(groupByY, headerPositions, previousBalance) {
    const allParsedItems = [];
    let statementFound = false;

    for (const [yKey, items] of Object.entries(groupByY)) {
        const yValue = parseFloat(yKey);

        if (previousBalance && yValue <= previousBalance.y) continue;

        if (!previousBalance?.y && !statementFound) {
            const hasStatement = items.some(i => i.text.includes('Statement of Account'));
            if (hasStatement) {
                statementFound = true;
                continue;
            } else {
                continue;
            }
        }

        for (const item of items) {
            const parsed = parseTransactionRow(item, previousBalance?.value ?? 0, headerPositions);
            allParsedItems.push(...parsed);
        }
    }
    return allParsedItems;
}

module.exports = { parseTransactions };
