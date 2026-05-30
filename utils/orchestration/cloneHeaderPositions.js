const bankConfig = require('../../config/bankConfig');
/**
 *
 * Purpose:
 *  - Clone header positions from Page 1 to the current page.
 *  - Skip Page 1 unless bankConfig requires re-alignment.
 *  - Restore Narration override if present.
 */
function cloneHeaderPositions(page, headerPositionsByPage, bankName) {
    const firstHeaderPositions = headerPositionsByPage[1]; // Assume Page 1 always has headers
    console.log(firstHeaderPositions);

    if (
        !bankConfig.banksToIncludeChangeHeadersXAxisForAmounts.includes(bankName) &&
        parseInt(page) === 1
    ) {
        return;
    }

    const narrationOverride = headerPositionsByPage[page]?.["Narration"];
    headerPositionsByPage[page] = { ...firstHeaderPositions };

    if (narrationOverride !== undefined) {
        headerPositionsByPage[page]["Narration"] = narrationOverride;
    }
}

module.exports = { cloneHeaderPositions };
