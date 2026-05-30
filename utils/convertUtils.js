const convertToJSONSimple = (headers, parsedRows, headerXMap) => {
    // console.log(headers);
    // console.log(headerXMap);
    const result = [];
    let currentRow = null;

    parsedRows.forEach(item => {
        // Check if the item marks the start of a new row
        const firstHeaderX = headerXMap[headers[0]];

        if (item.x === firstHeaderX) {
            // Push previous row if it exists
            if (currentRow) result.push(currentRow);

            // Start a new row
            currentRow = {};
            headers.forEach(h => currentRow[h] = '');
        }

        // If there's no active row, skip
        if (!currentRow) return;

        // Match item.x to the correct header
        for (const header of headers) {
            if (item.x === headerXMap[header]) {
                currentRow[header] += currentRow[header] ? ` ${item.text}` : item.text;
                break;
            }
        }
    });

    // Push the last row if it exists
    if (currentRow) result.push(currentRow);

    return result;
};

const convertToJSONByY = (headers, parsedRows, headerXMap, epsilon = 0.01) => {
    const rowsByY = {};

    // Group items by rounded Y (for tolerance)
    parsedRows.forEach(item => {
        const key = item.y.toFixed(3); // or round based on epsilon
        rowsByY[key] = rowsByY[key] || [];
        rowsByY[key].push(item);
    });

    const result = [];

    Object.values(rowsByY)
        .sort((a, b) => a[0].y - b[0].y) // sort top to bottom
        .forEach(rowItems => {
            const row = {};
            headers.forEach(h => row[h] = '');

            for (const item of rowItems) {
                for (const header of headers) {
                    if (Math.abs(item.x - headerXMap[header]) <= epsilon) {
                        row[header] += row[header] ? ` ${item.text}` : item.text;
                        break;
                    }
                }
            }
            if (row[headers[0]].trim() !== '') {
                result.push(row);
            }
        });

    return result;
};

const parseDataRows = (mergedLines, headerXMap, headers) => {
    const allRows = [];
    let currentRow = null;
    for (const [y, line] of Object.entries(mergedLines)) {
        const rawSegments = line.split('|');
        const isStructured = rawSegments.filter(s => s.trim()).length > 1;
        const segments = rawSegments.slice(1, -1); // Remove first and last empty segments
        if (isStructured) {
            const row = [];
            let headerIndex = 0;
            let debitCount = 0;
            let creditCount = 0;

            for (let i = 0; i < segments.length; i++) {
                const text = segments[i].trim();
                const header = headers[headerIndex];
                const x = headerXMap[header];


                // Custom increment logic
                if (header === 'Debit') {
                    debitCount++;
                    if (text) {
                        row.push({ text, x, y: parseFloat(y) });
                    }
                    if (debitCount >= 2) headerIndex++;
                } else if (header === 'Credit') {
                    creditCount++;
                    if (text) {
                        row.push({ text, x, y: parseFloat(y) });
                    }
                    if (creditCount >= 2) headerIndex++;
                } else {
                    headerIndex++;
                    row.push({ text, x, y: parseFloat(y) });
                }

                if (headerIndex >= headers.length) break;
            }
            currentRow = row;
            allRows.push(row);
        } else if (currentRow) {
            // Continuation line — append to 'PARTICULARS'
            const continuationText = rawSegments[0].trim();
            const particularsField = currentRow.find(f => f.x === headerXMap['PARTICULARS']);
            if (particularsField) {
                particularsField.text += ' ' + continuationText;
            }
        }
    }

    return cleanParticularsField(allRows.filter((row) => isValidRow(row, headerXMap)), headerXMap);

};

const cleanParticularsField = (rows, headerXMap) => {
    return rows.map(row => {
        const particularsField = row.find(f => f.x === headerXMap['PARTICULARS']);
        if (particularsField && /-{5,}/.test(particularsField.text)) {
            // console.log(particularsField);
            // Remove horizontal line and everything after it
            const parts = particularsField.text.split(/-{5,}/);
            particularsField.text = parts[0].trim();
            // console.log(particularsField.text);
        }
        return row;
    });
};

const normalizeRowText = (text) => {
    return text
        .replace(/[^\w\s|.:&\-\(\)]/g, '')
        .replace(/^\s*\|\s*/, "")
        .replace(/\s*\|\s*$/, "")
        .replace(/\s*\|\s*/g, " | ")
        .replace(/\|{2,}/g, " | ")
        .trim();
};

const denormalizeGroupedData = (tableDataByPage) => {
    return tableDataByPage.flatMap(group =>
        group.account_list.map(account => ({
            group_name: group.group_name,
            account_name: account.account_name,
            place: account.place,
            credit_amount: account.credit_amount,
            debit_amount: account.debit_amount,
            group_total: group.group_total,
            isGroupCredit: group.isCredit,
            isGroupDebit: group.isDebit
        }))
    );
};
const formatRowsWithSeparator = (accumulatedRows) => {
    return accumulatedRows.map(row => {
        const cleanedText = normalizeRowText(row.text);
        return cleanedText.split(" | ").map(col => col.trim());
    }).filter(row => row.some(col => col.length > 0 && col.replace(/\|/g, "").trim().length > 0));
};

const convertToJSON = (headers, formattedRows) => {
    return formattedRows.map(row => {
        const rowJson = {};
        headers.forEach((header, index) => rowJson[header.replace(/\s+/g, "_")] = row[index] || "");
        return rowJson;
    });
};

function isValidRow(row, headerXMap) {
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    const amountRegex = /^\d+\.\d{2}$/;
    const textRegex = /\w+/;

    const hasDate = row.some(cell => cell.x === headerXMap.DATE && dateRegex.test(cell.text));
    const hasAmount = row.some(cell =>
        (cell.x === headerXMap.Debit || cell.x === headerXMap.Credit) &&
        amountRegex.test(cell.text)
    );

    const hasText = row.some(cell => cell.x === headerXMap.PARTICULARS && textRegex.test(cell.text));

    return hasDate && hasAmount && hasText;
}

module.exports = { convertToJSONSimple, convertToJSONByY, parseDataRows, normalizeRowText, denormalizeGroupedData, formatRowsWithSeparator, convertToJSON,cleanParticularsField };
