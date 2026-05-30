const bankConfig = require('../../config/bankConfig');
const { groupItemsByY } = require('../lineUtils');
const { mergeHeadersAcrossPages } = require('./headerMerge');
const { applyBalanceCarryForward, updateBalanceFromParsed } = require('./balanceCarryForward');
const { parseTransactions } = require('./transactionPipeline');
const { updateGroupsWithAmountItems } = require('../balanceUtils');
const { updateGroupsWithChequeNo, cleanChequeNoFromAmount } = require('./enrich');

/**
 *
 * Behavior:
 *   - One-page strategy:
 *       * Infer header positions from first page.
 *       * For Page 1 → group from tableDataByPage.
 *       * For other pages → group from rawItemsByPage.
 *       * Carry forward balances and parse transactions.
 *   - Multi-page strategy:
 *       * Infer headers across pages.
 *       * Group items with tolerance.
 *       * Enrich groups with cheque/amount fields.
 *       * Flatten into tableDataByPage.
 */

function applyMultiPageMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName) {
    const { headerXMap, strategy } = mergeHeadersAcrossPages(tableDataByPage, headerPositionsByPage, bankName);
    let previousBalance = null;

    Object.entries(tableDataByPage).forEach(([page, items]) => {
        headerPositionsByPage[page] = { ...headerXMap };

        if (strategy === 'onePage') {
            const groupByY = parseInt(page) === 1
                ? groupItemsByY(tableDataByPage[page], 0.01)
                : groupItemsByY(rawItemsByPage[page], 0.01);

            previousBalance = applyBalanceCarryForward(groupByY, previousBalance);

            const parsedItems = parseTransactions(groupByY, headerPositionsByPage[page], previousBalance);
            previousBalance = updateBalanceFromParsed(parsedItems, headerPositionsByPage[page], previousBalance);
            tableDataByPage[page] = parsedItems;

        } else {
            const groupByY = groupItemsByY(items, 0.200);

            updateGroupsWithAmountItems(groupByY, headerXMap);
            updateGroupsWithChequeNo(groupByY, headerXMap);
            cleanChequeNoFromAmount(groupByY, headerXMap);

            tableDataByPage[page] = Object.values(groupByY).flat();
        }
    });

    return { tableDataByPage, headerPositionsByPage };
}

module.exports = { applyMultiPageMerge };
