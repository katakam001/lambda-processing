const bankConfig = require('../../config/bankConfig');
const { groupItemsByY, isHorizontalLine } = require('../lineUtils');
const { reestimateHeaderMap, findAnchorHeaders } = require('../headerUtils');
const { initPages, filterFirstPageItems } = require('./horizontalPartialHeaderInit');
const { initPrevBalance, updatePrevBalance } = require('./horizontalPartialBalanceCarry');
const { parseRows } = require('./horizontalPartialRowParser');

/**
 *
 * Steps:
 *   1. Initialize pages (override first page if needed).
 *   2. Filter first page items to remove horizontal lines.
 *   3. Extract initial balance.
 *   4. Re-estimate header map from anchor headers.
 *   5. Iterate through all pages:
 *      - Clone header map.
 *      - Filter items to remove horizontal lines.
 *      - Group by Y and parse rows depending on bank config.
 *      - Carry forward skipMode state.
 *      - Update prevBalance from last balance field.
 *      - Save flattened rows into tableDataByPage.
 */

function applyHorizontalPartialLineMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName) {
    let pages = initPages(rawItemsByPage, tableDataByPage, bankName);
    const [firstPageKey, firstPageItems] = pages[0];

    const filteredFirstPageItems = filterFirstPageItems(firstPageItems);
    const firstPageGroupByY = groupItemsByY(filteredFirstPageItems, 0.01);

    let prevBalance = initPrevBalance(firstPageGroupByY, bankName);

    const headerXMap = reestimateHeaderMap(
        headerPositionsByPage[firstPageKey],
        findAnchorHeaders(headerPositionsByPage[firstPageKey])
    );

    if (bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName)) {
        pages = Object.entries(rawItemsByPage);
    }

    let skipMode = true; // start in skip mode for page 1

    pages.forEach(([page, items]) => {
        headerPositionsByPage[page] = { ...headerXMap };

        const filteredItems = items.filter(item => {
            const text = item.text?.trim();
            return text && !isHorizontalLine(text);
        });

        const groupByY = groupItemsByY(filteredItems, 0.01);

        const { flattened, skipMode: newSkipMode, shouldUpdateBalance } =
            parseRows(groupByY, headerPositionsByPage[page], prevBalance, bankName, skipMode);

        skipMode = newSkipMode;

        if (shouldUpdateBalance && flattened.length) {
            const updatedBalance = updatePrevBalance(flattened, headerXMap, headerPositionsByPage[page]);
            if (updatedBalance !== null) prevBalance = updatedBalance;
        }

        tableDataByPage[page] = flattened;
    });

    return { tableDataByPage, headerPositionsByPage };
}

module.exports = { applyHorizontalPartialLineMerge };
