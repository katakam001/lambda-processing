const { groupItemsByYLegacy } = require('../lineUtils');
const { findTimeStampRowGroups } = require('./filters');
const { combineMultiLineRows } = require('../lineUtils');
const { combineWrappedAmounts } = require('../balanceUtils');

function validateHeaderWithTimeStamp(
    page,
    rawItemsByPage,
    tableDataByPage
) {

    // Step 1: Copy raw items into tableData for page 1
    if (parseInt(page) === 1) {
        rawItemsByPage[page] = tableDataByPage[page];
    }

    // Step 2: Merge rows and amounts
    const mergedXAxisRows = combineMultiLineRows(rawItemsByPage[page]);
    const mergeWrappedAmount = combineWrappedAmounts(mergedXAxisRows);

    // Step 3: Group by Y-axis
    const yGroups = groupItemsByYLegacy(mergeWrappedAmount);

    // Step 4: Use helper to detect valid timestamp row groups
    const validDateGroups = findTimeStampRowGroups(yGroups);

    // Step 5: Flatten and inject into tableDataByPage
    const flattened = validDateGroups.flat();
    tableDataByPage[page] = flattened;
}

module.exports = { validateHeaderWithTimeStamp };
