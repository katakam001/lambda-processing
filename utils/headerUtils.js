
const detectPerRowHeader = (groupedRows) => {

    // ✅ Define expected header sets (all lowercase for consistency)
    const headerSets = [
        ["account name", "place", "debit amount"],
        ["account name", "place", "credit amount"],
        ["account name", "debit amount", "credit amount"]
    ];

    // ✅ Find the closest matching header row (convert row text to lowercase for comparison)
    const detectedHeaderRow = groupedRows.find(row =>
        headerSets.some(headerSet => headerSet.every(h => row.text.toLowerCase().includes(h)))
    );

    if (!detectedHeaderRow) return []; // ✅ No header row found

    // ✅ Identify the exact matching header set
    return headerSets.find(headerSet => headerSet.every(h => detectedHeaderRow.text.toLowerCase().includes(h))) || [];
};

const extractHeaderRowY = (groupedRows, detectedHeader) => {
    return groupedRows.find(row =>
        detectedHeader.every(header => row.text.toLowerCase().includes(header.toLowerCase()))
    )?.y || null; // ✅ Returns Y-coordinate or null if not found
};

const extractHeaderRow = (filteredRows, headerRowY, tolerance = 0.01) => {
    return filteredRows.filter(row => Math.abs(row.y - headerRowY) <= tolerance);
};

const extractHeaderPositions = (headerRow, detectedHeader) => {
    const headerPositions = {};

    detectedHeader.forEach(header => {
        const headerWords = header.split(" "); // ✅ Split multi-word headers

        // ✅ Locate first word in headerRow
        const firstWordMatch = headerRow.find(row => headerWords[0].toLowerCase() === row.text.toLowerCase());

        if (firstWordMatch) {
            // ✅ Get all words that follow the first match to confirm full header
            const startIndex = headerRow.findIndex(row => headerWords[0].toLowerCase() === row.text.toLowerCase());
            const possibleMatch = headerRow.slice(startIndex, startIndex + headerWords.length)
                .map(row => row.text.toLowerCase());

            // ✅ Ensure entire header sequence matches before storing position
            if (possibleMatch.join(" ") === header.toLowerCase()) {
                headerPositions[header] = firstWordMatch.x; // ✅ Store X position of the first word in sequence
            }
        }
    });

    return headerPositions;
};

const estimateHeaderPositions = (startX, headers, stretchConfig = {}) => {
    const positions = {};
    let currentX = startX;
    console.log(headers);

    for (const header of headers) {
        positions[header] = currentX;

        // Use configured stretch factor if provided, else default to 1
        const stretchFactor = stretchConfig[header] || 1;
        currentX += header.length * stretchFactor;
    }

    return positions;
};

const reorderHeaderPositions = (headerPositions, detectedHeadersArray) => {
    return Object.fromEntries(
        detectedHeadersArray
            .filter(header => headerPositions.hasOwnProperty(header))
            .map(header => [header, headerPositions[header]])
    );
};

const detectHeaderLine = (lines, headerVariants) => {
    for (const headerSet of headerVariants) {
        for (const [y, text] of Object.entries(lines)) {
            if (headerSet.every(kw => text.includes(kw))) {
                return { y, text, headerSet };
            }
        }
    }
    return null;
};

const estimateHeaderXMap = (headerText, baseX = 0, charWidth = 1) => {
    const segments = normalizeHeaderText(headerText);
    const headerXMap = {};
    let cursor = 0;

    for (const segment of segments) {
        if (segment) {
            const x = baseX + cursor * charWidth;
            headerXMap[segment] = x;
        }
        cursor += segment.length + 3; // assume at least 3 spaces or a pipe
    }

    return headerXMap;
};

const normalizeHeaderText = (headerText) => {
    if (headerText.includes('|')) {
        // Case 1: pipe-delimited
        return headerText.split('|').map(seg => seg.trim()).filter(Boolean);
    } else {
        // Case 2: space-aligned (split on 3+ spaces)
        return headerText.trim().split(/\s{3,}/).map(seg => seg.trim()).filter(Boolean);
    }
};

const sanitizeHeaderText = (headerText, headerSet) => {
    const isPipeDelimited = headerText.includes("|");
    const delimiter = isPipeDelimited ? "|" : "   ";

    // Split on either pipe or runs of 3+ spaces
    const segments = headerText.trim().split(isPipeDelimited ? "|" : /\s{3,}/);

    return segments
        .map(seg => seg.trim())
        .filter(seg => headerSet.includes(seg))
        .join(delimiter); // rebuild with the same delimiter
};


const findAnchorHeaders = (headerMap, epsilon = 0.001) => {
    const anchors = [];
    const seenX = [];

    for (const [header, x] of Object.entries(headerMap)) {
        const matched = seenX.find(px => Math.abs(px - x) < epsilon);
        if (!matched) {
            anchors.push(header);
            seenX.push(x);
        }
    }

    return anchors;
};

