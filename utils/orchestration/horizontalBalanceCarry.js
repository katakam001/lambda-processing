const { extractPreviousBalanceFromLines } = require('../balanceUtils');
const { normalizeBalance } = require('../balanceUtils');

function extractInitialBalance(mergedLines) {
    return extractPreviousBalanceFromLines(mergedLines);
}

function updatePrevBalance(flattened, headerXMap) {
    if (!flattened.length) return null;

    const headers = Object.keys(headerXMap);
    const balanceX = headerXMap[headers[headers.length - 1]];

    const balanceField = [...flattened].reverse().find(f => f.x === balanceX);
    return balanceField ? normalizeBalance(balanceField.text) : null;
}

module.exports = { extractInitialBalance, updatePrevBalance };
