const { extractPreviousBalanceFromGroups } = require('../balanceUtils');

function applyBalanceCarryForward(groupByY, previousBalance) {
    const extractedBalance = extractPreviousBalanceFromGroups(groupByY);
    if (extractedBalance) {
        return extractedBalance;
    } else if (previousBalance) {
        return { value: previousBalance.value, type: previousBalance.type };
    }
    return null;
}

function updateBalanceFromParsed(parsed, headerPositions, previousBalance) {
    const balanceItem = parsed.find(p => p.x === headerPositions['Balance']);
    if (previousBalance && balanceItem) {
        previousBalance.value = parseFloat(
            balanceItem.text.replace(/(Cr|Dr)/, '').replace(/,/g, '')
        );
    }
    return previousBalance;
}

module.exports = { applyBalanceCarryForward, updateBalanceFromParsed };
