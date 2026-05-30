const snapXCoordinate = (items, sourceX, targetX, epsilon) => {
    return items.map(item => {
        if (Math.abs(item.x - sourceX) < epsilon) {
            return { ...item, x: targetX };
        }
        return item;
    });
};

const snapToColumn = (item, columnXMap) => {
    let closestX = item.x;
    let minDist = Infinity;

    for (const col in columnXMap) {
        const dist = Math.abs(item.x - columnXMap[col]);
        if (dist < minDist) {
            minDist = dist;
            closestX = columnXMap[col];
        }
    }

    return { ...item, x: closestX };
};

const snapToColumnWithAlignment = (item, columnXMap, alignments, width) => {
    const textLength = item.text.trim().length;
    const applyOffset = textLength < 10; // Apply only if text is large enough
    let closestX = item.x;
    let minDist = Infinity;

    for (const col in columnXMap) {
        const alignment = alignments?.[col] ?? 'left'; // fallback to left
        // Adjust the reference point based on alignment
        let anchorX = columnXMap[col];
        if (applyOffset) {
            if (alignment === 'right') {
                anchorX += estimatedDataWidth(item.text, width);
            } else if (alignment === 'center') {
                anchorX += estimatedDataWidth(item.text, width) / 2;
            }
        }
        const dist = Math.abs(item.x - anchorX);
        if (dist < minDist) {
            minDist = dist;
            closestX = columnXMap[col];
        }
    }

    return { ...item, x: closestX };
};

const refineAmountSnappedToBalance = (item, amountX, balanceX) => {
    const text = item.text.trim();

    const isBalance = /(Cr|Dr)$/.test(text);
    const isAmount = /^[\d,]+(\.\d{1,2})?$/.test(text);

    // If it's not a balance but looks like an amount, snap it back
    if (item.x === balanceX && !isBalance && isAmount) {
        return { ...item, x: amountX };
    }

    return item;
};

const refineAmountAndBranchCode = (
    item,
    branchCodeX,
    amountX
) => {
    const isStrictAmount = text =>
        /^[\d,]+\.\d{2}$/.test(text.trim()); // e.g., 1,10,000.00 or 500.50

    if (item.x === amountX && !isStrictAmount(item.text)) {
        // Mis-snapped narration or non-amount at Amount position
        return { ...item, x: branchCodeX };
    }

    return item;
};

const refineYAxisOfParticularsWithDate = (
    item,
    dateX,
    particularsX,
    allItems,
    epsilon
) => {

    // Only target items aligned with 'Particulars' column
    if (item.x === particularsX) {
        const matchingDateItem = allItems.find(i =>
            i.x === dateX && Math.abs(i.y - item.y) < epsilon
        );

        if (matchingDateItem) {
            return { ...item, y: matchingDateItem.y };
        }
    }

    return item;
};

const estimatedDataWidth = (text, width) => {
    return text.trim().length * width;
};

module.exports = { snapXCoordinate, snapToColumn, snapToColumnWithAlignment, refineAmountSnappedToBalance, refineAmountAndBranchCode, refineYAxisOfParticularsWithDate };