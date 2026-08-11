const groupItemsByY = (items, epsilon) => {
    const grouped = [];

    for (const item of items) {
        const matchGroup = grouped.find(group =>
            Math.abs(group[0].y - item.y) <= epsilon
        );

        if (matchGroup) {
            matchGroup.push(item);
        } else {
            grouped.push([item]);
        }
    }

    // Convert to a map with rounded keys if needed
    const groupedByY = {};
    grouped.forEach(group => {
        const key = group[0].y.toFixed(3);
        groupedByY[key] = group;
    });

    return groupedByY;
};

function groupItemsByYLegacy(items) {
    const yGroups = {};
    items.forEach(({ text, x, y }) => {
        const key = Math.round(y * 10); // integer bucket
        yGroups[key] = yGroups[key] || [];
        yGroups[key].push({ text, x, y });
    });
    return yGroups;
}

const groupRowsByY = (filteredRows) => {
    const groupedTextByY = new Map();
    filteredRows.forEach(item => {
        const yKey = Math.round(item.y * 100) / 100;
        if (!groupedTextByY.has(yKey)) groupedTextByY.set(yKey, []);
        groupedTextByY.get(yKey).push({ text: item.text, x: item.x });
    });

    return Array.from(groupedTextByY.entries()).map(([y, row]) => ({
        text: row.map(r => r.text).join(" "),
        y,
        x: row[0].x
    }));
};

const filterGroupedByY = (groupedByY, thresholdY) => {
    const filtered = {};

    Object.entries(groupedByY).forEach(([key, group]) => {
        const yValue = parseFloat(key);
        if (yValue < thresholdY) {
            filtered[key] = group;
        }
    });

    return filtered;
};

const mergeGroupedText = (groupedByY) => {
    const mergedLines = {};

    for (const [yKey, items] of Object.entries(groupedByY)) {
        const mergedText = items.map(item => item.text).join('');
        mergedLines[yKey] = mergedText;
    }

    return mergedLines;
};

// Function to combine multi-line rows
const combineMultiLineRows = rows => {
    const combinedRows = [];
    let tempRow = null; // Temporarily hold a row to combine text

    rows.forEach(row => {
        if (tempRow && Math.abs(tempRow.x - row.x) < 0.1) {
            // Combine text if x-coordinates are the same (or very close)
            tempRow.text += ` ${row.text}`;
            tempRow.y = Math.max(tempRow.y, row.y); // Keep the larger y-value
        } else {
            // Push the previous row to the result if it exists
            if (tempRow) {
                combinedRows.push(tempRow);
            }
            // Start a new temp row
            tempRow = { ...row };
        }
    });

    // Push the last remaining row
    if (tempRow) {
        combinedRows.push(tempRow);
    }

    return combinedRows;
};

const combineYAxisSameMultiLineRows = rows => {
    const combinedRows = [];
    let tempRow = null; // Temporarily hold a row to combine text

    rows.forEach(row => {
        if (tempRow && Math.abs(tempRow.x - row.x) < 0.1 && Math.abs(tempRow.y - row.y) < 0.1) {
            // Combine text if x-coordinates are the same (or very close)
            tempRow.text += ` ${row.text}`;
            tempRow.y = Math.max(tempRow.y, row.y); // Keep the larger y-value
        } else {
            // Push the previous row to the result if it exists
            if (tempRow) {
                combinedRows.push(tempRow);
            }
            // Start a new temp row
            tempRow = { ...row };
        }
    });

    // Push the last remaining row
    if (tempRow) {
        combinedRows.push(tempRow);
    }

    return combinedRows;
};

const mergeNarrationLines = (
    items,
    narrationAnchorX,
    dateAnchorX,
    sortRequired,
    xThreshold,
    yThreshold
) => {
    // 🔍 Filter only narration candidates based on X-position
    const narrationAndDateItems = items.filter(item =>
        Math.abs(item.x - narrationAnchorX) < xThreshold ||
        Math.abs(item.x - dateAnchorX) < xThreshold
    );

    // console.log(narrationAndDateItems);

    // 📐 Sort vertically for top-to-bottom narration stitching
    const sorted = sortRequired ? [...narrationAndDateItems].sort((a, b) => a.y - b.y) : narrationAndDateItems;

    const combinedRows = [];
    let tempRow = null; // Temporarily hold a row to combine text

    sorted.forEach(row => {
        if (tempRow && Math.abs(tempRow.x - row.x) < xThreshold && Math.abs(tempRow.y - row.y) < yThreshold) {
            // Combine text if x-coordinates are the same (or very close)
            tempRow.text += ` ${row.text}`;
            tempRow.y = Math.max(tempRow.y, row.y); // Keep the larger y-value
        } else {
            // Push the previous row to the result if it exists
            if (tempRow) {
                combinedRows.push(tempRow);
            }
            // Start a new temp row
            tempRow = { ...row };
        }
    });

    // Push the last remaining row
    if (tempRow) {
        combinedRows.push(tempRow);
    }

    return combinedRows.filter(item =>
        Math.abs(item.x - narrationAnchorX) < xThreshold
    );
};

