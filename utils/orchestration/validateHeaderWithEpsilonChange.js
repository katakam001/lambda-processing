const { groupItemsByY } = require('../lineUtils');
const { getGroupsFromValidOnward } = require('./filters');

function validateHeaderWithEpsilonChange(page, items, tableDataByPage) {
    const groupByY = groupItemsByY(items, 0.55);
    const filterGroupByY = getGroupsFromValidOnward(groupByY, true);
    // Convert object → array of arrays → flatten
    const rows = Object.values(filterGroupByY).flat();

    tableDataByPage[page] = rows.filter(
        row => !/^\(\d{1,2}-[A-Za-z]{3}-\d{2}\)$/.test(row.text.trim())
    );
}

module.exports = { validateHeaderWithEpsilonChange };
