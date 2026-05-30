const mergeAmountFragments = (groupedByYAxis, headers) => {
    const merged = {};

    const debitThresholdX = (headers['Chq.No.'] + headers['Debit']) / 2;
    const balanceX = headers['Balance'];

    for (const [yKey, items] of Object.entries(groupedByYAxis)) {
        const row = [];
        let skipNext = false;

        for (let i = 0; i < items.length; i++) {
            if (skipNext) {
                skipNext = false;
                continue;
            }

            const current = items[i];
            const next = items[i + 1];
            const currentText = current.text.trim();
            const nextText = next?.text.trim();

            const isInAmountZone = current.x >= debitThresholdX && current.x <= balanceX;

            let mergedText = null;

            if (isInAmountZone) {

                if (/^[\d,]+$/.test(currentText) && /^\d*\.\d{1,2}$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                } else if (/^\d+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                } else if (/^\d+\.$/.test(currentText) && /^\d{2}$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                } else if (/^[\d,]+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                } else if (/^[\d,]+$/.test(currentText) && /^\.\d{2}$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                }

            }

            if (mergedText) {
                row.push({ text: mergedText, x: current.x, y: current.y });
                skipNext = true;
            } else {
                row.push(current);
            }
        }

        merged[yKey] = row;
    }

    return merged;
};

const mergeBalanceFragments = (groupedByYAxis, headers) => {
    const merged = {};
    const balanceX = headers['Balance'];

    for (const [yKey, items] of Object.entries(groupedByYAxis)) {
        const row = [];
        let skipNext = false;

        for (let i = 0; i < items.length; i++) {
            if (skipNext) {
                skipNext = false;
                continue;
            }

            const current = items[i];
            const next = items[i + 1];
            const currentText = current.text.trim();
            const nextText = next?.text.trim();

            const isInBalanceZone = current.x >= balanceX;

            let mergedText = null;

            if (isInBalanceZone) {
                // Case: '3,52,746.05' + 'Cr'
                if (/^\d{1,3}(,\d{2,3})*(\.\d{2})?$/.test(currentText) && /^(Cr|Dr)$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                }

                // Case: '2,69' + '6.55Cr' → '2,696.55Cr'
                else if (/^\d{1,3}(,\d{2,3})*$/.test(currentText) && /^\d+\.\d{2}(Cr|Dr)$/.test(nextText)) {
                    mergedText = `${currentText}${nextText}`;
                }
            }

            if (mergedText) {
                row.push({ text: mergedText, x: current.x, y: current.y });
                skipNext = true;
            } else {
                row.push(current);
            }
        }

        merged[yKey] = row;
    }

    return merged;
};

const extractBalanceFromText = (text) => {
    const decimalMatches = [...text.matchAll(/\d+\.\d{2}/g)];

    if (decimalMatches.length < 2) return null; // not enough decimals to infer balance

    const firstDecimal = decimalMatches[0];
    const secondDecimal = decimalMatches[1];

    const balanceStart = secondDecimal.index;
    const balanceText = text.slice(balanceStart).trim();

    // Validate it ends with Cr or Dr
    if (/^\d+\.\d{2}(Cr|Dr)$/.test(balanceText)) {
        return balanceText;
    }

    return null;
};

const extractPreviousBalanceFromGroups = (groupedByY) => {
    for (const [y, items] of Object.entries(groupedByY)) {
        const hasBrought = items.some(i => i.text.toUpperCase().includes('BROUGHT'));
        const hasForward = items.some(i => i.text.toUpperCase().includes('FORWARD'));

        // Match any decimal with 2 digits (with or without Cr/Dr)
        const balanceItem = items.find(i => /\d{1,3}(,\d{2,3})*\.\d{2}(Cr|Dr)?$/.test(i.text));

        if (hasBrought && hasForward && balanceItem) {
            const raw = balanceItem.text;
            const value = parseFloat(raw.replace(/(Cr|Dr)/, '').replace(/,/g, ''));
            const type = raw.endsWith('Cr') ? 'Cr' : raw.endsWith('Dr') ? 'Dr' : null;
            return { value, type, y: parseFloat(y), raw };
        }
    }

    return null;
};

