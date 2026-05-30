const { groupItemsByY } = require('../lineUtils');
const { filterAfterBroughtForward, findValidRowGroupByFilteredData } = require('./filters');
const { cleanGroupedByYAxis } = require('../lineUtils');
const { mergeAmountFragments, mergeBalanceFragments } = require('../balanceUtils');
const { areAllEqualPositions, adjustHeaderPositionsByFilteredData } = require('../headerUtils');

/**
 *
 * Workflow:
 *   1. On the first page:
 *      - Check if Debit, Credit, Balance are all equal (mis-snapped).
 *      - If so, group items by Y-axis and filter out "Brought Forward" rows.
 *      - Find a valid row group containing date, amount, narration, and balance.
 *      - Adjust Balance and Credit header positions based on detected values.
 *
 *   2. On subsequent pages:
 *      - If headers were corrected on page 1, propagate those positions.
 *      - Group items by Y-axis, clean and filter them.
 *      - Merge split amount fragments and balance fragments.
 *      - Flatten groups back into tableDataByPage for downstream parsing.
 */


function applyPartialHeaderBalanceMerge(tableDataByPage, headerPositionsByPage) {
    const pages = Object.entries(tableDataByPage);
    const [firstPageKey, firstPageItems] = pages[0];

    const allEqual = areAllEqualPositions(headerPositionsByPage[firstPageKey]);

    if (allEqual) {
        const groupByY = groupItemsByY(firstPageItems, 0.01);
        const cleanGroupByYAxis = cleanGroupedByYAxis(groupByY);
        const filteredData = filterAfterBroughtForward(cleanGroupByYAxis);

        const validRowGroup = findValidRowGroupByFilteredData(filteredData);
        if (validRowGroup) {
            adjustHeaderPositionsByFilteredData(validRowGroup, headerPositionsByPage[firstPageKey]);
        }
    }

    pages.forEach(([page, items]) => {
        if (allEqual && parseInt(page) > 1) {
            headerPositionsByPage[page]['Credit'] = headerPositionsByPage[firstPageKey]['Credit'];
            headerPositionsByPage[page]['Balance'] = headerPositionsByPage[firstPageKey]['Balance'];
        }

        const groupByY = groupItemsByY(items, 0.01);
        const cleanGroupByYAxis = cleanGroupedByYAxis(groupByY);
        const filteredData = filterAfterBroughtForward(cleanGroupByYAxis);
        const mergeSplitAmountData = mergeAmountFragments(filteredData, headerPositionsByPage[page]);
        const mergeSplitBalanceData = mergeBalanceFragments(mergeSplitAmountData, headerPositionsByPage[page]);

        tableDataByPage[page] = Object.values(mergeSplitBalanceData).flat();
    });
}

module.exports = { applyPartialHeaderBalanceMerge };
