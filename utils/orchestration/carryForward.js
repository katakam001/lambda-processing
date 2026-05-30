
const { cleanParticularsField } = require('../../utils/convertUtils.js');

const getCarryForwardFragments = (headerXMap, parsedRowsOnNextPage) => {
    // Find the header key with the smallest x-coordinate
    const smallestXHeader = Object.entries(headerXMap).reduce((acc, [key, x]) => {
        return x < acc.x ? { key, x } : acc;
    }, { key: null, x: Infinity });

    const firstHeaderX = smallestXHeader.x;

    // Determine where the next transaction begins based on smallest x-header
    const startOfNextTxnY = Math.min(
        ...parsedRowsOnNextPage
            .filter(item => item.x === firstHeaderX)
            .map(item => item.y)
    );

    // Filter rows above that threshold — likely wrapped description/ref
    return parsedRowsOnNextPage.filter(item => item.y < startOfNextTxnY);
};


const extractCarryForwardedParticulars = (mergedLines, headerXMap) => {
    const allRows = [];

    for (const [y, line] of Object.entries(mergedLines)) {
        if (!line.includes('|')) {
            const text = line.trim();
            if (text) {
                const x = headerXMap['PARTICULARS'];
                allRows.push([{ text, x, y: parseFloat(y) }]);
            }
        } else {
            break; // Stop scanning once structured data starts
        }
    }

    return cleanParticularsField(allRows, headerXMap);
};
module.exports = { getCarryForwardFragments, extractCarryForwardedParticulars };