const cleanGroupedByYAxis = (groupedByYAxis) => {
    const cleaned = {};

    Object.entries(groupedByYAxis).forEach(([yKey, items]) => {
        const filteredItems = items
            .filter(({ text }) => {
                const trimmed = text.trim();
                return trimmed !== '' && trimmed !== '.';
            })
            .map(({ text, x, y }) => ({
                text: text.trim(),
                x,
                y
            }));

        if (filteredItems.length > 0) {
            cleaned[yKey] = filteredItems;
        }
    });

    return cleaned;
};

const combineDateFragments = (rows) => {
    const combined = [];
    let skipNext = false;

    for (let i = 0; i < rows.length - 1; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const current = rows[i];
        const next = rows[i + 1];

        // Case 1: "14 Apr" + "2024"
        const isDayMonthYearPair =
            Math.abs(current.y - next.y) <= 1.0 &&
            Math.abs(current.x - next.x) <= 3.5 &&
            /\d{1,2}\s\w{3}/.test(current.text) &&   // matches "14 Apr"
            /^\d{4}$/.test(next.text);               // matches "2024"

        // Case 2: "02/07" + "/2025"
        const isSlashDatePair =
            Math.abs(current.y - next.y) <= 1.5 &&
            Math.abs(current.x - next.x) <= 0.01 &&
            /^\d{1,2}\/\d{1,2}$/.test(current.text) && // matches "02/07"
            /^\/\d{4}$/.test(next.text);               // matches "/2025"

        // Case 3: "06/11/" + "2025"
        const isTrailingSlashDatePair =
            Math.abs(current.y - next.y) <= 1.5 &&
            Math.abs(current.x - next.x) <= 0.3 &&
            /^\d{1,2}\/\d{1,2}\/$/.test(current.text) && // matches "06/11/"
            /^\d{4}$/.test(next.text);                   // matches "2025"

        if (isDayMonthYearPair) {
            combined.push({
                text: `${current.text} ${next.text}`, // "14 Apr 2024"
                x: current.x,
                y: Math.max(current.y, next.y)
            });
            skipNext = true;
        } else if (isSlashDatePair) {
            combined.push({
                text: `${current.text}${next.text}`, // "02/07/2025"
                x: current.x,
                y: Math.max(current.y, next.y)
            });
            skipNext = true;
        } else if (isTrailingSlashDatePair) {
            combined.push({
                text: `${current.text}${next.text}`, // "06/11/2025"
                x: current.x,
                y: Math.max(current.y, next.y)
            });
            skipNext = true;
        } else {
            combined.push(current);
        }
    }

    // Push the last item if not merged
    if (!skipNext && rows.length > 0) {
        combined.push(rows[rows.length - 1]);
    }

    return combined;
};

// 🔹 Helper to clean up date formatting
const formatDateText = (text) =>
    text.trim().replace(/-\s+(\d{4})$/, "-$1");

// 🔹 Wrapper to apply formatting only for dates
const formatCombinedRows = (combinedRows) =>
    combinedRows.map(r => {
        let text = r.text;
        // Apply formatting only if it looks like a date with a year
        if (/(\d{1,2}-[A-Za-z]{3}-\s+\d{4})/.test(text)) {
            text = formatDateText(text);
        }
        return { ...r, text };
    });

const isHorizontalLine = (text) => {
    // Must contain at least 10 hypens, spaces allowed
    const pattern = /^(?:-+\s*){10,}$/;
    return pattern.test(text);
};

module.exports = { groupItemsByY, groupItemsByYLegacy, filterGroupedByY, mergeGroupedText, combineMultiLineRows, combineYAxisSameMultiLineRows, mergeNarrationLines, cleanGroupedByYAxis, combineDateFragments, isHorizontalLine, groupRowsByY, formatCombinedRows };