const reestimateHeaderMap = (headerMap, anchorHeaders, spacing = 3, epsilon = 0.001) => {
    const estimatedHeaderMap = {};
    const groups = [];

    // Group headers by x-coordinate
    for (const [header, x] of Object.entries(headerMap)) {
        let group = groups.find(g => Math.abs(g.x - x) < epsilon);
        if (group) {
            group.headers.push(header);
        } else {
            groups.push({ x, headers: [header] });
        }
    }

    // Assign real x to anchor headers, synthetic x to others
    groups.forEach(group => {
        const anchor = group.headers.find(h => anchorHeaders.includes(h));
        if (anchor) {
            group.headers.forEach((header, i) => {
                estimatedHeaderMap[header] = header === anchor
                    ? headerMap[header]
                    : parseFloat((headerMap[anchor] + (i * spacing)).toFixed(3));
            });
        }
    });

    return estimatedHeaderMap;
};

const inferHeaderXMap = (tableItems, epsilon = 0.01) => {
    const headerXMap = {};

    // 1️⃣ Infer DATE column by pattern
    const dateItem = tableItems.find(i =>
        /^\d{2}\/\d{2}\/\d{4}$/.test(i.text.trim())
    );
    if (dateItem) headerXMap["DATE"] = dateItem.x;

    // 2️⃣ Infer DESCRIPTION column by longest narration near date row
    const descriptionItem = tableItems
        .filter(i =>
            Math.abs(i.y - dateItem?.y) <= 0.200 &&
            i.text !== dateItem?.text &&
            !i.text.includes(".00")
        )
        .sort((a, b) => a.x - b.x)[0]; // pick the one closest to the left

    console.log(descriptionItem);

    if (descriptionItem) headerXMap["DESCRIPTION"] = descriptionItem.x;

    // 3️⃣ Infer DEBIT, CREDIT, BALANCE by analyzing compound `.00` fields

    let debitX = null;
    let creditX = null;
    let balanceX = null;

    const compoundAmountFields = tableItems.filter(i =>
        /\.00/.test(i.text) && i.text.split(".00").length >= 2
    );

    const sortedByX = compoundAmountFields.sort((a, b) => a.x - b.x);

    if (sortedByX.length >= 1) {
        debitX = sortedByX[0].x;
        creditX = sortedByX[sortedByX.length - 1].x;

        // Estimate balanceX as offset from creditX
        balanceX = creditX + 8;
    }

    headerXMap["DEBIT"] = debitX;
    headerXMap["CREDIT"] = creditX;
    headerXMap["BALANCE"] = balanceX; // balance is from second part of same field

    // 4️⃣ Infer CHEQUE NO from DESCRIPTION content
    const chequeReference = tableItems.find(i =>
        /CHQ\s*NO/i.test(i.text)
    );

    if (chequeReference) headerXMap["CHEQUE NO"] = debitX - (chequeReference.x || headerXMap["DESCRIPTION"]);

    return headerXMap;
};

const detectAlignmentFromText = (text) => {
    const t = text.trim();

    if (/^(Debit|Credit|Balance|Amount|Withdrawal|Deposit|Instrument No)$/i.test(t)) return 'right'; // numerical columns
    if (/^(Date|Sr No|Remarks|Description)$/i.test(t)) return 'left'; // typical text fields
    if (/^[A-Z\s]+$/.test(t) && t.length < 20) return 'center'; // maybe labels

    return 'left'; // safe fallback
};

function areAllEqualPositions(headerPositions) {
    const { Debit, Credit, Balance } = headerPositions;
    return Debit === Credit && Credit === Balance;
}

function adjustHeaderPositionsByFilteredData(validRowGroup, headerPositions) {
    const balanceRegex = /\.\d{2}(Cr|Dr)$/;

    for (const item of validRowGroup) {
        const txt = item.text.trim();
        if (balanceRegex.test(txt)) {
            headerPositions['Balance'] = item.x;
            break;
        }
    }

    if (headerPositions['Balance']) {
        const debitX = headerPositions['Debit'];
        const estimatedGap = (headerPositions['Balance'] - debitX) / 3;
        headerPositions['Credit'] = debitX + estimatedGap;
    }
}

function adjustHeaderPositionsByGroupByY(validRowGroup, headerPositions) {
    const headers = Object.keys(headerPositions);
    let itemIdx = 0;

    for (const header of headers) {
        const item = validRowGroup[itemIdx];

        if (header === 'Details') {
            const firstX = validRowGroup[0]?.x;
            const secondX = validRowGroup[1]?.x;
            if (firstX != null && secondX != null) {
                headerPositions['Details'] = secondX + (secondX - firstX);
            }
            continue; // skip increment for Details
        }

        if (item && header !== 'Balance') {
            headerPositions[header] = item.x;
            itemIdx++;
        }
    }
}


module.exports = { estimateHeaderPositions, detectHeaderLine, estimateHeaderXMap, normalizeHeaderText, findAnchorHeaders, reestimateHeaderMap, inferHeaderXMap, detectAlignmentFromText, detectPerRowHeader, extractHeaderRowY, extractHeaderRow, extractHeaderPositions, sanitizeHeaderText, reorderHeaderPositions, areAllEqualPositions, adjustHeaderPositionsByFilteredData, adjustHeaderPositionsByGroupByY };