const extractOpeningBalanceFromGroups = (groupedByY) => {
    for (const [y, items] of Object.entries(groupedByY)) {
        const hasOpening = items.some(i => i.text.toUpperCase().includes('OPENING BALANCE'));
        if (!hasOpening) continue;

        // Collect all numeric tokens from this row
        const numericTokens = items
            .map(i => i.text.trim().split(/\s+/))
            .flat()
            .filter(tok => /^\d{1,3}(,\d{2,3})*\.\d{2}$/.test(tok));

        if (numericTokens.length) {
            // Take the last numeric token as the opening balance
            const raw = numericTokens[numericTokens.length - 1];
            const value = parseFloat(raw.replace(/,/g, ''));
            return { value, y: parseFloat(y), raw };
        }
    }

    return null;
};


const extractPreviousBalanceFromLines = (mergedLines) => {
    const bfLineEntry = Object.entries(mergedLines).find(([y, line]) =>
        line.includes("Brought Forward")
    );
    if (!bfLineEntry) return null;

    const [y, line] = bfLineEntry;
    const tokens = line.trim().split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (!tokens.length) return null;

    const raw = tokens[tokens.length - 1]; // last token is balance
    const match = raw.match(/^([\d,]+\.\d{2})(DR|CR)?$/i);
    if (!match) return null;

    const value = parseFloat(match[1].replace(/,/g, ""));
    const type = match[2] ? match[2].toUpperCase() : null;
    const signedValue = type === "DR" ? -value : value;

    return signedValue;
};

const extractPreviousBalanceFromGroupByYAxis = (groupByY) => {
    const bfLineEntry = Object.entries(groupByY).find(([y, items]) =>
        items.some(item => /B\/F/i.test(item.text))
    );
    if (!bfLineEntry) return null;

    const [y, items] = bfLineEntry;
    const line = items.map(i => i.text).join(" ");
    const tokens = line.trim().split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (!tokens.length) return null;

    const raw = tokens[tokens.length - 1]; // last token is balance
    const match = raw.match(/^([\d,]+\.\d{2})(DR|CR)?$/i);
    if (!match) return null;

    const value = parseFloat(match[1].replace(/,/g, ""));
    const type = match[2] ? match[2].toUpperCase() : null;
    const signedValue = type === "DR" ? -value : value;

    return signedValue;
};

const extractPreviousBalanceWithoutBroughtForward = (groupByY) => {
    // sort rows top to bottom
    const sortedYKeys = Object.keys(groupByY).sort((a, b) => parseFloat(a) - parseFloat(b));

    if (sortedYKeys.length === 0) return null;

    // take the first row
    const firstY = sortedYKeys[0];
    const firstItems = groupByY[firstY];
    if (!firstItems || firstItems.length === 0) return null;

    const rawText = firstItems[0].text.trim();
    console.log(rawText);

    // balance regex
    const isBalance = str => /^\d{1,3}(,\d{2,3})*\.\d{2}(Cr|Dr)?$/.test(str);

    const extractBalanceToken = (line) => {
        const match = line.match(/\d{1,3}(?:,\d{2,3})*\.\d{2}(Cr|Dr)?$/);
        return match ? match[0] : null;
    };

    const balanceToken = extractBalanceToken(rawText);

    if (balanceToken && isBalance(balanceToken)) {
        const value = parseFloat(rawText.replace(/(Cr|Dr)/, '').replace(/,/g, ''));
        const type = rawText.endsWith('Cr') ? 'Cr' : rawText.endsWith('Dr') ? 'Dr' : null;
        return { value, type, y: parseFloat(firstY), raw: balanceToken };
    }

    return null;
};

// Helper: normalize balance string into signed number
const normalizeBalance = (raw) => {
    const match = raw.match(/^([\d,]+\.\d{2})(DR|CR)?$/i);
    if (!match) return null;

    const value = parseFloat(match[1].replace(/,/g, ""));
    const type = match[2] ? match[2].toUpperCase() : null;
    return type === "DR" ? -value : value;
};

