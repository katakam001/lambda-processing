const { groupItemsByY } = require('../lineUtils');
const { estimateHeaderPositions } = require('../headerUtils');
const { filterValidGroupsWithFuzzyLogicSkipMode } = require('./filters');
const { parseTransactionRowsWithFuzzyLogic } = require('./parsers.js');

function applyMergeHeadersOnePageMultipleTimes(
    tableDataByPage,
    rawItemsByPage,
    headerPositionsByPage
) {
    const pages = Object.entries(tableDataByPage);
    const [firstPageKey] = pages[0];

    // Step 1: Infer header positions from first page
    const stretchConfig = {};
    const headerXMap = estimateHeaderPositions(
        headerPositionsByPage[firstPageKey]['Txn Date'],
        Object.keys(headerPositionsByPage[firstPageKey]),
        stretchConfig
    );

    let skipMode = true; // start in skip mode for page 1

    // Step 2: Process each page
    pages.forEach(([page]) => {
        headerPositionsByPage[page] = { ...headerXMap };

        const { validGroups, skipMode: newSkipMode } =
            filterValidGroupsWithFuzzyLogicSkipMode(
                groupItemsByY(rawItemsByPage[page], 0.01),
                Object.keys(headerPositionsByPage[page]),
                skipMode
            );

        skipMode = newSkipMode; // carry forward state

        const flattened = Object.values(
            parseTransactionRowsWithFuzzyLogic(validGroups, headerPositionsByPage[page])
        ).flat();

        tableDataByPage[page] = flattened;
    });
}

module.exports = { applyMergeHeadersOnePageMultipleTimes };
