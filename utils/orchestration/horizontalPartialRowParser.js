const { parseGroupRows, parseMultipleHeaderGroupRows, parseStructuredRows } = require('./parsers');
const { filterValidGroups, filterValidGroupsWithSkipMode } = require('./filters');
const bankConfig = require('../../config/bankConfig');

function parseRows(groupByY, headerPositions, prevBalance, bankName, skipMode) {
    let flattened = [];

    if (bankConfig.banksToFilterMultipleHeaderInSamePage.includes(bankName)) {
        // Multiple headers in same page → filter groups and parse accordingly
        const validGroups = filterValidGroups(groupByY, Object.keys(headerPositions));

        if (bankConfig.banksToIncludeParitalMergeHeadersWithDifferentSpaces.includes(bankName)) {
            flattened = Object.values(
                parseMultipleHeaderGroupRows(validGroups, headerPositions, prevBalance)
            ).flat();
        } else {
            flattened = Object.values(
                parseGroupRows(validGroups, headerPositions)
            ).flat();
        }

        // ⚠️ No balance update in this branch
        return { flattened, skipMode, shouldUpdateBalance: false };
    }

    // Default branch → structured parsing with skipMode
    const { validGroups, skipMode: newSkipMode } =
        filterValidGroupsWithSkipMode(groupByY, Object.keys(headerPositions), skipMode);

    flattened = Object.values(
        parseStructuredRows(validGroups, headerPositions, prevBalance)
    ).flat();

    // ✅ Balance update only in this branch
    return { flattened, skipMode: newSkipMode, shouldUpdateBalance: true };
}

module.exports = { parseRows };
