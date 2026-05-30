const { extractBalanceFromText, normalizeBalance, inferAmountHeader, inferAmountHeaderForStructuredRows } = require('../balanceUtils.js');

const parseTransactionRows = (mergedLines, headerXMap, headers, prevBalance) => {
    const allRows = [];

    for (const [yAxis, line] of Object.entries(mergedLines)) {
        // Use your improved tokenizer
        const tokens = tokenizeTransactionLine(line);
        // console.log(tokens);
        if (tokens.length < 4) continue;

        // Validate Date
        const date = tokens[0];
        if (!/^\d{2}-\d{2}-\d{4}$/.test(date)) continue;

        const fields = [];

        // Date
        fields.push({ text: date, x: headerXMap[headers[0]], y: yAxis });

        // Tran
        const tran = tokens[1];
        if (tran) {
            fields.push({ text: tran, x: headerXMap[headers[1]], y: yAxis });
        }

        // RefNum (optional)
        let narrationStartIndex = 2;
        if (tokens[2] && /^\d+[A-Z0-9]*$/.test(tokens[2])) {
            fields.push({ text: tokens[2], x: headerXMap[headers[2]], y: yAxis });
            narrationStartIndex = 3;
        }

        // Narration
        const narration = tokens[narrationStartIndex];
        if (narration) {
            fields.push({ text: narration, x: headerXMap[headers[3]], y: yAxis });
        }

        // Amount + Balance
        const amountToken = tokens[tokens.length - 2];
        const balanceToken = tokens[tokens.length - 1];

        const balanceValue = balanceToken.replace(/[^\d.,]/g, "");
        const balanceHeader = headers[headers.length - 1];

        if (prevBalance !== undefined && balanceToken) {
            const curr = normalizeBalance(balanceToken);
            const prev = prevBalance; // already signed
            const amountHeader = inferAmountHeader(prev, curr, headers);

            fields.push({ text: amountToken, x: headerXMap[amountHeader], y: yAxis });
        }

        fields.push({ text: balanceToken, x: headerXMap[balanceHeader], y: yAxis });

        // console.log(fields);
        // Validation: must have Date, 2 amounts, and Narration
        const hasDate = !!date;
        const balanceX = headerXMap[headers[headers.length - 1]];

        const numericCount = fields.filter(f => {
            if (f.x === balanceX) {
                // For balance column, strip DR/CR before numeric check
                const cleaned = f.text.replace(/[^\d.,]/g, "");
                return /^[\d,.]+$/.test(cleaned);
            }
            // For all other fields, check as-is
            return /^[\d,.]+$/.test(f.text);
        }).length;


        const narrationX = headerXMap["Particulars"];
        const hasNarration = fields.some(f => f.x === narrationX && f.text.trim() !== "");

        if (!(hasDate && numericCount >= 2 && hasNarration)) {
            continue; // skip invalid row
        }

        prevBalance = normalizeBalance(balanceToken);


        allRows.push(fields);
    }

    return allRows;
};