const inferAmountHeader = (prev, curr, headers) => {
    const prevIsDR = prev < 0;
    const currIsDR = curr < 0;
    const delta = Math.abs(curr) - Math.abs(prev);

    if (prevIsDR && currIsDR) {
        // DR → DR
        return delta > 0
            ? headers[headers.indexOf("Debit Amt.")]
            : headers[headers.indexOf("Credit Amt.")];
    }

    if (!prevIsDR && !currIsDR) {
        // CR → CR
        return delta > 0
            ? headers[headers.indexOf("Credit Amt.")]
            : headers[headers.indexOf("Debit Amt.")];
    }

    if (!prevIsDR && currIsDR) {
        // CR → DR (flip into debit)
        return headers[headers.indexOf("Debit Amt.")];
    }

    if (prevIsDR && !currIsDR) {
        // DR → CR (flip into credit)
        return headers[headers.indexOf("Credit Amt.")];
    }
};

const inferAmountHeaderForStructuredRows = (prev, curr, headers) => {
    const prevIsDR = prev < 0;
    const currIsDR = curr < 0;
    const delta = Math.abs(curr) - Math.abs(prev);

    if (prevIsDR && currIsDR) {
        // DR → DR
        return delta > 0
            ? headers[headers.indexOf("WITHDRAWALS")]
            : headers[headers.indexOf("DEPOSITS")];
    }

    if (!prevIsDR && !currIsDR) {
        // CR → CR
        return delta > 0
            ? headers[headers.indexOf("DEPOSITS")]
            : headers[headers.indexOf("WITHDRAWALS")];
    }

    if (!prevIsDR && currIsDR) {
        // CR → DR (flip into debit)
        return headers[headers.indexOf("WITHDRAWALS")];
    }

    if (prevIsDR && !currIsDR) {
        // DR → CR (flip into credit)
        return headers[headers.indexOf("DEPOSITS")];
    }
};


const updateGroupsWithAmountItems = (groupedByY, headerXMap) => {
    Object.entries(groupedByY).forEach(([yKey, items]) => {
        const yFloat = parseFloat(yKey);
        const newSubItems = [];
        const filteredItems = [];

        items.forEach(item => {
            const balanceValue = extractPossibleBalance(item.text);

            // Process only if valid compound + valid balance detected
            if (balanceValue) {
                const [value1, value2] = splitCompoundAmount(item.text);

                const debitDist = Math.abs(headerXMap["DEBIT"] - item.x);
                const creditDist = Math.abs(headerXMap["CREDIT"] - item.x);
                const isDebit = debitDist < creditDist;

                const debitOrCreditHeader = isDebit ? "DEBIT" : "CREDIT";

                newSubItems.push(
                    {
                        text: value1,
                        x: headerXMap[debitOrCreditHeader],
                        y: yFloat,
                    },
                    {
                        text: value2,
                        x: headerXMap["BALANCE"],
                        y: yFloat,
                    }
                );
                // Don't keep original compound item
                return;
            }

            // Otherwise keep original item
            filteredItems.push(item);
        });

        // Replace group with clean + split entries
        groupedByY[yKey] = [...filteredItems, ...newSubItems];
    });
};

