/**
 *
 * Purpose:
 *  - Apply +2 offset to Instrument/Amount headers.
 */
function applyAmountOffsets(page, headerPositionsByPage) {
    [
        "Instrument No",
        "Withdrawals(Rs.)",
        "Debit in Rs.",
        "Credit in Rs.",
        "Deposits(Rs.)",
        "Balance(Rs.)",
    ].forEach(header => {
        if (headerPositionsByPage[page][header] !== undefined) {
            headerPositionsByPage[page][header] += 2;
        }
    });
}

module.exports = { applyAmountOffsets };
