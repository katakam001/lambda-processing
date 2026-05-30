const { filterValidGroupsWithSkipMode } = require('./filters');

/**
 * Parse rows for banks in "without partial headers" case.
 */
function parseRowsWithoutHeaders(groupByY, headerPositions, skipMode) {
    const { validGroups, skipMode: newSkipMode } =
        filterValidGroupsWithSkipMode(groupByY, Object.keys(headerPositions), skipMode);

    const flattened = Object.values(validGroups).flat();
    return { flattened, skipMode: newSkipMode };
}

module.exports = { parseRowsWithoutHeaders };
