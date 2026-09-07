const bankConfig = require('../../config/bankConfig');

/**
 *
 * Purpose:
 *  - Apply +1 offset to Debit/Credit headers.
 */
function applyDebitCreditOffsets(page, headerPositionsByPage, bankName) {
    if (
        bankConfig.banksToIncludeHeadernWithEpsilionChangeWithTwoDates.includes(bankName)
    ) {
        return;
    }
    ["Debit(Rs)", "Credit(Rs)"].forEach(header => {
        if (headerPositionsByPage[page][header] !== undefined) {
            headerPositionsByPage[page][header] += 1;
        }
    });
}

module.exports = { applyDebitCreditOffsets };