const parseTransactionRowsWithFuzzyLogic = (groupByY, headerXMap) => {
    const positionedItems = [];
    const sortedYKeys = Object.keys(groupByY).sort((a, b) => parseFloat(a) - parseFloat(b));

    const isAmount = str => {
        const s = str.trim();
        return s === "0" || /^[\d,]+\.\d{2}$/.test(s);
    };

    const isBalance = str => /^[\d,]+\.\d{2}(Cr|Dr)?$/.test(str.trim());

    let lastParticularItem = null;

    for (const yStr of sortedYKeys) {
        const items = groupByY[yStr];
        if (!items || items.length === 0) continue;

        const combinedText = items.map(i => i.text).join(" ").replace(/\s+/g, " ").trim();
        const tokens = combinedText.split(/\s+/);

        // Detect if row starts with a date
        const hasDate = tokens[0] && /^\d{2}-[A-Z]{3}-\d{4}$/.test(tokens[0]);

        if (hasDate) {
            // Normal transaction row
            let txnDate = tokens[0];
            let valueDate = tokens[1];
            let particulars = [];
            let debit = null, credit = null, balance = null;

            for (const token of tokens.slice(2)) {
                if (!debit && isAmount(token)) debit = token;
                else if (!credit && isAmount(token)) credit = token;
                else if (!balance && isBalance(token)) balance = token;
                else particulars.push(token);
            }

            positionedItems.push({ text: txnDate, x: headerXMap['Txn Date'], y: yStr });
            positionedItems.push({ text: valueDate, x: headerXMap['Value Date'], y: yStr });

            const particularsItem = { text: particulars.join(" "), x: headerXMap['Particulars'], y: yStr };
            positionedItems.push(particularsItem);
            lastParticularItem = particularsItem; // track for continuation

            if (debit) positionedItems.push({ text: debit, x: headerXMap['Debit'], y: yStr });
            if (credit) positionedItems.push({ text: credit, x: headerXMap['Credit'], y: yStr });
            if (balance) positionedItems.push({ text: balance, x: headerXMap['Balance'], y: yStr });

        } else {
            // Continuation line → append to last particulars
            if (lastParticularItem) {
                lastParticularItem.text += " " + combinedText.trim();
            } else {
                positionedItems.push({ text: combinedText, x: headerXMap['Particulars'], y: yStr });
            }
        }
    }

    return positionedItems;
};


const parseStructuredRows = (groupByY, headerXMap, prevBalance) => {

    const isDate = str => /^\d{2}-\d{2}-\d{2}$/.test(str.trim());
    const isAmount = str => /^[\d,]+\.\d{2}$/.test(str.trim());
    const isBalance = str => /^[\d,]+\.\d{2}(Cr|Dr)$/.test(str.trim());
    const isChequeNo = str => /^\d{4,8}$/.test(str.trim());
    const positionedItems = [];
    let balanceToken = null;
    let amountToken = null;

    const sortedYKeys = Object.keys(groupByY)
        .sort((a, b) => parseFloat(a) - parseFloat(b));

    for (const yStr of sortedYKeys) {
        const items = groupByY[yStr];
        if (!items || items.length === 0) continue;

        // ✅ Skip entire row if any item contains "B/F"

        const hasBF = items.some(item => /B\/F/i.test(item.text));
        const isBankOfBarodaHeader = items.some(item =>
            /bankofbaroda/i.test(item.text)
        );
        if (hasBF || isBankOfBarodaHeader) continue;

        const firstItem = items[0];
        const secondItem = items[1];
        const tokens = firstItem.text.trim().split(/\s+/);
        const hasDate = tokens.some(isDate);

        if (hasDate) {
            let i = 0;
            if (isDate(tokens[i])) {
                positionedItems.push({ text: tokens[i], x: headerXMap['DATE'], y: yStr });
                i++;
            }

            // ✅ Collect all particulars until numeric or cheque number
            let particularsTokens = [];
            while (tokens[i] && !isAmount(tokens[i]) && !isBalance(tokens[i]) && !isChequeNo(tokens[i])) {
                particularsTokens.push(tokens[i]);
                i++;
            }
            if (particularsTokens.length) {
                positionedItems.push({
                    text: particularsTokens.join(" "),
                    x: headerXMap['PARTICULARS'],
                    y: yStr
                });
            }

            // ✅ Cheque number detection
            if (tokens[i] && isChequeNo(tokens[i])) {
                positionedItems.push({ text: tokens[i], x: headerXMap['CHQ.NO.'], y: yStr });
                i++;
            }

            // ✅ Collect numeric tokens (amount + balance)
            const numericTokens = [];
            while (i < tokens.length) {
                numericTokens.push(tokens[i]);
                i++;
            }
            if (secondItem) {
                const secondTokens = secondItem.text.trim().split(/\s+/);
                numericTokens.push(...secondTokens);
            }

            // ✅ Classify numeric tokens
            let currBalance = prevBalance;
            numericTokens.forEach(tok => {
                if (isBalance(tok)) {
                    currBalance = normalizeBalance(tok);
                    balanceToken = tok;
                    positionedItems.push({ text: tok, x: headerXMap['BALANCE'], y: yStr });
                } else if (isAmount(tok) && prevBalance !== null && currBalance !== null) {
                    amountToken = tok;
                }
            });

            // ✅ Update prevBalance and classify amount
            if (currBalance !== null) {
                if (amountToken && prevBalance !== null && currBalance !== null) {
                    const header = inferAmountHeaderForStructuredRows(prevBalance, currBalance, Object.keys(headerXMap));
                    positionedItems.push({ text: amountToken, x: headerXMap[header], y: yStr });
                }
                prevBalance = normalizeBalance(balanceToken);
            }

        } else {
            // Continuation row — treat entire line as extended PARTICULARS
            const continuationText = items.map(i => i.text.trim()).join(' ');
            positionedItems.push({
                text: continuationText,
                x: headerXMap['PARTICULARS'],
                y: yStr
            });
        }
    }

    return positionedItems;
};


