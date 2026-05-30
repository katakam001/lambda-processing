const { extractPreviousBalanceFromGroups } = require('../balanceUtils');

function updatePreviousBalance(groupByY, previousBalance) {
    const extracted = extractPreviousBalanceFromGroups(groupByY);
    if (extracted) return extracted;
    if (previousBalance) return { value: previousBalance.value, type: previousBalance.type };
    return null;
}
module.exports = { updatePreviousBalance };
