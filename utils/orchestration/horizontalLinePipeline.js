const { inferHeaderMap } = require('./horizontalHeaderDetect');
const { extractInitialBalance, updatePrevBalance } = require('./horizontalBalanceCarry');
const { parsePageRows } = require('./horizontalRowParser');

/**
 *
 * Steps:
 *   1. Infer headers from the first page:
 *      - Group items by Y coordinate and merge text lines.
 *      - Detect header line, sanitize text, and estimate headerXMap.
 *      - Extract initial balance from merged lines.
 *
 *   2. Iterate through all pages:
 *      - Clone headerXMap into headerPositionsByPage[page].
 *      - Group and merge lines for the current page.
 *      - Choose parsing strategy:
 *          * Pipe-delimited → parseDataRows + carry-forwarded particulars.
 *          * Space-aligned → parseTransactionRows with prevBalance.
 *      - Flatten parsed rows into a single array.
 *
 *   3. Update balance carry-forward:
 *      - Find the last balance field in the flattened rows.
 *      - Normalize its value and update prevBalance for the next page.
 *
 *   4. Save results:
 *      - Update tableDataByPage[page] with flattened rows.
 *
 */

function applyHorizontalLineMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName, headerVariants) {
    const pages = Object.entries(rawItemsByPage);

    // Infer header map and initial balance from first page
    const [firstPageKey, firstPageItems] = pages[0];
    const { headerXMap, cleanText, mergedLines } = inferHeaderMap(firstPageItems, headerVariants);
    let prevBalance = extractInitialBalance(mergedLines);

    // Apply header map across all pages
    pages.forEach(([page, items]) => {
        headerPositionsByPage[page] = { ...headerXMap };

        const flattened = parsePageRows(items, headerPositionsByPage[page], cleanText, prevBalance, page);

        // Update prevBalance for next page
        const updatedBalance = updatePrevBalance(flattened, headerXMap);
        if (updatedBalance !== null) {
            prevBalance = updatedBalance;
        }

        tableDataByPage[page] = flattened;
    });

    return { tableDataByPage, headerPositionsByPage };
}

module.exports = { applyHorizontalLineMerge };