const parseGroupRows = (groupByY, headerXMap, epsilon = 0.01) => {
    const positionedItems = [];


    const isAmount = str => /^[\d,]+\.\d{2}$/.test(str.trim());
    const isBalance = str => /^[\d,]+\.\d{2}(Cr|Dr)?$/.test(str.trim());
    const isChqNo = str => /^\d{6}$/.test(str.trim()); // Exactly 6 digits

    const sortedYKeys = Object.keys(groupByY).sort((a, b) => parseFloat(a) - parseFloat(b));

    for (const yStr of sortedYKeys) {
        const items = groupByY[yStr];
        if (!items || items.length === 0) continue;

        const hasBF = items.some(item => /B\/F/i.test(item.text));
        if (hasBF) continue;

        const firstText = items[0].text.trim();
        const secondText = items[1]?.text.trim() ?? '';

        const dateMatch = firstText.match(/^(\d{2}-\d{2}-\d{4})/);
        const date = dateMatch?.[0];
        const rest = date ? firstText.slice(date.length).trim() : firstText;

        if (date) {
            positionedItems.push({ text: date, x: headerXMap['DATE'], y: yStr });

            // Extract withdrawal from end
            const withdrawalMatch = rest.match(/([\d,]+\.\d{2})\s*$/);
            const withdrawal = withdrawalMatch?.[1];
            const restWithoutWithdrawal = withdrawal
                ? rest.slice(0, rest.lastIndexOf(withdrawal)).trim()
                : rest;

            // ✅ Split CHQ.NO. from end if it's a 6-digit number
            const tokens = restWithoutWithdrawal.split(/\s+/);
            const lastToken = tokens[tokens.length - 1];
            let chqNo = null;
            let particulars = restWithoutWithdrawal;

            if (isChqNo(lastToken)) {
                chqNo = lastToken;
                particulars = tokens.slice(0, -1).join(' ');
            }

            positionedItems.push({ text: particulars, x: headerXMap['PARTICULARS'], y: yStr });

            if (chqNo) {
                positionedItems.push({ text: chqNo, x: headerXMap['CHQ.NO.'], y: yStr });
            }

            if (withdrawal) {
                positionedItems.push({ text: withdrawal, x: headerXMap['WITHDRAWALS'], y: yStr });
            }

            // ✅ Handle second line
            const secondTokens = secondText.split(/\s+/);
            if (secondTokens.length === 1 && isBalance(secondTokens[0])) {
                positionedItems.push({ text: secondTokens[0], x: headerXMap['BALANCE'], y: yStr });
            } else {
                if (secondTokens[0] && isAmount(secondTokens[0])) {
                    positionedItems.push({ text: secondTokens[0], x: headerXMap['DEPOSITS'], y: yStr });
                }
                if (secondTokens[1] && isBalance(secondTokens[1])) {
                    positionedItems.push({ text: secondTokens[1], x: headerXMap['BALANCE'], y: yStr });
                }
            }
        } else {
            // Continuation row — treat entire line as extended PARTICULARS
            const continuationText = items.map(i => i.text.trim()).join(' ');
            positionedItems.push({
                text: continuationText,
                x: headerXMap['PARTICULARS'],
                y: yStr
            });
        }
    }

    return positionedItems;
};

