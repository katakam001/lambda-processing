const { groupItemsByY } = require('../lineUtils');
const { cloneHeadersFromPage1 } = require('./onePageHeaderClone');
const { updatePreviousBalance } = require('./onePageBalanceCarry');
const { filterRows } = require('./onePageRowFilter');
const { isValidRowGroup } = require('./onePageRowValidator');


/**
 *
 * Preconditions:
 *   - isAFuzzyLogic must be false
 *   - alignments["Post Date"] must exist
 *   - bankName must be in banksToIncludeMergeHeadersInOnePage
 *
 * Steps:
 *   1. Use Page 1 header positions as canonical headers.
 *   2. Iterate through each page:
 *      - Group items by Y coordinate (Page 1 uses tableDataByPage, others use rawItemsByPage).
 *      - Extract or retain previous balance from groups.
 *      - Skip Page 1 (already handled).
 *      - Clone Page 1 headers into current page.
 *      - Filter rows:
 *          * Skip BROUGHT FORWARD rows.
 *          * If balance missing, wait until "Statement of Account" appears.
 *      - Collect valid rows into allParsedItems.
 *   3. Validate row groups:
 *      - Transaction row: must contain ≥2 dates, ≥1 amount, ≥1 narration text.
 *      - Narration-only row: no dates/amounts, but ≥1 narration text.
 *   4. If validation passes, update tableDataByPage[page] with parsed items.
 *
 */

function applyOnePageMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage) {
    const firstHeaderPositions = headerPositionsByPage[1];
    let previousBalance = null;

    Object.keys(tableDataByPage).forEach(page => {

        const groupByY = parseInt(page) === 1
            ? groupItemsByY(tableDataByPage[page], 0.01)
            : groupItemsByY(rawItemsByPage[page], 0.01);

        previousBalance = updatePreviousBalance(groupByY, previousBalance);

        if (parseInt(page) === 1) return; // skip Page 1

        cloneHeadersFromPage1(headerPositionsByPage, firstHeaderPositions, page);

        const allParsedItems = filterRows(groupByY, previousBalance);

        if (isValidRowGroup(allParsedItems)) {
            tableDataByPage[page] = allParsedItems;
        }
    });

    return { tableDataByPage, headerPositionsByPage };
}

module.exports = { applyOnePageMerge };
