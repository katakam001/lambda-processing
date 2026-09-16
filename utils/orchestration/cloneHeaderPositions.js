const bankConfig = require('../../config/bankConfig');
/**
 *
 * Purpose:
 *  - Clone header positions from Page 1 to the current page.
 *  - Skip Page 1 unless bankConfig requires re-alignment.
 *  - Restore Narration override if present.
 */
function cloneHeaderPositions(page, headerPositionsByPage, firstHeaderPositions) {
    if (!bankConfig.banksToIncludeChangeHeadersXAxisForAmounts.includes(bankName) && parseInt(page) === 1) {
        return;
    }

    const narrationOverride = headerPositionsByPage[page]?.["Narration"];
    headerPositionsByPage[page] = { ...firstHeaderPositions };

    if (narrationOverride !== undefined) {
        headerPositionsByPage[page]["Narration"] = narrationOverride;
    }
}

module.exports = { cloneHeaderPositions };
