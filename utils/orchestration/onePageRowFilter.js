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

function filterRowsWithoutPreviousBalance(groupByY) {
    const allParsedItems = [];

    for (const [yKey, items] of Object.entries(groupByY)) {
        // If this group contains any unwanted marker, skip it entirely
        const hasUnwanted = items.some(i =>
            i.text.includes("State Bank of India") ||
            i.text.includes("https://corp.sbi.bank.in/saral/printstatement.htm") ||
            i.text.includes("This is a computer generated statement and does not require a signature") ||
            i.text.includes("Print")
        );

        if (hasUnwanted) {
            continue; // ❌ skip this group
        }

        // ✅ otherwise include all items from this group
        const validItems = items.filter(i => i.text && i.text.trim() !== "");
        allParsedItems.push(...validItems);
    }

    return allParsedItems;
}

module.exports = { filterRows, filterRowsWithoutPreviousBalance };
