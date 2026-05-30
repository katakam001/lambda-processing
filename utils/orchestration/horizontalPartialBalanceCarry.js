const { extractPreviousBalanceWithoutBroughtForward, extractPreviousBalanceFromGroupByYAxis, normalizeBalance } = require('../balanceUtils');
const bankConfig = require('../../config/bankConfig');

function initPrevBalance(firstPageGroupByY, bankName) {
    if (!bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName)) {
        const { value } = extractPreviousBalanceWithoutBroughtForward(firstPageGroupByY);
        return value;
    }
    return extractPreviousBalanceFromGroupByYAxis(firstPageGroupByY);
}

function updatePrevBalance(flattened, headerXMap, headerPositions) {
    if (!flattened.length) return null;
    const headers = Object.keys(headerPositions);
    const balanceX = headerXMap[headers[headers.length - 1]];
    const balanceField = [...flattened].reverse().find(f => f.x === balanceX);
    return balanceField ? normalizeBalance(balanceField.text) : null;
}

module.exports = { initPrevBalance, updatePrevBalance };
