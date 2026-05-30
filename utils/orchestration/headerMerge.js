const { estimateHeaderPositions, inferHeaderXMap } = require('../headerUtils');
const bankConfig = require('../../config/bankConfig');

function mergeHeadersAcrossPages(tableDataByPage, headerPositionsByPage, bankName) {
    if (bankConfig.banksToIncludeMergeHeadersInOnePage.includes(bankName)) {
        const [firstPageKey] = Object.keys(tableDataByPage);
        const stretchConfig = { Details: 3 };
        const headerXMap = estimateHeaderPositions(
            headerPositionsByPage[firstPageKey]['Post Date'],
            Object.keys(headerPositionsByPage[firstPageKey]),
            stretchConfig
        );
        return { headerXMap, strategy: 'onePage' };
    } else {
        const [firstPageKey, firstPageItems] = Object.entries(tableDataByPage)[0];
        const headerXMap = inferHeaderXMap(firstPageItems);
        return { headerXMap, strategy: 'multiPage' };
    }
}

module.exports = { mergeHeadersAcrossPages };
