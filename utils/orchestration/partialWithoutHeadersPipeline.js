const { groupItemsByY } = require('../lineUtils');
const { initPagesWithoutHeaders } = require('./partialWithoutHeadersInit');
const { parseRowsWithoutHeaders } = require('./partialWithoutHeadersRowParser');

/**

 */
function applyPartialWithoutHeadersMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName) {
  const pages = initPagesWithoutHeaders(rawItemsByPage, bankName);
  let skipMode = true; // start in skip mode for page 1
  const firstHeaderPositions = headerPositionsByPage[1]; // assume page 1 has headers

  pages.forEach(([page, items]) => {
    const groupByY = groupItemsByY(items, 0.01);
    const { flattened, skipMode: newSkipMode } =
      parseRowsWithoutHeaders(groupByY, firstHeaderPositions, skipMode);

    skipMode = newSkipMode;
    tableDataByPage[page] = flattened;
  });

  return { tableDataByPage };
}

module.exports = { applyPartialWithoutHeadersMerge };