const parseMultipleHeaderGroupRows = (groupByY, headerXMap, prevBalance = null, epsilon = 0.01) => {
    const positionedItems = [];

    const isAmount = str => /^[\d,]+\.\d{2}$/.test(str.trim());
    const isBalance = str => /^[\d,]+\.\d{2}(Cr|Dr)?$/.test(str.trim());
    const isChqNo = str => /^\d{7}$/.test(str.trim()); // 7 digits
    const isDate = str => /^\d{2}-\d{2}-\d{4}$/.test(str.trim());

    const sortedYKeys = Object.keys(groupByY).sort((a, b) => parseFloat(a) - parseFloat(b));

    for (const yStr of sortedYKeys) {
        const items = groupByY[yStr];
        if (!items || items.length === 0) continue;

        const hasBF = items.some(item => /B\/F/i.test(item.text));
        if (hasBF) continue;

        const lineText = items[0].text.trim();
        const tokens = lineText.split(/\s+/);

        // temp array for this row
        const rowItems = [];

        // 🔹 Transaction Date
        const tranDate = isDate(tokens[0]) ? tokens.shift() : null;
        if (tranDate) {
            rowItems.push({ text: tranDate, x: headerXMap['TRAN'], y: yStr });
        }

        // 🔹 Value Date
        const valueDate = tokens.length && isDate(tokens[0]) ? tokens.shift() : null;
        if (valueDate) {
            rowItems.push({ text: valueDate, x: headerXMap['VALUE_DATE'], y: yStr });
        }

        // 🔹 Balance (last token)
        const balanceToken = tokens[tokens.length - 1];
        let balance = null;
        if (balanceToken && isBalance(balanceToken)) {
            balance = balanceToken;
            tokens.pop();
            rowItems.push({ text: balance, x: headerXMap['BALANCE'], y: yStr });
        }

        // 🔹 Amount (now last token)
        const amountToken = tokens[tokens.length - 1];
        if (amountToken && isAmount(amountToken)) {
            const amount = amountToken;
            tokens.pop();

            if (prevBalance != null && balance != null) {
                const prev = prevBalance; // numeric
                const curr = parseFloat(balance.replace(/,/g, '').replace(/(Cr|Dr)/, ''));
                const amt = parseFloat(amount.replace(/,/g, ''));

                if (curr > prev) {
                    rowItems.push({ text: amount, x: headerXMap['DEPOSITS'], y: yStr });
                } else {
                    rowItems.push({ text: amount, x: headerXMap['WITHDRAWALS'], y: yStr });
                }
                prevBalance = curr;
            } else {
                rowItems.push({ text: amount, x: headerXMap['DEPOSITS'], y: yStr });
            }
        }

        // 🔹 CHQ.NO. (optional 7‑digit)
        if (tokens.length && isChqNo(tokens[tokens.length - 1])) {
            const chqNo = tokens.pop();
            rowItems.push({ text: chqNo, x: headerXMap['CHQ.NO.'], y: yStr });
        }

        // 🔹 Particulars (whatever remains)
        const particulars = tokens.join(' ');
        if (particulars) {
            rowItems.push({ text: particulars, x: headerXMap['PARTICULARS'], y: yStr });
        }

        // ✅ sort row items by x before pushing
        rowItems.sort((a, b) => parseFloat(a.x) - parseFloat(b.x));
        positionedItems.push(...rowItems);
    }

    return positionedItems;
};

