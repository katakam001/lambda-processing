const { groupItemsByY, filterGroupedByY } = require('../lineUtils');
const bankConfig = require('../../config/bankConfig');

// How it works:
//   1. Check if the current bank is configured for table end filtering.
//   2. For each page in tableDataByPage:
//        - If a cutoff Y position exists for that page:
//            a. Group items by their Y coordinate (with tolerance).
//            b. Filter out groups that fall below the cutoff.
//            c. Flatten the remaining groups back into a single array.
//            d. Replace the page’s data with the filtered array.
//   3. Return the updated tableDataByPage.

function applyTableEndFilter(tableDataByPage, tableEndYByPage) {
    const pages = Object.entries(tableDataByPage);

    pages.forEach(([page, items]) => {
        if (tableEndYByPage[page]) {
            const groupByY = groupItemsByY(items, 0.01);
            const filteredGroups = filterGroupedByY(groupByY, tableEndYByPage[page]);
            const flattened = Object.values(filteredGroups).flat();
            tableDataByPage[page] = flattened; // mutate in place
        }
    });

    return tableDataByPage;
}

module.exports = { applyTableEndFilter };
