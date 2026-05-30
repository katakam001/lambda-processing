const { groupItemsByY } = require('../lineUtils');
const { getGroupsFromValidOnward } = require('./filters');

function validateRefNoAndNarration(page, items, tableDataByPage) {
    const groupByY = groupItemsByY(items, 0.3);
    const filterGroupByY = getGroupsFromValidOnward(groupByY);
    tableDataByPage[page] = filterGroupByY.flat();
}

module.exports = { validateRefNoAndNarration };