const parseTransactionRow = (item, previousBalance, headerPositions) => {
    const { text, y } = item;
    const output = [];

    // Extract dates
    const dateMatches = text.match(/\d{2}\/\d{2}\/\d{2}/g);
    if (dateMatches?.[0]) {
        output.push({ text: dateMatches[0], x: headerPositions['Post Date'], y });
    }
    if (dateMatches?.[1]) {
        output.push({ text: dateMatches[1], x: headerPositions['Value Date'], y });
    }

    // Extract balance
    let balanceValue = null;
    let balanceText = extractBalanceFromText(text);
    if (balanceText) {
        output.push({ text: balanceText, x: headerPositions['Balance'], y });
        balanceValue = parseFloat(balanceText.replace(/(Cr|Dr)/, '').replace(/,/g, ''));
    }

    // Infer amount via delta
    let inferredAmount = null;
    let type = null;
    if (balanceValue !== null && typeof previousBalance === 'number') {
        const delta = balanceValue - previousBalance;
        inferredAmount = Math.abs(delta).toFixed(2);
        type = delta > 0 ? 'Credit' : 'Debit';

        // Confirm amount exists in text
        if (text.includes(inferredAmount)) {
            const amountX = headerPositions[type];
            output.push({ text: inferredAmount, x: amountX, y });
        }
    }

    // Extract cheque number
    const chqMatch = text.match(/CHQ(\d+)(?=\d+\.\d{2})/);
    if (chqMatch?.[1]) {
        output.push({ text: chqMatch[1], x: headerPositions['Chq no'], y });
    }

    // Extract details
    const valueDate = dateMatches?.[1];
    let detailsStart = null;

    if (valueDate) {
        const firstIndex = text.indexOf(valueDate);
        const secondIndex = text.indexOf(valueDate, firstIndex + valueDate.length);
        detailsStart = secondIndex !== -1 ? secondIndex + valueDate.length : firstIndex + valueDate.length;
    }
    const detailsEnd = chqMatch?.index || text.indexOf(inferredAmount) || text.indexOf(balanceText);
    if (detailsStart !== null && detailsEnd > detailsStart) {
        const detailsText = text.slice(detailsStart, detailsEnd).trim();
        output.push({ text: detailsText, x: headerPositions['Details'], y });
    }

    // Fallback: if nothing was extracted, treat as orphaned narration
    if (output.length === 0 && text.trim()) {
        output.push({ text: text.trim(), x: headerPositions['Details'], y });
    }

    // Sort output by x-coordinate
    return output.sort((a, b) => a.x - b.x);
};

const tokenizeTransactionLine = (line) => {
    const date = line.substring(0, 10);
    const rest = line.substring(10).trim();

    const coarseTokens = rest.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);

    if (coarseTokens.length > 0) {
        const firstBlockParts = coarseTokens[0].split(/\s+/).filter(Boolean);

        const tran = firstBlockParts[0]; // always first
        let refNum, narration;

        // Allow numeric or alphanumeric like 99999X
        if (firstBlockParts[1] && /^\d+[A-Z]?$/.test(firstBlockParts[1])) {
            refNum = firstBlockParts[1];
            narration = firstBlockParts.slice(2).join(" "); // join back narration words
        } else {
            narration = firstBlockParts.slice(1).join(" "); // everything after Tran
        }

        return [date, tran, ...(refNum ? [refNum] : []), narration, ...coarseTokens.slice(1)]
            .filter(Boolean);

    }

    return [date];
};


module.exports = { parseTransactionRows, parseStructuredRows, parseGroupRows, parseMultipleHeaderGroupRows, parseTransactionRow, parseTransactionRowsWithFuzzyLogic };
