function cloneHeadersFromPage1(headerPositionsByPage, firstHeaderPositions, page) {
    headerPositionsByPage[page] = { ...firstHeaderPositions };
}
module.exports = { cloneHeadersFromPage1 };
