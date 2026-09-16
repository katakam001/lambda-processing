const { extractCarryForwardedParticulars } = require('./carryForward');
const { parseDataRows } = require('../convertUtils');
const { parseTransactionRows,parseWithHorizontalTransactionRows } = require('./parsers');
const { groupItemsByY, mergeGroupedText } = require('../lineUtils');

function parsePageRows(items, headerPositions, cleanText, prevBalance, page) {
    const groupByY = groupItemsByY(items, 0.01);
    const mergedLines = mergeGroupedText(groupByY);

    let flattened;

    if (cleanText.includes('|')) {
        // Pipe-delimited
        flattened = Object.values(
            parseDataRows(mergedLines, headerPositions, Object.keys(headerPositions))
        ).flat();

        if (parseInt(page) > 1) {
            const carryForwarded = Object.values(
                extractCarryForwardedParticulars(mergedLines, headerPositions)
            ).flat();
            if (carryForwarded.length) {
                flattened = [...carryForwarded, ...flattened];
            }
        }
    } else if (Object.keys(headerPositions).some(h => h.toLowerCase().includes("debits"))) {
        // Space-aligned
        flattened = Object.values(
            parseWithHorizontalTransactionRows(mergedLines, headerPositions, Object.keys(headerPositions), prevBalance)
        ).flat();
    } else {
        // Space-aligned
        flattened = Object.values(
            parseTransactionRows(mergedLines, headerPositions, Object.keys(headerPositions), prevBalance)
        ).flat();
    }

    return flattened;
}

module.exports = { parsePageRows };
