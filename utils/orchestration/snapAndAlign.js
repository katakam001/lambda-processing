const bankConfig = require('../../config/bankConfig');
const { snapXCoordinate, snapToColumn, snapToColumnWithAlignment } = require('../snapUtils.js');

/**
 * snapAndAlign.js
 *
 * Purpose:
 *  - Snap raw table items to their nearest header columns.
 *  - Apply alignment rules (left/center/right) when required.
 *  - Handle special X-axis adjustments for certain banks.
 
 */
function snapAndAlign(page, items, columnXMap, alignments, bankName, width = 1) {
    let snappedTableData;

    // Case 1: Banks requiring alignment-aware snapping
    if (bankConfig.banksToIncludeHeadersAlign.includes(bankName)) {
        snappedTableData = items.map(item =>
            snapToColumnWithAlignment(item, columnXMap, alignments, width)
        );
    } else {
        // Case 2: Default snapping
        snappedTableData = items.map(item =>
            snapToColumn(item, columnXMap)
        );
    }

    // Case 3: Banks requiring X-axis adjustment for "Chq No" and "Particulars"
    if (bankConfig.banksToIncludeHeadersAlignChangeXAxis.includes(bankName)) {
        snappedTableData = snapXCoordinate(
            snappedTableData,
            columnXMap["Chq No"],
            columnXMap["Particulars"],
            0.1
        );
    }

    return snappedTableData;
}

module.exports = { snapAndAlign };
