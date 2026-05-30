const { groupItemsByY } = require('../lineUtils');

function isValidRowGroup(allParsedItems) {
    return Object.values(groupItemsByY(allParsedItems, 0.01)).find(group => {
        if (group.length < 1) return false;

        let dateCount = 0, amountCount = 0, textCount = 0;
        group.forEach(({ text }) => {
            const txt = text.trim();
            if (/^\d{2}\/\d{2}\/\d{2}$/.test(txt)) dateCount++;
            else if (/^\d+\.\d{2}$/.test(txt)) amountCount++;
            else if (/[a-zA-Z]/.test(txt) && !/\.\d{2}(Cr|Dr)$/.test(txt)) textCount++;
        });

        const isTransactionRow = dateCount >= 2 && amountCount >= 1 && textCount >= 1;
        const isNarrationOnly = dateCount === 0 && amountCount === 0 && textCount >= 1;
        return isTransactionRow || isNarrationOnly;
    });
}
module.exports = { isValidRowGroup };
