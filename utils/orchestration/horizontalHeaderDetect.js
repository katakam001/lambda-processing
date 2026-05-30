const { detectHeaderLine, sanitizeHeaderText, estimateHeaderXMap } = require('../headerUtils');
const { groupItemsByY, mergeGroupedText } = require('../lineUtils');

function inferHeaderMap(firstPageItems, headerVariants) {
    const groupByY = groupItemsByY(firstPageItems, 0.01);
    const mergedLines = mergeGroupedText(groupByY);

    const header = detectHeaderLine(mergedLines, headerVariants);
    const cleanText = sanitizeHeaderText(header.text, header.headerSet);
    const headerXMap = estimateHeaderXMap(cleanText, 0, 1);

    return { headerXMap, cleanText, mergedLines };
}

module.exports = { inferHeaderMap };
