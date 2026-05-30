const { groupItemsByY } = require('../lineUtils');
const { findValidRowGroupByGroupByY } = require('./filters');
const { adjustHeaderPositionsByGroupByY } = require('../headerUtils');


function applyPartialHeaderMerge(tableDataByPage, headerPositionsByPage) {
    const pages = Object.entries(tableDataByPage);
    const [firstPageKey, firstPageItems] = pages[0];

    // Step 1: Group items by Y-axis
    const groupByY = groupItemsByY(firstPageItems, 0.01);

    // Step 2: Find a valid row group
    const validRowGroup = findValidRowGroupByGroupByY(groupByY);
    if (!validRowGroup) return; // nothing to adjust

    // Step 3: Adjust header positions on first page
    adjustHeaderPositionsByGroupByY(validRowGroup, headerPositionsByPage[firstPageKey]);

    // Step 4: Propagate corrected header positions to all pages
    const firstHeaderPositions = headerPositionsByPage[firstPageKey];
    pages.forEach(([page]) => {
        headerPositionsByPage[page] = { ...firstHeaderPositions };
    });
}

module.exports = { applyPartialHeaderMerge };
