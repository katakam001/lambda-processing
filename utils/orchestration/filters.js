const bankConfig = require('../../config/bankConfig');

const filterValidGroups = (groupedByY, expectedHeaders) => {
    let skipMode = false;
    const validGroups = {};

    const isHeaderGroup = group => {
        const combinedText = group.map(({ text }) => text.trim()).join(' ').replace(/\s+/g, ' ').toUpperCase();
        return expectedHeaders.every(header => combinedText.includes(header));
    };

    for (const [yKey, group] of Object.entries(groupedByY)) {
        if (!skipMode) {
            const containsTotals = group.some(({ text }) =>
                /(Cumulative Totals:|Page Total:)/i.test(text.trim())
            );

            if (containsTotals) {
                skipMode = true;
                continue;
            }

            validGroups[yKey] = group;
        } else {
            if (isHeaderGroup(group)) {
                skipMode = false;
                continue;
            }
            // Still skipping — do nothing
        }
    }

    return validGroups;
};

const filterValidGroupsWithSkipMode = (groupedByY, expectedHeaders, initialSkipMode = true) => {
    let skipMode = initialSkipMode;
    const validGroups = {};

    const isHeaderGroup = group => {
        const combinedText = group
            .map(({ text }) => text.trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .toUpperCase();
        return expectedHeaders.every(header => combinedText.includes(header));
    };

    for (const [yKey, group] of Object.entries(groupedByY)) {
        if (!skipMode) {
            const containsEndOfTable = group.some(({ text }) =>
                /(Cumulative Totals:|Page Total:|Closing Balance|No Transactions exist for given period|Page\s+\d+\s+\|\s+\d+)/i.test(text.trim())
            );

            if (containsEndOfTable) {
                skipMode = true;
                continue;
            }

            validGroups[yKey] = group;
        } else {
            if (isHeaderGroup(group)) {
                skipMode = false;
                continue;
            }
            // Still skipping — do nothing
        }
    }

    return { validGroups, skipMode }; // return final skipMode state too
};


const filterValidGroupsWithFuzzyLogicSkipMode = (
    groupedByY,
    expectedHeaders,
    initialSkipMode = true
) => {
    let skipMode = initialSkipMode;
    let justExitedHeader = false; // ✅ track state
    const validGroups = {};

    const isHeaderGroup = group => {
        const combinedText = group
            .map(({ text }) => text.trim())
            .join(' ')
            .replace(/\s+/g, ' ')
            .toUpperCase();

        return expectedHeaders.every(header =>
            combinedText.includes(header.toUpperCase())
        );
    };

    const isSeparatorLine = group =>
        group.some(({ text }) => /^_+$/.test(text.trim()));

    for (const [yKey, group] of Object.entries(groupedByY)) {
        if (!skipMode) {
            if (isSeparatorLine(group)) {
                if (justExitedHeader) {
                    justExitedHeader = false;
                    continue;
                } else {
                    // ✅ normal behavior: stop processing
                    skipMode = true;
                    continue;
                }
            }

            validGroups[yKey] = group;
            justExitedHeader = false; // reset once we process a valid group
        } else {
            if (isHeaderGroup(group)) {
                skipMode = false;
                justExitedHeader = true; // ✅ mark that we just saw a header
                continue;
            }
            // Still skipping — do nothing
        }
    }

    return { validGroups, skipMode };
};


const getGroupsFromValidOnward = (yGroups, useMonthText = false) => {
    const validKey = findFirstValidGroupKey(yGroups, useMonthText);
    if (!validKey) return {};

    const validY = parseFloat(validKey);
    const filtered = {};

    for (const [yKey, group] of Object.entries(yGroups)) {
        if (parseFloat(yKey) >= validY) {
            filtered[yKey] = group;
        }
    }

    return filtered;
};

const filterAfterBroughtForward = (groupedByYAxis) => {
    const sortedYKeys = Object.keys(groupedByYAxis)
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    let found = false;
    const result = {};

    for (const yStr of sortedYKeys) {
        const items = groupedByYAxis[yStr];
        if (!items) continue;

        if (!found) {
            if (items.some(({ text }) => text.trim().startsWith('BROUGHT FORWARD'))) {
                found = true;
                continue; // Skip this row too
            }
        } else {
            result[yStr] = items;
        }
    }

    return result;
};

const findFirstValidGroupKey = (yGroups, useMonthText = false) => {
    const isValidGroup = createGroupValidator({ useMonthText });

    for (const [yKey, group] of Object.entries(yGroups)) {
        if (isValidGroup(group)) return yKey;
    }

    return null;
};


const createGroupValidator = ({ useMonthText = false }) => {
    const dateRegex = useMonthText
        ? /^\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4}$/
        : /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/;

    return group => {
        if (!group || group.length < 6) return false;

        let dateCount = 0;
        let amountCount = 0;
        let textCount = 0;

        group.forEach(({ text }) => {
            const txt = text.trim();

            if (dateRegex.test(txt)) dateCount++;
            else if (/^[₹]?[0-9,]+\.\d{2}$/.test(txt)) amountCount++;
            else if (/\w/.test(txt)) textCount++;
        });

        return useMonthText
            ? dateCount >= 1 && amountCount >= 2 && textCount >= 2
            : dateCount >= 2 && amountCount >= 2 && textCount >= 2;
    };
};

