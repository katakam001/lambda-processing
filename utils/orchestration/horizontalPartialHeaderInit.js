const bankConfig = require('../../config/bankConfig');
const { isHorizontalLine } = require('../lineUtils.js');

function initPages(rawItemsByPage, tableDataByPage, bankName) {
    if (bankConfig.banksToFilterMultipleHeaderInSamePage.includes(bankName)) {
        return Object.entries(rawItemsByPage).map(([pageNum, data], index) => {
            if (index === 0) {
                const override = tableDataByPage[pageNum];
                return [pageNum, override ?? data];
            }
            return [pageNum, data];
        });
    }
    return Object.entries(tableDataByPage);
}

function filterFirstPageItems(firstPageItems) {
    return firstPageItems.filter(item => {
        const text = item.text?.trim();
        return text && !isHorizontalLine(text);
    });
}

module.exports = { initPages, filterFirstPageItems };
