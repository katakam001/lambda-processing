const bankConfig = require('../../config/bankConfig');

/**
 * prepareAlignments.js
 *
 * Purpose:
 *  - Mutate the existing alignments object with bank-specific rules.
 *  - Return the snapping tolerance width.
 */
function prepareAlignments(bankName, alignments) {
    let width = 1;

    // Case 1: Banks requiring Deposit/Balance left alignment
    if (bankConfig.banksToIncludeChangeHeadersAlign.includes(bankName)) {
        alignments["Deposit"] = "left";
        alignments["Balance"] = "left";
        width = 0.5;
    }

    // Case 2: Banks requiring Debit/Credit/Balance/etc. left alignment
    if (bankConfig.banksToIncludeChangeHeadersAlignWithAmounts.includes(bankName)) {
        ["Debit", "Credit", "Balance", "BALANCE", "VALUE DATE", "TXN DATE"].forEach(header => {
            alignments[header] = "left";
        });
        width = 0.2;
    }

    return width;
}

module.exports = { prepareAlignments };