const filterRelevantRows = (groupedRows, detectedHeader) => {
    const amountPattern = /\b(?:\d{1,2}(?:,\d{2}){1,2}|\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/;
    const datePattern = /\b\d{2}[./-]\d{2}[./-]\d{4}\b/;

    // ✅ Identify header row index dynamically using `detectedHeader`
    const headerIndex = groupedRows.findIndex(row =>
        detectedHeader.every(header => row.text.toLowerCase().includes(header.toLowerCase()))
    );

    // ✅ Identify the **final** total row index (last occurrence of "Total :-")
    const totalIndex = groupedRows.map((row, index) => row.text.toLowerCase().includes("total :-") ? index : -1)
        .filter(index => index !== -1).pop(); // ✅ Gets the last occurrence

    if (headerIndex === -1) return []; // If header not found, return empty array
    const endIndex = totalIndex !== undefined ? totalIndex : groupedRows.length; // If "Total :-" missing, extract all rows

    // ✅ 3. Include all rows before header that look like monetary/account entries

    const beforeHeader = groupedRows.slice(0, headerIndex).filter(row =>
        isMeaningfulRow(row.text) &&
        amountPattern.test(row.text) &&
        !datePattern.test(row.text)
    );

    // ✅ 4. Include main body after header
    const afterHeader = groupedRows.slice(headerIndex + 1, endIndex)
        .filter(row => isMeaningfulRow(row.text));

    return [...beforeHeader, ...afterHeader];

};

function findValidRowGroupByFilteredData(filteredData) {
    return Object.values(filteredData).find(group => {
        if (group.length < 6) return false;

        let dateCount = 0, amountCount = 0, textCount = 0, balanceCount = 0;

        group.forEach(({ text }) => {
            const txt = text.trim();

            if (/^\d{2}\/\d{2}\/\d{2}$/.test(txt)) {
                dateCount++;
            } else if (/^\d+\.\d{2}$/.test(txt)) {
                amountCount++;
            } else if (/[a-zA-Z]/.test(txt) && !/\.\d{2}(Cr|Dr)$/.test(txt)) {
                textCount++;
            } else if (/\.\d{2}(Cr|Dr)$/.test(txt)) {
                balanceCount++;
            }
        });

        return dateCount >= 2 && amountCount >= 1 && textCount >= 1 && balanceCount >= 1;
    });
}

function findValidRowGroupByGroupByY(groupByY) {
    return Object.values(groupByY).find(group => {
        if (group.length < 6) return false;

        let dateCount = 0, amountCount = 0, textCount = 0;

        group.forEach(({ text }) => {
            const txt = text.trim();

            if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
                dateCount++;
            } else if (/^[\d,]+\.\d{2}$/.test(txt)) {
                amountCount++;
            } else if (txt === '-') {
                textCount++;
            }
        });

        return dateCount >= 2 && amountCount >= 2 && textCount >= 1;
    });
}

function findValidRowGroupForNarration(yGroups, loose = false, bankName = null) {
    return Object.values(yGroups).find(group => {
        if (group.length < (loose ? 5 : 6)) return false;

        let dateCount = 0, amountCount = 0, textCount = 0;

        group.forEach(({ text }) => {
            const txt = text.trim();

            if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(txt)) {
                dateCount++;
            } else if (
                loose &&
                bankConfig.bankToIncludeValidateHeaderWithMonthName.includes(bankName) &&
                /^\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}$/.test(txt)
            ) {
                dateCount++;
            } else if (/^[₹]?[0-9,]+\.\d{2}$/.test(txt)) {
                amountCount++;
            } else if (/\w/.test(txt)) {
                textCount++;
            }
        });

        return loose
            ? dateCount >= 1 && amountCount >= 1 && textCount >= 1
            : dateCount >= 2 && amountCount >= 2 && textCount >= 2;
    }) || null;
}


function findTransactionIdRowGroup(yGroups) {
    return Object.values(yGroups).find(group =>
        group.some(({ text }) =>
            /^S\d{4}\s\d{4}$/.test(text.trim()) ||   // Format: S1234 5678
            /^S\d{6,7}$/.test(text.trim())           // Format: S123456 or S1234567
        )
    ) || null;
}


function findTimeStampRowGroups(yGroups) {
  return Object.values(yGroups).filter(group =>
    group.some(({ text }) =>
      /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/.test(text.trim())
    )
  );
}

function isMeaningfulRow(text) {
    const cleaned = text.replace(/[^\w\s|.:-]/g, "").trim();
    return cleaned.length > 0;
}

module.exports = { filterRelevantRows, filterValidGroups, getGroupsFromValidOnward, filterAfterBroughtForward, filterValidGroupsWithSkipMode, filterValidGroupsWithFuzzyLogicSkipMode, findValidRowGroupByFilteredData, findValidRowGroupByGroupByY, findValidRowGroupForNarration, findTransactionIdRowGroup,findTimeStampRowGroups };