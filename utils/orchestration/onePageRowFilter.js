function filterRows(groupByY, previousBalance) {
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
        allParsedItems.push(...items);
    }
    return allParsedItems;
}
module.exports = { filterRows };
