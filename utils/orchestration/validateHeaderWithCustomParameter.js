const bankConfig = require('../../config/bankConfig');
const { groupItemsByYLegacy } = require('../lineUtils');
const { findValidRowGroupForNarration } = require('./filters');
const { injectFallbackTable } = require('../tableUtils');

/**
 *
 * Key Steps:
 *  1. Group items by Y-axis using legacy bucketing (Math.round(y*10)).
 *  2. Strict validation:
 *     - Requires ≥6 items in a row group.
 *     - At least 2 dates, 2 amounts, and 2 text tokens.
 *     - Used to realign the Narration header position.
 *  3. Loose validation:
 *     - Requires ≥5 items in a row group.
 *     - At least 1 date, 1 amount, and 1 text token.
 *     - Month-name date formats (e.g., dd-MMM-yyyy) allowed if bankConfig requires.
 *     - Used to inject a fallback table when headers are missing.
 *  4. Skip Page 1:
 *     - Page 1 is already handled by header detection logic, so fallback injection is skipped.
 *
 *
 * Notes:
 *  - Uses findValidRowGroupForNarration() helper for both strict and loose validation.
 *  - Uses injectFallbackTable() helper to populate tableDataByPage when headers fail.
 *  - Keeps parsing logic modular and reviewer-friendly.
 */

function validateHeaderWithCustomParameter(
    page,
    items,
    alignments,
    tableDataByPage,
    headerPositionsByPage,
    bankName
) {
    // ✅ Use legacy grouping (Math.round(y*10)) to preserve original behavior
    const yGroups = groupItemsByYLegacy(items);

    // Step 1: Narration realignment (strict validation)
    if (
        bankConfig.banksToIncludeRefineRefNoAndNarration.includes(bankName) &&
        alignments["Withdrawal"]
    ) {
        const narrationGroup = findValidRowGroupForNarration(yGroups, false, bankName);
        if (narrationGroup?.length >= 6) {
            const narration = narrationGroup[1]; // second item is typically narration
            headerPositionsByPage[page]["Narration"] = narration.x;
            console.log(`🎯 Narration header anchor realigned to x: ${narration.x}`);
        }
    }

    // Step 2: Fallback injection (loose validation)
    const validRowGroupLoose = findValidRowGroupForNarration(yGroups, true, bankName);

    if (parseInt(page) !== 1 && !tableDataByPage[page]?.length && validRowGroupLoose) {
        injectFallbackTable(page, items, tableDataByPage);
    }
}

module.exports = { validateHeaderWithCustomParameter };
