const { groupItemsByYLegacy } = require('../lineUtils');
const { findTransactionIdRowGroup } = require('./filters');
const { injectFallbackTable } = require('../tableUtils');
const { combineMultiLineRows } = require('../lineUtils');
const { formatCombinedRows } = require('../lineUtils');
const { combineWrappedAmounts } = require('../balanceUtils');

/**
 *
 * Steps:
 *  1. On page 1, copy rawItemsByPage into tableDataByPage.
 *  2. Merge multi-line rows and wrapped amounts for cleaner grouping.
 *  3. Group items by Y-axis (legacy bucketing).
 *  4. Detect valid transaction ID row group using regex patterns.
 *  5. If found and headers didn’t populate, inject fallback table.
 *
 */
function validateHeaderWithTransactionId(
    page,
    rawItemsByPage,
    tableDataByPage) {
    // Step 1: Copy raw items into tableData for page 1
    if (parseInt(page) === 1) {
        rawItemsByPage[page] = tableDataByPage[page];
    }

    // Step 2: Merge rows and amounts and fix the Dates.
    const mergedXAxisRows = combineMultiLineRows(rawItemsByPage[page]);
    const formattedRows = formatCombinedRows(mergedXAxisRows);
    const mergeWrappedAmount = combineWrappedAmounts(formattedRows);

    // Step 3: Group by Y-axis
    const yGroups = groupItemsByYLegacy(mergeWrappedAmount);

    // Step 4: Detect valid transaction ID row group
    const validRowGroup = findTransactionIdRowGroup(yGroups);

    // Step 5: Inject fallback if valid group found and headers didn’t populate
    if (validRowGroup && !tableDataByPage[page]?.length) {
        injectFallbackTable(page, mergeWrappedAmount, tableDataByPage);
    }
}

module.exports = { validateHeaderWithTransactionId };
