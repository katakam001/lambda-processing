/**
 *
 * Purpose:
 *  - Apply +1 offset to Debit/Credit headers.
 */
function applyDebitCreditOffsets(page, headerPositionsByPage) {
    ["Debit(Rs)", "Credit(Rs)"].forEach(header => {
        if (headerPositionsByPage[page][header] !== undefined) {
            headerPositionsByPage[page][header] += 1;
        }
    });
}

module.exports = { applyDebitCreditOffsets };