const combineAmountFragments = (rows, startX) => {
    const combined = [];
    let skipNext = false;

    for (let i = 0; i < rows.length - 1; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const current = rows[i];
        const next = rows[i + 1];
        const currentText = current.text;
        const nextText = next.text;
        let mergedText = null;

        // Only attempt merging if current.x >= startX
        if (current.x >= startX && next.x >= startX) {
            // Case 1: integer part + .xx
            if (/^[\d,]+$/.test(currentText) && /^\.\d{1,2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
            // Case 2: integer part + full decimal fragment (like "1234" + "56.78")
            else if (/^[\d,]+$/.test(currentText) && /^\d*\.\d{1,2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
            // Case 3: "1234.5" + "6" → "1234.56"
            else if (/^\d+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
            // Case 4: "1234." + "56" → "1234.56"
            else if (/^\d+\.$/.test(currentText) && /^\d{2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
            // Case 5: "1,234.5" + "6" → "1,234.56"
            else if (/^[\d,]+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
        }

        if (mergedText) {
            combined.push({
                text: mergedText,
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

const combineWrappedAmounts = (rows) => {
    const combined = [];
    let skipNext = false;

    for (let i = 0; i < rows.length - 1; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const current = rows[i];
        const next = rows[i + 1];

        const isWrappedAmount =
            Math.abs(current.y - next.y) <= 0.5 &&
            Math.abs(current.x - next.x) <= 1.5 &&
            /^[\d,.]+$/.test(current.text.trim()) &&
            /^[\d,.]+$/.test(next.text.trim());

        if (isWrappedAmount) {
            // Example: "28,08,900" + ".00" → "28,08,900.00"
            const joinedText = current.text.trim() + next.text.trim();

            combined.push({
                text: joinedText,
                x: current.x,
                y: Math.max(current.y, next.y)
            });

            skipNext = true;
        } else {
            combined.push(current);
        }
    }

    // Push last item if not merged
    if (!skipNext && rows.length > 0) {
        combined.push(rows[rows.length - 1]);
    }

    return combined;
};

const enhanceCombineWrappedAmounts = (rows) => {
    const combined = [];
    let skipNext = false;

    for (let i = 0; i < rows.length - 1; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        const current = rows[i];
        const next = rows[i + 1];
        const currentText = current.text.trim();
        const nextText = next.text.trim();

        const isCloseVertically = Math.abs(current.y - next.y) <= 1.0;
        const isCloseHorizontally = Math.abs(current.x - next.x) <= 1.5;

        let mergedText = null;

        if (isCloseVertically && isCloseHorizontally) {
            if (/^[\d,]+$/.test(currentText) && /^\.\d{1,2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            } else if (/^[\d,]+$/.test(currentText) && /^\d*\.\d{1,2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            } else if (/^\d+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            } else if (/^\d+\.$/.test(currentText) && /^\d{2}$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            } else if (/^[\d,]+\.\d$/.test(currentText) && /^\d$/.test(nextText)) {
                mergedText = `${currentText}${nextText}`;
            }
        }

        if (mergedText) {
            combined.push({
                text: mergedText,
                x: current.x,
                y: Math.max(current.y, next.y)
            });
            skipNext = true;
        } else {
            combined.push(current);
        }
    }

    if (!skipNext && rows.length > 0) {
        combined.push(rows[rows.length - 1]);
    }

    return combined;
};

const extractPossibleBalance = raw => {
    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1 || dotIndex + 2 >= raw.length) return null;

    const slicePoint = dotIndex + 3;
    const balanceCandidate = raw.slice(slicePoint).trim();

    // Normalize comma and whitespace
    const normalized = balanceCandidate.replace(/,/g, '');

    // Check if it’s a valid float with 2 decimals
    return /^\d+\.\d{2}$/.test(normalized) ? normalized : null;
};

const splitCompoundAmount = (raw) => {
    const firstDecimalIndex = raw.indexOf('.');
    if (firstDecimalIndex === -1 || firstDecimalIndex + 2 >= raw.length) return [];

    const boundary = firstDecimalIndex + 3;
    const firstPart = raw.slice(0, boundary).trim();
    const secondPart = raw.slice(boundary).trim();

    return [firstPart, secondPart];
};

module.exports = { mergeAmountFragments, extractPreviousBalanceFromGroups, extractPreviousBalanceFromLines, normalizeBalance, extractPreviousBalanceWithoutBroughtForward, updateGroupsWithAmountItems, combineAmountFragments, combineWrappedAmounts, enhanceCombineWrappedAmounts, mergeBalanceFragments, extractBalanceFromText, inferAmountHeader, inferAmountHeaderForStructuredRows, extractPreviousBalanceFromGroupByYAxis, extractOpeningBalanceFromGroups };
