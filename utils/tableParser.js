const { PdfReader } = require("pdfreader");
const crypto = require('crypto');

const extractTableFromBufferForBankStatement = (fileStream, bankName, userId, financialYear) => {
    return new Promise((resolve, reject) => {
        const tableDataByPage = {};
        const rawItemsByPage = {};
        const alignments = {};
        const headerPositionsByPage = {};
        let currentPage = 0;
        let headersFound = false; // Track if all headers are found
        let headerY = null; // Y-coordinate of the header row
        let tableEndY = null;
        const tableEndYByPage = {};
        let isAfterTable = false; // Flag to ignore rows after "Details of statement"
        let isAFuzzyLogic = false;
        let isParitalHeader = false;
        let isFirstHeaderDetected = false;
        let isHorizontalLineDetected = false;
        let epsilon = 0.1; // Tolerance for y-position comparison
        const bankHeaders = {
            'UNION BANK OF INDIA': [
                ["S.No", "Date", "Transaction Id", "Remarks", "Amount(Rs.)", "Balance(Rs.)"],
                ["Date", "Description", "Instrument No", "Withdrawals(Rs.)", "Deposits(Rs.)", "Balance(Rs.)"],
                ["DATE", "PARTICULARS", "CHQ.NO.", "WITHDRAWALS", "DEPOSITS", "BALANCE"]
            ],
            'CANARA BANK': [
                [
                    'Txn Date', 'Value Date', 'Cheque No.', 'Description',
                    'Branch', 'Debit', 'Credit', 'Balance'
                ],
                [
                    'Date', 'Particulars', 'Deposits', 'Withdrawals', 'Balance'
                ]
            ],
            'SBI': [
                ['Txn Date', 'Value', 'Description', 'Ref No./Cheque',
                    'Debit', 'Credit', 'Balance'],
                ['Txn Date', 'Value Date', 'Description', 'Ref/Cheque',
                    'Debit', 'Credit', 'Balance'],
                ['Txn Date', 'Value Date', 'Description', 'Ref No./Cheque', 'Code',
                    'Debit', 'Credit', 'Balance'],
                ['Post Date', 'Value Date', 'Description', 'Cheque',
                    'Debit', 'Credit', 'Balance'],
                ['Date', 'Details', 'Ref No./Cheque',
                    'Debit', 'Credit', 'Balance']
            ],
            'INDIAN BANK': [
                ["Date", "Transaction Details", "Debits", "Credits", "Balance"],
                ["Post Date", "Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
                ["Post", "Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
                ["Post Date", "Value Date", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
            ],
            'HDFC BANK': [
                ["Date", "Narration", "Chq./Ref.No.", "Value", "Withdrawal", "Deposit", "Balance"]
            ],
            'ICICI BANK': [
                ["Sl", "Id", "Value", "Transaction", "Posted", "Cheque no /", "Remarks", "Withdra", "Deposit", "Balance"],
                ["Sr", "ID", "Value", "Transaction", "Cheque", "Remarks", "Withdrawl", "Deposit", "Balance"]
            ],
            'IDFC FIRST BANK': [
                ["Transaction", "Value Date", "Particulars", "Cheque", "Debit", "Credit", "Balance"],
                ["Trans Date and", "Value Date", "Transaction Details", "Ref/Cheque", "Debit", "Credit", "Balance"]
            ],
            'BANK OF INDIA': [
                ["Sr No", "Date", "Remarks", "Debit", "Credit", "Balance"],
                ["DATE", "PARTICULARS", "CHQ-NO", "Debit", "Credit", "Available Bal."]
            ],
            'AXIS BANK': [
                ["Tran Date", "Chq No", "Particulars", "Debit", "Credit", "Balance", "Init."]
            ],
            'CITY UNION BANK': [
                ["Date", "Particulars", "Chq No", "Debit", "Credit", "Balance"],
                ["DATE", "DESCRIPTION", "CHEQUE NO", "DEBIT", "CREDIT", "BALANCE"]
            ],
            'CENTRAL BANK OF INDIA': [
                ["Value", "Post", "Details", "Chq.No.", "Debit", "Credit", "Balance"],
                ["Post Date", "Value", "Branch", "Cheque", "Account Description", "Debit", "Credit", "Balance"]
            ],
            'ANDHRA PRAGATHI GRAMEENA BANK': [
                ["Post Date", "Value Date", "Details", "Chq no", "Debit", "Credit", "Balance"]
            ],
            'BANK OF BARODA': [
                ["DATE", "PARTICULARS", "CHQ.NO.", "WITHDRAWALS", "DEPOSITS", "BALANCE"]
            ],
            'KARUR VYSYA BANK': [
                ["Txn", "Value", "Brn", "Particulars", "Ref. No", "Debit", "Credit", "Balance"],
                ["TXN DATE", "VALUE DATE", "DESCRIPTION", "DEBIT", "CREDIT", "BALANCE"]
            ],
            // Add more banks dynamically
        };

        const headerYForBank = {
            'SBI': [
                'Txn Date', 'Post Date', 'Date'
            ]
        };

        const sbifirstHeaders = ['Txn Date', 'Post Date'];//Except Date format

        // Bank-specific table end marker logic
        const bankEndMarkers = {
            'UNION BANK OF INDIA': [
                'Details of statement',
                'Closing Balance',
                /^Page\s+\d+\s+of\s+\d+$/
            ],
            'CANARA BANK': [
                /Page\s+\d+\s+of\s+\d+/i,
                /Page\s+(\d+)/i,
                'Disclaimer:',
                'Closing Balance'
            ],
            'SBI': [
                'Please do not share your ATM, Debit/Credit card number, PIN (Personal Identification Number) and OTP (One Time Password)',
                'Please do not share your ATM Debit/Credit card numbe',
                '** This is computer generated statement and does not require a signature.',
                "Page no.",
                "CLOSING BALANCE"
            ],
            'INDIAN BANK': [
                'Ending Balance',
                'Carried Forward',
                'CLOSING BALANCE :',
                'CLOSING BALANCE:'
            ],
            'HDFC BANK': [
                'STATEMENTSUMMARY',
                'Page'

            ],
            'CITY UNION BANK': [
                /Page\s+\d+\s+of\s+\d+/i,
                'Total',
            ],
            'ICICI BANK': [
                /Page\s+\d+\s+of/i,
                'Page Total',
            ],
            'BANK OF INDIA': [
                'Transaction Date',
                'NOTE:'
            ],
            'AXIS BANK': [
                'Legends :',
                'TRANSACTION TOTAL'
            ],
            'IDFC FIRST BANK': [
                'REGISTERED OFFICE: IDFC FIRST BANK LIMITED, KRM Tower. 7th Floor, No. 1, Harrington Road, Chetpet, C',
                'REGISTERED OFFICE : IDFC FIRST BANK LIMITED, KRM To',
                /Page\s+\d+\s+Of/i
            ],
            'CENTRAL BANK OF INDIA': [
                'CLOSING BALANCE:',
                'CARRIED FORWARD :',
                /^Statement\s+Downloaded\s+By\s+(.+)$/
            ],
            'ANDHRA PRAGATHI GRAMEENA BANK': [
                'Ope Bal'
            ],
            'BANK OF BARODA': [
                /^\s*Page Total:/
            ],
            'KARUR VYSYA BANK': [
                'Statements are sent to customers only where transac',
                'Karur Vysya Bank does not ask for personal security',
                'Total Amount Recovered till date (Principal , Interest, Charges)',
                /^Page:\s*\d+$/
            ],
            // Add more banks as needed
        };

        const banksToExcludeCarryForward = ['UNION BANK OF INDIA', 'CANARA BANK', 'SBI', 'CITY UNION BANK', 'AXIS BANK', 'BANK OF BARODA', 'KARUR VYSYA BANK']; // add banks as needed
        const banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward = ['INDIAN BANK']; // add banks as needed --> validated
        const banksToIncludeRefineRefNoAndNarration = ['HDFC BANK']; // add banks as needed
        const banksToIncludeRefineTransactionIdAndNarration = ['UNION BANK OF INDIA']; // add banks as needed
        const banksToIncludeRefineDateAndNarration = ['CITY UNION BANK', 'IDFC FIRST BANK']; // add banks as needed --> validated
        const banksToIncludeRefineDateAndDetails = ['INDIAN BANK']; // add banks as needed --> validated
        const banksToIncludeOrderChangeOfBalance = ['CITY UNION BANK']; // add banks as needed
        const banksToIncludeYAxisInJsonConversion = ['CITY UNION BANK']; // add banks as needed
        const banksToIncludeYAxisInJsonConversionGeneric = ['IDFC FIRST BANK']; // add banks as needed
        const banksToIncludeMergeNarrationLines = ['HDFC BANK']; // add banks as needed
        const banksToIncludeMergeTransactionDetails = ['IDFC FIRST BANK']; // add banks as needed --> validated
        const banksToIncludeCarryForwardLogicToreplaceYAxis = ['IDFC FIRST BANK']; // add banks as needed --> validated
        const bankshasHeadersInOnePage = ['HDFC BANK', 'ICICI BANK', 'BANK OF INDIA', 'AXIS BANK', 'ANDHRA PRAGATHI GRAMEENA BANK', 'KARUR VYSYA BANK', 'UNION BANK OF INDIA']; // add banks as needed
        const bankToIncludeValidateHeaderWithCustomParameter = ['HDFC BANK', 'BANK OF INDIA', 'AXIS BANK', 'KARUR VYSYA BANK']; // add banks as needed
        const bankToIncludeValidateHeaderWithMonthName = ['KARUR VYSYA BANK']; // add banks as needed
        const banksToIncludeRefineCreditAndBalance = ['CENTRAL BANK OF INDIA']; // add banks as needed
        const banksToIncludeRefineChequeAndAccountDescription = ['CENTRAL BANK OF INDIA']; // add banks as needed
        const banksToIncludeRefineBranchAndParticulars = ['KARUR VYSYA BANK']; // add banks as needed
        const bankToIncludeValidateHeaderWithTransactionId = ['ICICI BANK']; // add banks as needed
        const bankToIncludeValidateHeaderWithTimeStamp = ['UNION BANK OF INDIA']; // add banks as needed
        const banksToIncludeChangeHeadersXAxisForAmounts = ['UNION BANK OF INDIA']; // add banks as needed
        const banksToIncludeMergeHeaders = ['CITY UNION BANK', 'ANDHRA PRAGATHI GRAMEENA BANK']; // add banks as needed
        const banksToIncludeMergeHeadersInOnePage = ['ANDHRA PRAGATHI GRAMEENA BANK']; // add banks as needed
        const banksToIncludeParitalMergeHeaders = ['CENTRAL BANK OF INDIA', 'BANK OF BARODA', 'UNION BANK OF INDIA']; // add banks as needed
        const banksToIncludeHorizontalLine = ['BANK OF INDIA']; // add banks as needed
        const banksToIncludeHeadersInMultipleLines = ['ICICI BANK']; // add banks as needed
        const banksToIncludeHeadernWithEpsilionVaration = ['IDFC FIRST BANK']; // add banks as needed --> validated
        const banksToIncludeHeadernWithEpsilionVarationWithLatestFormat = ['SBI']; // add banks as needed --> validated
        const banksToIncludeHeadernWithEpsilionVarationWithTwoTypesOfHeaders = ['INDIAN BANK']; // add banks as needed --> validated
        const banksToFilterUnnecessaryDataWithtableEndY = ['SBI']; // add banks as needed --> validated
        const banksToFilterMultipleHeaderInSamePage = ['UNION BANK OF INDIA']; // add banks as needed --> validated
        const banksToIncludeHeadersAlign = ['BANK OF INDIA', 'HDFC BANK', 'KARUR VYSYA BANK']; // add banks as needed
        const banksToIncludeChangeHeadersAlign = ['HDFC BANK']; // add banks as needed
        const banksToIncludeChangeHeadersAlignWithAmounts = ['KARUR VYSYA BANK']; // add banks as needed
        const banksToIncludeHeadersAlignChangeXAxis = ['AXIS BANK']; // add banks as needed
        const banksToIncludeOrderChangeOfRemarks = ['BANK OF INDIA']; // add banks as needed

        let requiredHeaders = [];
        const headerVariants = bankHeaders[bankName] || [];
        // console.log(headerVariants);

        // console.log(requiredHeaders);
        let detectedHeaders = new Set(); // Store detected headers for validation

        new PdfReader().parseBuffer(fileStream, (err, item) => {
            if (err) {
                reject(err);
            } else if (!item) {
                // End of buffer - process and resolve table data
                const combinedTableData = {};
                const pageKeys = Object.keys(tableDataByPage);
                if (banksToFilterUnnecessaryDataWithtableEndY.includes(bankName)) {
                    const pages = Object.entries(tableDataByPage);
                    pages.forEach(([page, items]) => {
                        if (tableEndYByPage[page]) {
                            const groupByY = groupItemsByY(tableDataByPage[page], 0.01);
                            const filteredGroups = filterGroupedByY(groupByY, tableEndYByPage[page]);
                            const flattened = Object.values(filteredGroups).flat();
                            tableDataByPage[page] = flattened;
                        }
                    });
                }

                if (isAFuzzyLogic && banksToIncludeMergeHeaders.includes(bankName)) {
                    if (banksToIncludeMergeHeadersInOnePage.includes(bankName)) {
                        const pages = Object.entries(tableDataByPage);

                        const [firstPageKey, firstPageItems] = pages[0];
                        // console.log(firstPageKey);
                        // console.log(Object.keys(headerPositionsByPage[firstPageKey]));

                        // Infer headerXMap only once using the first page
                        const headerXMap = estimateHeaderPositions(headerPositionsByPage[firstPageKey]['Post Date'], Object.keys(headerPositionsByPage[firstPageKey]));
                        console.log("📌 Inferred header positions from first page:", headerXMap);
                        let previousBalance = null;
                        pages.forEach(([page, items]) => {

                            headerPositionsByPage[page] = { ...headerXMap };

                            const groupByY = parseInt(page) === 1 ? groupItemsByY(tableDataByPage[page], 0.01) : groupItemsByY(rawItemsByPage[page], 0.01);

                            // console.log(groupByY);

                            const extractedBalance = extractPreviousBalance(groupByY);

                            if (extractedBalance) {
                                previousBalance = extractedBalance;
                            } else if (previousBalance) {
                                // Retain previous value and type, but drop y and raw
                                previousBalance = {
                                    value: previousBalance.value,
                                    type: previousBalance.type
                                };
                            }

                            const allParsedItems = [];

                            let statementFound = false;

                            for (const [yKey, items] of Object.entries(groupByY)) {
                                const yValue = parseFloat(yKey);

                                // Skip BROUGHT FORWARD row
                                if (previousBalance && yValue <= previousBalance.y) continue;

                                // If previousBalance is missing, wait until "Statement of Account" is found
                                if (!previousBalance.y && !statementFound) {
                                    const hasStatement = items.some(i => i.text.includes('Statement of Account'));
                                    if (hasStatement) {
                                        statementFound = true;
                                        continue; // skip this row too
                                    } else {
                                        continue; // skip this row
                                    }
                                }
                                // console.log(items);

                                for (const item of items) {
                                    const parsed = parseTransactionRow(item, previousBalance?.value ?? 0, headerPositionsByPage[page]);
                                    allParsedItems.push(...parsed);

                                    const balanceItem = parsed.find(p => p.x === headerPositionsByPage[page]['Balance']);
                                    // console.log(balanceItem);
                                    if (previousBalance && balanceItem) {
                                        previousBalance.value = parseFloat(balanceItem.text.replace(/(Cr|Dr)/, '').replace(/,/g, ''));
                                    }
                                }
                            }

                            // console.log(allParsedItems);
                            tableDataByPage[page] = allParsedItems;
                        });


                    } else {
                        const pages = Object.entries(tableDataByPage);

                        // Infer headerXMap only once using the first page
                        const [firstPageKey, firstPageItems] = pages[0];
                        const headerXMap = inferHeaderXMap(firstPageItems);
                        console.log("📌 Inferred header positions from first page:", headerXMap);

                        // Apply this headerXMap across all pages
                        pages.forEach(([page, items]) => {
                            // Use the shared headerXMap for each page
                            console.log(`🧩 Page ${page} headers:`, headerXMap);
                            headerPositionsByPage[page] = { ...headerXMap };

                            const groupByY = groupItemsByY(items, 0.200);
                            // console.log(groupByY);

                            updateGroupsWithAmountItems(groupByY, headerXMap);
                            updateGroupsWithChequeNo(groupByY, headerXMap);
                            cleanChequeNoFromAmount(groupByY, headerXMap);
                            // console.log(groupByY);
                            const flattened = Object.values(groupByY).flat();
                            tableDataByPage[page] = flattened;

                        });
                    }
                }
                if (!isAFuzzyLogic && banksToIncludeMergeHeadersInOnePage.includes(bankName)) {
                    const firstHeaderPositions = headerPositionsByPage[1]; // Assuming page 1 always has headers
                    // console.log(firstHeaderPositions);
                    let previousBalance = null;

                    Object.keys(tableDataByPage).forEach(page => {
                        const groupByY = parseInt(page) === 1 ? groupItemsByY(tableDataByPage[page], 0.01) : groupItemsByY(rawItemsByPage[page], 0.01);
                        const extractedBalance = extractPreviousBalance(groupByY);
                        if (extractedBalance) {
                            previousBalance = extractedBalance;
                        } else if (previousBalance) {
                            // Retain previous value and type, but drop y and raw
                            previousBalance = {
                                value: previousBalance.value,
                                type: previousBalance.type
                            };
                        }
                        if (parseInt(page) === 1) return; // ⛔ Skip Page 1 — already handled
                        // Clone all positions from Page 1
                        headerPositionsByPage[page] = { ...firstHeaderPositions };
                        const allParsedItems = [];

                        let statementFound = false;
                        for (const [yKey, items] of Object.entries(groupByY)) {
                            const yValue = parseFloat(yKey);

                            // Skip BROUGHT FORWARD row
                            if (previousBalance && yValue <= previousBalance.y) continue;

                            // If previousBalance is missing, wait until "Statement of Account" is found
                            if (!previousBalance.y && !statementFound) {
                                const hasStatement = items.some(i => i.text.includes('Statement of Account'));
                                if (hasStatement) {
                                    statementFound = true;
                                    continue; // skip this row too
                                } else {
                                    continue; // skip this row
                                }
                            }
                            // console.log(items);
                            allParsedItems.push(...items);

                        }
                        const validRowGroup = Object.values(groupItemsByY(allParsedItems, 0.01)).find(group => {
                            if (group.length < 1) return false;

                            let dateCount = 0;
                            let amountCount = 0;
                            let textCount = 0;

                            group.forEach(({ text }) => {
                                const txt = text.trim();

                                if (/^\d{2}\/\d{2}\/\d{2}$/.test(txt)) {
                                    dateCount++;
                                } else if (/^\d+\.\d{2}$/.test(txt)) {
                                    amountCount++;
                                    // Match narration: must contain letters and not be a balance
                                } else if (/[a-zA-Z]/.test(txt) && !/\.\d{2}(Cr|Dr)$/.test(txt)) {
                                    textCount++;
                                }

                            });

                            // Case 1: Full transaction row
                            const isTransactionRow = dateCount >= 2 && amountCount >= 1 && textCount >= 1;

                            // Case 2: Narration-only row
                            const isNarrationOnly = dateCount === 0 && amountCount === 0 && textCount >= 1;

                            return isTransactionRow || isNarrationOnly;
                        });
                        if (validRowGroup) {
                            tableDataByPage[page] = allParsedItems;
                        }
                        // console.log(headerPositionsByPage[page]);
                        // console.log(tableDataByPage[page]);
                    });

                }

                if (isHorizontalLineDetected && banksToIncludeHorizontalLine.includes(bankName)) {

                    const pages = Object.entries(rawItemsByPage);

                    // Infer headerXMap only once using the first page
                    const [firstPageKey, firstPageItems] = pages[0];
                    const groupByY = groupItemsByY(firstPageItems, 0.01);
                    const mergedLines = mergeGroupedText(groupByY);
                    const header = detectHeaderLine(mergedLines, headerVariants);
                    const headerXMap = estimateHeaderXMap(header.text, 0, 1); // baseX and charWidth can be tuned
                    console.log("📌 Inferred header positions from first page:", headerXMap);


                    // Apply this headerXMap across all pages
                    pages.forEach(([page, items]) => {
                        // Use the shared headerXMap for each page
                        // console.log(`🧩 Page ${page} headers:`, headerXMap);
                        headerPositionsByPage[page] = { ...headerXMap };

                        const groupByY = groupItemsByY(items, 0.01);
                        const mergedLines = mergeGroupedText(groupByY);
                        let flattened = Object.values(parseDataRows(mergedLines, headerPositionsByPage[page], Object.keys(headerPositionsByPage[page]))).flat();

                        if (parseInt(page) > 1) {
                            const carryForwarded = Object.values(
                                extractcarryForwardedParticulars(mergedLines, headerPositionsByPage[page])
                            ).flat();

                            if (carryForwarded.length) {
                                flattened = [...carryForwarded, ...flattened]; // prepend
                            }
                        }

                        tableDataByPage[page] = flattened

                    });

                }

                if (alignments["BALANCE"] && isHorizontalLineDetected && banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    let pages = null;

                    if (banksToFilterMultipleHeaderInSamePage.includes(bankName)) {
                        pages = Object.entries(rawItemsByPage).map(([pageNum, data], index) => {
                            if (index === 0) {
                                // Override first page with tableDataByPage
                                const override = tableDataByPage[pageNum];
                                return [pageNum, override ?? data]; // fallback if override missing
                            }
                            return [pageNum, data];
                        });
                    } else {
                        pages = Object.entries(tableDataByPage);
                    }
                    const [firstPageKey, firstPageItems] = pages[0];
                    const headerXMap = reestimateHeaderMap(headerPositionsByPage[firstPageKey], findAnchorHeaders(headerPositionsByPage[firstPageKey])); // baseX and charWidth can be tuned
                    // console.log(headerXMap);
                    // Apply this headerXMap across all pages
                    pages.forEach(([page, items]) => {
                        headerPositionsByPage[page] = { ...headerXMap };
                        const filteredItems = items.filter(item => {
                            const text = item.text?.trim();
                            return text && !isHorizontalLine(text);
                        });
                        let groupByY = groupItemsByY(filteredItems, 0.01);
                        let flattened = null
                        if (banksToFilterMultipleHeaderInSamePage.includes(bankName)) {
                            groupByY = filterValidGroups(groupByY, Object.keys(headerPositionsByPage[page]));
                            flattened = Object.values(parseGroupRows(groupByY, headerPositionsByPage[page])).flat();
                        } else {
                            flattened = Object.values(parseStructuredRows(groupByY, headerPositionsByPage[page])).flat();
                        }
                        tableDataByPage[page] = flattened
                    });

                }
                if (alignments["Balance"] && isParitalHeader && banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    const pages = Object.entries(tableDataByPage);
                    const [firstPageKey, firstPageItems] = pages[0];

                    const debitX = headerPositionsByPage[firstPageKey]['Debit'];
                    const creditX = headerPositionsByPage[firstPageKey]['Credit'];
                    const balanceX = headerPositionsByPage[firstPageKey]['Balance'];

                    const allEqual = debitX === creditX && creditX === balanceX;
                    if (allEqual) {
                        const groupByY = groupItemsByY(firstPageItems, 0.01);
                        const cleanGroupByYAxis = cleanGroupedByYAxis(groupByY);
                        const filteredData = filterAfterBroughtForward(cleanGroupByYAxis);
                        const validRowGroup = Object.values(filteredData).find(group => {
                            if (group.length < 6) return false;

                            let dateCount = 0;
                            let amountCount = 0;
                            let textCount = 0;
                            let balanceCount = 0;

                            group.forEach(({ text }) => {
                                const txt = text.trim();

                                if (/^\d{2}\/\d{2}\/\d{2}$/.test(txt)) {
                                    dateCount++;
                                } else if (/^\d+\.\d{2}$/.test(txt)) {
                                    amountCount++;
                                    // Match narration: must contain letters and not be a balance
                                } else if (/[a-zA-Z]/.test(txt) && !/\.\d{2}(Cr|Dr)$/.test(txt)) {
                                    textCount++;
                                } else if (/\.\d{2}(Cr|Dr)$/.test(txt)) {
                                    balanceCount++;
                                }

                            });

                            return dateCount >= 2 && amountCount >= 1 && textCount >= 1 && balanceCount >= 1;

                        });
                        const balanceRegex = /\.\d{2}(Cr|Dr)$/;

                        for (const item of validRowGroup) {
                            const txt = item.text.trim();
                            if (balanceRegex.test(txt)) {
                                headerPositionsByPage[firstPageKey]['Balance'] = item.x;
                                break; // assuming only one balance per row
                            }
                        }

                        if (headerPositionsByPage[firstPageKey]['Balance']) {
                            const debitX = headerPositionsByPage[firstPageKey]['Debit'];
                            const estimatedGap = (headerPositionsByPage[firstPageKey]['Balance'] - debitX) / 3;
                            const creditX = debitX + estimatedGap;
                            headerPositionsByPage[firstPageKey]['Credit'] = creditX;
                        }
                    }
                    pages.forEach(([page, items]) => {

                        if (allEqual && parseInt(page) > 1) {
                            headerPositionsByPage[page]['Credit'] = headerPositionsByPage[firstPageKey]['Credit'];
                            headerPositionsByPage[page]['Balance'] = headerPositionsByPage[firstPageKey]['Balance'];
                        }

                        // 📐 Group by Y-axis
                        const groupByY = groupItemsByY(items, 0.01);
                        const cleanGroupByYAxis = cleanGroupedByYAxis(groupByY);
                        const filteredData = filterAfterBroughtForward(cleanGroupByYAxis);
                        const mergeSplitAmountData = mergeAmountFragments(filteredData, headerPositionsByPage[page]);
                        const mergeSplitBalanceData = mergeBalanceFragments(mergeSplitAmountData, headerPositionsByPage[page]);
                        const flattened = Object.values(mergeSplitBalanceData).flat();
                        tableDataByPage[page] = flattened;
                    });
                }

                if (!isAFuzzyLogic && bankshasHeadersInOnePage.includes(bankName)) {

                    Object.entries(rawItemsByPage).forEach(([page, items]) => {

                        if (bankToIncludeValidateHeaderWithCustomParameter.includes(bankName)) {
                            // 📐 Group by Y-axis
                            const yGroups = {};
                            items.forEach(({ text, x, y }) => {
                                const key = Math.round(y * 10); // Bucket by 0.1 resolution
                                yGroups[key] = yGroups[key] || [];
                                yGroups[key].push({ text, x, y });
                            });

                            // 🔎 Look for one valid row group with 6 items and semantic pattern match
                            let validRowGroup;
                            if (banksToIncludeRefineRefNoAndNarration.includes(bankName)) {
                                validRowGroup = Object.values(yGroups).find(group => {
                                    if (group.length < 6) return false;

                                    let dateCount = 0;
                                    let amountCount = 0;
                                    let textCount = 0;

                                    group.forEach(({ text }) => {
                                        const txt = text.trim();
                                        if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(txt)) dateCount++;
                                        else if (/^[₹]?[0-9,]+\.\d{2}$/.test(txt)) amountCount++;
                                        else if (/\w/.test(txt)) textCount++; // generic text validation
                                    });

                                    return dateCount >= 2 && amountCount >= 2 && textCount >= 2;
                                });
                                if (validRowGroup?.length >= 6) {
                                    const narration = validRowGroup[1]; // Second item is typically narration

                                    headerPositionsByPage[page]["Narration"] = narration.x;

                                    console.log(`🎯 Narration header anchor realigned to x: ${narration.x}`);
                                }
                            }
                            validRowGroup = Object.values(yGroups).find(group => {
                                if (group.length < 5) return false;

                                let dateCount = 0;
                                let amountCount = 0;
                                let textCount = 0;

                                group.forEach(({ text }) => {
                                    const txt = text.trim();

                                    if (bankToIncludeValidateHeaderWithMonthName.includes(bankName)) {
                                        if (/^\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}$/.test(txt)) {
                                            dateCount++;
                                        }
                                    }
                                    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(txt)) dateCount++;
                                    else if (/^[₹]?[0-9,]+\.\d{2}$/.test(txt)) amountCount++;
                                    else if (/\w/.test(txt)) textCount++; // generic text validation
                                });

                                return dateCount >= 1 && amountCount >= 1 && textCount >= 1;
                            });
                            // console.log(validRowGroup);

                            if (parseInt(page) === 1) return; // ⛔ Skip Page 1 — already handled by headers

                            // 📦 Inject fallback only if valid group found AND header logic didn’t already populate
                            if (!tableDataByPage[page]?.length && validRowGroup) {
                                tableDataByPage[page] = [];

                                items.forEach(item => {
                                    tableDataByPage[page].push(item);
                                });

                                // console.log(`📦 Fallback table injected for page ${page} using semantic match.`);
                            }
                        }

                        if (bankToIncludeValidateHeaderWithTransactionId.includes(bankName)) {
                            if (parseInt(page) === 1)
                                rawItemsByPage[page] = tableDataByPage[page];

                            // console.log(rawItemsByPage[page]);

                            const mergedXAxisrows = combineMultiLineRows(rawItemsByPage[page]);
                            // console.log(mergedXAxisrows);
                            const mergeWrappedAmount = combineWrappedAmounts(mergedXAxisrows);
                            // console.log(mergeWrappedAmount);

                            // 📐 Group by Y-axis
                            const yGroups = {};
                            mergeWrappedAmount.forEach(({ text, x, y }) => {
                                const key = Math.round(y * 10); // Bucket by 0.1 resolution
                                yGroups[key] = yGroups[key] || [];
                                yGroups[key].push({ text, x, y });
                            });

                            // 🔎 Look for one valid row group with 6 items and semantic pattern match

                            const validRowGroup = Object.values(yGroups).find(group => {
                                return group.some(({ text }) =>
                                    /^S\d{4}\s\d{4}$/.test(text.trim()) ||  // Format: S1234 5678
                                    /^S\d{6,7}$/.test(text.trim())         // Format: S123456 or S1234567
                                );
                            });

                            // console.log(validRowGroup);

                            // 📦 Inject fallback only if valid group found AND header logic didn’t already populate
                            if (validRowGroup) {
                                tableDataByPage[page] = [];

                                mergeWrappedAmount.forEach(item => {
                                    tableDataByPage[page].push(item);
                                });

                                // console.log(`📦 Fallback table injected for page ${page} using semantic match.`);
                            }
                        }
                        if (bankToIncludeValidateHeaderWithTimeStamp.includes(bankName) && alignments["Instrument No"]) {
                            if (parseInt(page) === 1)
                                rawItemsByPage[page] = tableDataByPage[page];

                            // console.log(rawItemsByPage[page]);

                            const mergedXAxisrows = combineMultiLineRows(rawItemsByPage[page]);
                            // console.log(mergedXAxisrows);
                            const mergeWrappedAmount = combineWrappedAmounts(mergedXAxisrows);
                            // console.log(mergeWrappedAmount);

                            // 📐 Group by Y-axis
                            const yGroups = {};
                            mergeWrappedAmount.forEach(({ text, x, y }) => {
                                const key = Math.round(y * 10); // Bucket by 0.1 resolution
                                yGroups[key] = yGroups[key] || [];
                                yGroups[key].push({ text, x, y });
                            });

                            // 🔎 Look for one valid row group with 6 items and semantic pattern match

                            const validDateGroups = Object.values(yGroups).filter(group =>
                                group.some(({ text }) =>
                                    /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/.test(text.trim())
                                )
                            );

                            const flattened = Object.values(validDateGroups).flat();
                            tableDataByPage[page] = flattened;
                        }
                    });

                    const firstHeaderPositions = headerPositionsByPage[1]; // Assuming page 1 always has headers
                    console.log(firstHeaderPositions);

                    Object.keys(tableDataByPage).forEach(page => {
                        if (!banksToIncludeChangeHeadersXAxisForAmounts.includes(bankName)) {
                            if (parseInt(page) === 1) return; // ⛔ Skip Page 1 — already handled
                        }

                        const narrationOverride = headerPositionsByPage[page]?.["Narration"];

                        // Clone all positions from Page 1
                        headerPositionsByPage[page] = { ...firstHeaderPositions };

                        // 🔒 Restore narration if previously realigned
                        if (narrationOverride !== undefined) {
                            headerPositionsByPage[page]["Narration"] = narrationOverride;
                            // console.log(`🎯 Retained Narration x=${narrationOverride} on Page ${page}`);
                        }

                        // 🎯 Apply +2 offset to selected headers
                        ["Instrument No", "Withdrawals(Rs.)", "Deposits(Rs.)", "Balance(Rs.)"].forEach(header => {
                            if (headerPositionsByPage[page][header] !== undefined) {
                                headerPositionsByPage[page][header] += 2;
                            }
                        });

                        // console.log(`🌀 Header positions cloned to Page ${page}`);
                    });
                }

                // console.log("header cloned");

                pageKeys.forEach((page, index) => {

                    const nextPage = pageKeys[index + 1]; // will be undefined for last page
                    // Combine multi-line rows for each page
                    // console.log(tableDataByPage[page]);
                    // console.log(headerPositionsByPage[page]);
                    const columnXMap = headerPositionsByPage[page]; // Your existing header position map

                    let snappedTableData;
                    let width = 1;
                    // console.log(alignments);
                    if (banksToIncludeChangeHeadersAlign.includes(bankName)) {
                        alignments["Deposit"] = 'left';
                        alignments["Balance"] = 'left';
                        width = 0.5
                    }
                    if (banksToIncludeChangeHeadersAlignWithAmounts.includes(bankName)) {
                        alignments["Debit"] = 'left';
                        alignments["Credit"] = 'left';
                        alignments["Balance"] = 'left';
                        alignments["BALANCE"] = 'left';
                        alignments["VALUE DATE"] = 'left';
                        alignments["TXN DATE"] = 'left';
                        width = 0.2
                    }

                    if (banksToIncludeHeadersAlign.includes(bankName)) {
                        snappedTableData = tableDataByPage[page].map(item =>
                            snapToColumnWithAlignment(item, columnXMap, alignments, width)
                        );
                    } else {
                        snappedTableData = tableDataByPage[page].map(item =>
                            snapToColumn(item, columnXMap)
                        );
                    }
                    // console.log(snappedTableData);

                    if (banksToIncludeHeadersAlignChangeXAxis.includes(bankName)) {
                        snappedTableData = snapXCoordinate(snappedTableData, columnXMap["Chq No"], columnXMap["Particulars"], 0.1);
                    }

                    if (banksToIncludeRefineCreditAndBalance.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineAmountSnappedToBalance(item, columnXMap["Credit"], columnXMap["Balance"])
                        );
                    }

                    if (banksToIncludeRefineChequeAndAccountDescription.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineChequeAndNarration(item, columnXMap["Account Description"], columnXMap["Cheque"])
                        );
                    }

                    if (banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Transaction Details"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineValueDateAndParticulars(item, columnXMap["Transaction Details"], columnXMap["Value Date"])
                        );
                    }

                    if (banksToIncludeRefineBranchAndParticulars.includes(bankName) && columnXMap["Brn"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineBranchAndNarration(item, columnXMap["Particulars"], columnXMap["Brn"])
                        );
                    }

                    if (banksToIncludeOrderChangeOfRemarks.includes(bankName) && columnXMap["Remarks"]) {

                        snappedTableData = [
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Remarks"]) >= epsilon),
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Remarks"]) <= epsilon)
                        ].sort((a, b) => a.y - b.y); // optional: restore order
                    }

                    if (banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && columnXMap["Details"]) {

                        snappedTableData = [
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Details"]) >= epsilon),
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Details"]) <= epsilon)
                        ].sort((a, b) => {
                            const yDiff = a.y - b.y;
                            if (Math.abs(yDiff) > epsilon) {
                                return yDiff; // sort by Y
                            }
                            return a.x - b.x; // if Y is close, sort by X
                        });
                    }

                    if (banksToIncludeRefineTransactionIdAndNarration.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineTransactionIdAndRemarks(item, columnXMap["Remarks"], columnXMap["Transaction Id"])
                        );
                    }

                    if (banksToIncludeRefineRefNoAndNarration.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineRefNoAndNarration(item, columnXMap["Narration"], columnXMap["Chq./Ref.No."])
                        );
                    }
                    if (banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Particulars"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineDateAndParticulars(item, columnXMap["Particulars"], columnXMap["Date"])
                        );
                    }
                    if (banksToIncludeRefineDateAndDetails.includes(bankName) && columnXMap["Details"]) {
                        const dateColumn = columnXMap["Date"] || columnXMap["Value Date"];
                        if (dateColumn) {
                            snappedTableData = snappedTableData.map(item =>
                                refineValueDateAndParticulars(item, columnXMap["Details"], dateColumn)
                            );
                        }
                    }
                    if (banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Particulars"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineDateAndParticulars(item, columnXMap["Particulars"], columnXMap["Value Date"])
                        );
                    }
                    const mergedDates = combineDateFragments(snappedTableData);

                    // console.log(mergedDates);
                    // 👉 use nextPage if it exists
                    const hasBroughtForward = snappedTableData.some(
                        item => item.text.toLowerCase().includes("brought forward")
                    );
                    if (nextPage && !banksToExcludeCarryForward.includes(bankName)) {
                        if (!(hasBroughtForward && banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward.includes(bankName))) {

                            const nextColumnXMap = headerPositionsByPage[nextPage]; // Your existing header position map
                            // console.log(tableDataByPage[nextPage]);

                            let nextSnappedTableData = tableDataByPage[nextPage].map(item =>
                                snapToColumn(item, nextColumnXMap)
                            );

                            if (banksToIncludeRefineDateAndNarration.includes(bankName)) {

                                nextSnappedTableData = nextSnappedTableData.map(item =>
                                    refineValueDateAndParticulars(item, columnXMap["Transaction Details"], columnXMap["Value Date"])
                                );
                            }

                            // console.log(nextSnappedTableData);
                            let nextMergedDates = combineDateFragments(nextSnappedTableData);
                            // console.log(nextMergedDates);

                            if (banksToIncludeMergeTransactionDetails.includes(bankName)) {
                                nextMergedDates = nextMergedDates.map(item =>
                                    refineYAxisOfParticularsWithDate(item, columnXMap["Trans Date and"], columnXMap["Transaction Details"], nextMergedDates, 0.9)
                                );
                            }

                            let carryForwardRows = getCarryForwardFragments(columnXMap, nextMergedDates);

                            if (banksToIncludeRefineRefNoAndNarration.includes(bankName)) {

                                carryForwardRows = carryForwardRows.map(item =>
                                    refineRefNoAndNarration(item, nextColumnXMap["Narration"], nextColumnXMap["Chq./Ref.No."])
                                );
                                const currentPagenarration = mergedDates.filter(item =>
                                    Math.abs(item.x - columnXMap["Narration"]) < epsilon
                                );
                                const lastNarrationY = currentPagenarration.length
                                    ? currentPagenarration[currentPagenarration.length - 1].y
                                    : null;
                                if (lastNarrationY !== null) {
                                    carryForwardRows = carryForwardRows.map(row => ({
                                        ...row,
                                        y: lastNarrationY
                                    }));
                                }
                            }

                            if (banksToIncludeCarryForwardLogicToreplaceYAxis.includes(bankName)) {
                                const currentPagenarration = mergedDates.filter(item =>
                                    Math.abs(item.x - columnXMap["Transaction Details"]) < epsilon
                                );
                                const lastNarrationY = currentPagenarration.length
                                    ? currentPagenarration[currentPagenarration.length - 1].y
                                    : null;
                                if (lastNarrationY !== null) {
                                    carryForwardRows = carryForwardRows.map(row => ({
                                        ...row,
                                        y: lastNarrationY
                                    }));
                                }
                            }

                            console.log(carryForwardRows);
                            mergedDates.push(...carryForwardRows);
                        }

                    }
                    // console.log(mergedDates);

                    let combinedRows = null;
                    if (banksToIncludeMergeNarrationLines.includes(bankName)) {

                        const narrationX = columnXMap["Narration"];
                        const dateX = columnXMap["Date"];
                        const sortRequired = true;
                        const mergedNarrationOnly = mergeNarrationLines(mergedDates, narrationX, dateX, sortRequired, 0.1, 1.5);

                        // console.log(mergedNarrationOnly);

                        // 🔁 Now you can replace original narration entries with merged ones
                        combinedRows = [
                            ...mergedDates.filter(item => Math.abs(item.x - narrationX) >= epsilon),
                            ...mergedNarrationOnly
                        ].sort((a, b) => a.y - b.y); // optional: restore order
                    } else if (banksToIncludeMergeTransactionDetails.includes(bankName)) {

                        if (columnXMap["Particulars"]) {
                            combinedRows = combineMultiLineRows(mergedDates);
                        } else {
                            combinedRows = mergedDates.map(item =>
                                refineYAxisOfParticularsWithDate(item, columnXMap["Trans Date and"], columnXMap["Transaction Details"], mergedDates, 0.9)
                            );
                            combinedRows = combineYAxisSameMultiLineRows(combinedRows);
                        }
                        // console.log(combinedRows);
                    }
                    else if (banksToIncludeOrderChangeOfBalance.includes(bankName) && columnXMap["Particulars"]) {

                        combinedRows = mergedDates.map(item =>
                            refineYAxisOfParticularsWithDate(item, columnXMap["Date"], columnXMap["Particulars"], mergedDates, 0.425)
                        );

                        // console.log(combinedRows);
                        combinedRows = combineYAxisSameMultiLineRows(combinedRows);
                        // console.log(combinedRows);

                        combinedRows = [
                            ...combinedRows.filter(item => Math.abs(item.x - columnXMap["Balance"]) >= epsilon),
                            ...combinedRows.filter(item => Math.abs(item.x - columnXMap["Balance"]) <= epsilon)
                        ].sort((a, b) => a.y - b.y); // optional: restore order
                        // console.log(combinedRows);

                    } else {
                        combinedRows = combineMultiLineRows(mergedDates);
                        // console.log(combinedRows);
                    }
                    let tableJSON = null;
                    //    console.log(combinedRows);
                    if (!isAFuzzyLogic && banksToIncludeYAxisInJsonConversion.includes(bankName)) {
                        tableJSON = convertToJSONByY(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    } else if (banksToIncludeYAxisInJsonConversionGeneric.includes(bankName) && columnXMap["Transaction Details"]) {
                        tableJSON = convertToJSONByY(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    } else {
                        tableJSON = convertToJSONSimple(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    }

                    // Convert to JSON
                    // console.log(`Page ${page} Table Data:`, tableJSON);
                    combinedTableData[page] = normalizeBankPDF(tableJSON, bankName, userId, financialYear);
                    // console.log(combinedTableData[page]);
                });
                resolve(combinedTableData);
            } else if (item.page) {
                // New page detected
                currentPage = item.page;
                tableDataByPage[currentPage] = [];
                rawItemsByPage[currentPage] = [];
                headerPositionsByPage[currentPage] = {};
                headersFound = false; // Reset header detection for the new page
                headerY = null;
                tableEndY = null;
                isAfterTable = false; // Reset the flag for the new page
                isFirstHeaderDetected = false;
                detectedHeaders.clear(); // Clear detected headers
            } else if (item.text) {
                let decodedText;
                try {
                    decodedText = decodeURIComponent(item.text);
                } catch (e) {
                    decodedText = item.text; // fallback to raw string if decoding fails
                    console.warn(`⚠ Skipped malformed URI: "${item.text}"`);
                }
                // console.log({
                //     currentPage: currentPage,
                //     text: decodedText,
                //     x: item.x,
                //     y: item.y,
                // });

                // Detect headers

                if (banksToIncludeMergeHeaders.includes(bankName)) {
                    for (const headerSet of headerVariants) {
                        // Count how many headers from headerSet are found inside decodedText
                        const matchCount = headerSet.filter(h =>
                            decodedText.toUpperCase().includes(h.toUpperCase())
                        ).length;
                        // console.log(decodedText);
                        // console.log(matchCount)

                        // If enough headers are matched, assume this set is present
                        if (matchCount >= headerSet.length * 0.8) { // e.g. 80% match threshold
                            if (headerY === null) {
                                headerY = item.y;
                            }

                            if (Math.abs(item.y - headerY) <= epsilon) {
                                for (const h of headerSet) {
                                    if (decodedText.toUpperCase().includes(h.toUpperCase())) {
                                        detectedHeaders.add(h);
                                        headerPositionsByPage[currentPage][h] = item.x; // Approximate for all
                                    }
                                }

                                if (detectedHeaders.size === headerSet.length && headerSet.every(header => detectedHeaders.has(header))) {
                                    headersFound = true;
                                    isAfterTable = false;
                                    isAFuzzyLogic = true;
                                    requiredHeaders = headerSet;
                                    console.log(`Headers detected on Page ${currentPage} using fuzzy match:`, headerSet);
                                    break;
                                }
                            }
                        }
                    }
                }
                if (banksToIncludeHeadersInMultipleLines.includes(bankName)) {
                    epsilon = 0.675;
                }
                if (banksToIncludeHeadernWithEpsilionVaration.includes(bankName)) {
                    epsilon = 0.3;
                }
                if (banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName)) {
                    epsilon = 0.575;
                }
                if (banksToIncludeHeadernWithEpsilionVarationWithTwoTypesOfHeaders.includes(bankName)) {
                    epsilon = 0.675;
                }

                if (banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    for (const headerSet of headerVariants) {
                        const trimmedText = decodedText.trim();

                        // Split merged headers by whitespace
                        const splitHeaders = trimmedText.split(/\s{2,}/).map(h => h.trim()).filter(Boolean);

                        for (const header of splitHeaders) {
                            if (headerSet.includes(header)) {
                                if (headerY === null) {
                                    headerY = item.y;
                                }

                                if (Math.abs(item.y - headerY) <= epsilon) {
                                    detectedHeaders.add(header);

                                    if (banksToIncludeHeadersInMultipleLines.includes(bankName)) {
                                        if (!headerPositionsByPage[currentPage].hasOwnProperty(header)) {
                                            headerPositionsByPage[currentPage][header] = item.x;
                                        }
                                    } else {
                                        headerPositionsByPage[currentPage][header] = item.x;
                                    }
                                }
                            }
                        }

                        // Check if all headers in the set are detected
                        if (!headersFound && (detectedHeaders.size === headerSet.length && headerSet.every(h => detectedHeaders.has(h)))) {
                            if (headerPositionsByPage[currentPage]['Balance']) {
                                const debitX = headerPositionsByPage[currentPage]['Debit'];
                                const estimatedGap = (headerPositionsByPage[currentPage]['Balance'] - debitX) / 3;
                                const creditX = debitX + estimatedGap;
                                headerPositionsByPage[currentPage]['Credit'] = creditX;
                            }

                            for (const header of headerSet) {
                                alignments[header] = detectAlignmentFromText(header);
                            }
                            headersFound = true;
                            isAfterTable = false;
                            tableEndY = null;
                            isParitalHeader = true;
                            console.log(`Headers detected on Page ${currentPage} using parital format:`, headerSet);
                            requiredHeaders = headerSet;
                            break;
                        }
                    }
                }
                for (const headerSet of headerVariants) {
                    if (headerSet.includes(decodedText.trim())) {
                        // console.log(headerSet);
                        // console.log(decodedText.trim());
                        if (banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && !isFirstHeaderDetected && headerY && (headerYForBank[bankName].includes(decodedText.trim()))) {
                            headerY = null;
                            detectedHeaders.clear();
                            headerPositionsByPage[currentPage] = {};
                        }
                        if (headerY === null) {
                            if (banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && sbifirstHeaders.includes(decodedText.trim())) {
                                isFirstHeaderDetected = true;
                            }
                            headerY = item.y; // First header detected
                            // console.log(headerY);
                        }

                        if (Math.abs(item.y - headerY) <= epsilon) {
                            detectedHeaders.add(decodedText.trim());
                            if (banksToIncludeHeadersInMultipleLines.includes(bankName)) {
                                if (!headerPositionsByPage[currentPage].hasOwnProperty(decodedText.trim())) {
                                    headerPositionsByPage[currentPage][decodedText.trim()] = item.x;
                                }
                            } else {
                                headerPositionsByPage[currentPage][decodedText.trim()] = item.x;
                            }
                        }

                        // If we've matched all headers in this variant, mark it as found
                        if (!headersFound && (detectedHeaders.size === headerSet.length && headerSet.every(header => detectedHeaders.has(header)))) {
                            for (const header of headerSet) {
                                // console.log(header);
                                alignments[header] = detectAlignmentFromText(header);
                            }
                            headersFound = true;
                            isAfterTable = false;
                            tableEndY = null;
                            console.log(`Headers detected on Page ${currentPage} using normal format:`, headerSet);
                            requiredHeaders = headerSet;
                            break; // Exit once a matching format is found
                        }
                    }
                }
                if (!isHorizontalLineDetected) {
                    isHorizontalLineDetected = isHorizontalLine(decodedText);
                }

                // Identify the end of the table when "Details of statement" is detected
                // Detect if decodedText matches the end marker
                const isTableEnd = isAFuzzyLogic ? matchesEndMarkerUsingFuzzyLogic(bankName, decodedText) : matchesEndMarker(bankName, decodedText);
                if (isTableEnd && tableEndY === null) {
                    tableEndY = item.y;
                    tableEndYByPage[currentPage] = tableEndY;
                    isAfterTable = true; // Set the flag to ignore content after this point
                    console.log(`Page ${currentPage}: Table End Y = ${tableEndY}`);
                }

                // Skip rows if we are after the table
                if (isAfterTable) {
                    // console.log(`Ignoring text after table: "${decodedText}"`);
                    return; // Skip this row
                }

                // Add rows that are valid table rows
                if (banksToIncludeHeadernWithEpsilionVaration.includes(bankName)) {
                    if (
                        headersFound &&
                        item.y > headerY + epsilon// Rows must be below headers
                    ) {
                        tableDataByPage[currentPage].push({
                            text: decodedText,
                            x: item.x,
                            y: item.y,
                        });
                    }
                } else {
                    if (
                        headersFound &&
                        item.y > headerY // Rows must be below headers
                    ) {
                        tableDataByPage[currentPage].push({
                            text: decodedText,
                            x: item.x,
                            y: item.y,
                        });
                    }
                }
                if (bankshasHeadersInOnePage.includes(bankName)) {

                    rawItemsByPage[currentPage].push({
                        text: decodedText,
                        x: item.x,
                        y: item.y,
                    });
                }
            }
        });
        function matchesEndMarker(bankName, decodedText) {
            const markers = bankEndMarkers[bankName] || [];
            return markers.some((marker) => {
                return typeof marker === 'string'
                    ? decodedText.trim().toLowerCase() === marker.toLowerCase()
                    : marker.test(decodedText.trim());
            });
        }
        function matchesEndMarkerUsingFuzzyLogic(bankName, decodedText) {
            const markers = bankEndMarkers[bankName] || [];
            const cleanedText = decodedText.trim().toLowerCase();

            return markers.some(marker => {
                if (typeof marker === 'string') {
                    return cleanedText.includes(marker.toLowerCase());
                }
                return marker.test(decodedText);
            });
        }


        function combineDateFragments(rows) {
            const combined = [];
            let skipNext = false;

            for (let i = 0; i < rows.length - 1; i++) {
                if (skipNext) {
                    skipNext = false;
                    continue;
                }

                const current = rows[i];
                const next = rows[i + 1];

                const isDatePair =
                    Math.abs(current.y - next.y) <= 1.0 &&
                    Math.abs(current.x - next.x) <= 3.5 && // adjusted x spread tolerance
                    /\d{1,2}\s\w{3}/.test(current.text) && // matches "14 Apr"
                    /^\d{4}$/.test(next.text);             // matches "2024"

                if (isDatePair) {
                    combined.push({
                        text: `${current.text} ${next.text}`,
                        x: current.x,
                        y: Math.max(current.y, next.y)
                    });
                    skipNext = true; // skip next item since it's already merged
                } else {
                    combined.push(current);
                }
            }

            // Push the last item if not merged
            if (!skipNext && rows.length > 0) {
                combined.push(rows[rows.length - 1]);
            }

            return combined;
        }

        function combineWrappedAmounts(rows) {
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
        }

        function getCarryForwardFragments(headerXMap, parsedRowsOnNextPage) {
            // Find the header key with the smallest x-coordinate
            const smallestXHeader = Object.entries(headerXMap).reduce((acc, [key, x]) => {
                return x < acc.x ? { key, x } : acc;
            }, { key: null, x: Infinity });

            const firstHeaderX = smallestXHeader.x;

            // Determine where the next transaction begins based on smallest x-header
            const startOfNextTxnY = Math.min(
                ...parsedRowsOnNextPage
                    .filter(item => item.x === firstHeaderX)
                    .map(item => item.y)
            );

            // Filter rows above that threshold — likely wrapped description/ref
            return parsedRowsOnNextPage.filter(item => item.y < startOfNextTxnY);
        }
        function normalizeBankPDF(pageRows, bankName, userId, financialYear) {
            const normalized = [];

            for (const row of pageRows) {
                normalized.push(normalizeTransactionRow(row, bankName, userId, financialYear));
            }

            return normalized;
        }

        function generateReference(input) {
            return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
        }

        function normalizeTransactionRow(row, bankName, userId, financialYear) {
            const keys = Object.keys(row);
            const lowerMap = Object.fromEntries(keys.map(k => [k.toLowerCase(), k]));

            const rawDate = row[lowerMap['date']] || row[lowerMap['value date']] || row[lowerMap['txn date']] || row[lowerMap['transaction']] || row[lowerMap['value']] || row[lowerMap['trans date and']] || row[lowerMap['tran date']] || '';
            const formattedDate = standardizeDate(rawDate);
            // console.log(rawDate, formattedDate);

            const rawDebit = row[lowerMap['debit']] || row[lowerMap['debits']] || row[lowerMap['withdrawal']] || row[lowerMap['withdrawals']] || row[lowerMap['withdrawals(rs.)']] || row[lowerMap['withdra']] || row[lowerMap['withdrawl']] || (row[lowerMap['amount(rs.)']]?.includes('Dr') ? row[lowerMap['amount(rs.)']] : '');
            const rawCredit = row[lowerMap['credit']] || row[lowerMap['credits']] || row[lowerMap['deposit']] || row[lowerMap['deposits']] || row[lowerMap['deposits(rs.)']] || (row[lowerMap['amount(rs.)']]?.includes('Cr') ? row[lowerMap['amount(rs.)']] : '');

            const debit = cleanAmount(rawDebit);
            const credit = cleanAmount(rawCredit);
            // Mutual exclusion rule
            const finalDebit = debit !== '0.00' ? debit : '0.00';
            const finalCredit = credit !== '0.00' ? credit : '0.00';

            const balanceRaw = row[lowerMap['balance']] || row[lowerMap['balance(rs.)']] || row[lowerMap['balancer']] || row[lowerMap['available bal.']] || '';
            const balance = balanceRaw ? cleanAmount(balanceRaw) : '0.00';

            // let reference = row[lowerMap['transaction id']] || row[lowerMap['ref no./cheque']] || row[lowerMap['ref/cheque']] || row[lowerMap['cheque no']] || row[lowerMap['cheque no.']] || row[lowerMap['cheque']] || row[lowerMap['chq no']] || row[lowerMap['chq./ref.no.']] || row[lowerMap['chq-no']] || row[lowerMap['id']] || '';

            const description = row[lowerMap['remarks']] || row[lowerMap['description']] || row[lowerMap['narration']] || row[lowerMap['particulars']] || row[lowerMap['transaction details']] || row[lowerMap['details']] || row[lowerMap['account description']] || '';

            const finalAmount = finalDebit !== '0.00' ? finalDebit : finalCredit;
            const fingerprint = `${formattedDate}|${description.trim()}|${finalAmount}`;
            const scopedInput = `${bankName}|${userId}|${financialYear}|${fingerprint}`;
            const reference = generateReference(scopedInput).slice(0, 12);

            return {
                date: formattedDate,
                description,
                reference,
                debit: finalDebit,
                credit: finalCredit,
                balance
            };
        }

        function standardizeDate(dateStr = '') {
            const trimmed = dateStr.trim();

            // ✅ Match DD-MM-YYYY HH:MM:SS or DD/MM/YYYY HH:MM:SS
            const datetimeMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
            if (datetimeMatch) {
                const [_, dd, mm, yyyy] = datetimeMatch;
                const isoStr = `${yyyy}-${mm}-${dd}T${datetimeMatch[4]}:${datetimeMatch[5]}:${datetimeMatch[6]}`;
                const parsed = new Date(isoStr);
                if (!isNaN(parsed)) {
                    return `${dd}/${mm}/${yyyy}`;
                }
            }

            // Match DD-MM-YYYY or DD/MM/YYYY
            const ddmmyyyyMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
            if (ddmmyyyyMatch) {
                const [_, dd, mm, yyyy] = ddmmyyyyMatch;
                const isoStr = `${yyyy}-${mm}-${dd}`; // ISO-compatible format
                const parsed = new Date(isoStr);
                if (!isNaN(parsed)) {
                    return `${dd}/${mm}/${yyyy}`;
                }
            }

            // ✅ Match DD-MM-YY or DD/MM/YY
            const ddmmyyMatch = trimmed.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{2})$/);
            if (ddmmyyMatch) {
                const [_, dd, mm, yy] = ddmmyyMatch;
                const yyyy = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`; // Adjust century logic if needed
                const isoStr = `${yyyy}-${mm}-${dd}`;
                const parsed = new Date(isoStr);
                if (!isNaN(parsed)) {
                    return `${dd}/${mm}/${yyyy}`;
                }
            }

            // Continue with known formats...
            const knownFormats = [
                { regex: /^\d{2}-[A-Za-z]{3}-\d{4}$/, format: 'DD/MMM/YYYY' },
                { regex: /^[A-Za-z]{3} \d{2} \d{4}$/, format: 'MMM DD YYYY' },
                { regex: /^\d{2}\/[A-Za-z]{3}\/\d{4}$/, format: 'DD/MMM/YYYY' },
                { regex: /^\d{2}-[A-Z]{3}-\d{4}$/, format: 'DD/MMM/YYYY' },
                { regex: /^\d{2} [A-Za-z]{3} \d{4}$/, format: 'DD/MMM/YYYY' },
                { regex: /^[A-Za-z]{3} \d{1,2} \d{4}$/, format: 'MMM DD YYYY' }
            ];

            for (const { regex } of knownFormats) {
                if (regex.test(trimmed)) {
                    const normalized = new Date(trimmed.replace(/-/g, '/').replace(/ +/g, ' '));
                    if (!isNaN(normalized)) {
                        const dd = String(normalized.getDate()).padStart(2, '0');
                        const mm = String(normalized.getMonth() + 1).padStart(2, '0');
                        const yyyy = normalized.getFullYear();
                        return `${dd}/${mm}/${yyyy}`;
                    }
                }
            }

            // Final fallback
            const loose = new Date(trimmed);
            if (!isNaN(loose)) {
                const dd = String(loose.getDate()).padStart(2, '0');
                const mm = String(loose.getMonth() + 1).padStart(2, '0');
                const yyyy = loose.getFullYear();
                return `${dd}/${mm}/${yyyy}`;
            }

            return trimmed;
        }


        function cleanAmount(value = '') {
            const cleaned = value.replace(/₹|INR|\(|\)|Cr|CR|Dr|DR|-|,/gi, '').trim();
            return cleaned && !isNaN(cleaned) ? cleaned : '0.00';
        }

        function isHorizontalLine(text) {
            // Matches lines with 10 or more dashes or spaces
            const pattern = /^[-\s]{10,}$/;
            return pattern.test(text);
        }

        function parseDataRows(mergedLines, headerXMap, headers) {
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

        }

        const parseStructuredRows = (groupByY, headerXMap, epsilon = 0.01) => {
            const positionedItems = [];

            const isDate = str => /^\d{2}-\d{2}-\d{2}$/.test(str.trim());
            const isAmount = str => /^[\d,]+\.\d{2}$/.test(str.trim());
            const isBalance = str => /^[\d,]+\.\d{2}(Cr|Dr)$/.test(str.trim());

            const sortedYKeys = Object.keys(groupByY)
                .sort((a, b) => parseFloat(a) - parseFloat(b));

            for (const yStr of sortedYKeys) {
                const items = groupByY[yStr];

                if (!items || items.length === 0) continue;

                // ✅ Skip entire row if any item contains "B/F"
                const hasBF = items.some(item => /B\/F/i.test(item.text));
                if (hasBF) continue;

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
                    if (tokens[i]) {
                        positionedItems.push({ text: tokens[i], x: headerXMap['PARTICULARS'], y: yStr });
                        i++;
                    }

                    // Try to detect CHQ.NO. and WITHDRAWALS adaptively
                    if (tokens[i] && isAmount(tokens[i])) {
                        // CHQ.NO. is missing, this is WITHDRAWALS
                        positionedItems.push({ text: tokens[i], x: headerXMap['WITHDRAWALS'], y: yStr });
                        i++;
                    } else {
                        // CHQ.NO. might be present
                        if (tokens[i]) {
                            positionedItems.push({ text: tokens[i], x: headerXMap['CHQ.NO.'], y: yStr });
                            i++;
                        }
                        if (tokens[i] && isAmount(tokens[i])) {
                            positionedItems.push({ text: tokens[i], x: headerXMap['WITHDRAWALS'], y: yStr });
                            i++;
                        }
                    }
                    if (secondItem) {
                        const secondTokens = secondItem.text.trim().split(/\s+/);
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

        function cleanParticularsField(rows, headerXMap) {
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
        }

        function extractcarryForwardedParticulars(mergedLines, headerXMap) {
            const allRows = [];

            for (const [y, line] of Object.entries(mergedLines)) {
                if (!line.includes('|')) {
                    const text = line.trim();
                    if (text) {
                        const x = headerXMap['PARTICULARS'];
                        allRows.push([{ text, x, y: parseFloat(y) }]);
                    }
                } else {
                    break; // Stop scanning once structured data starts
                }
            }

            return cleanParticularsField(allRows, headerXMap);
        }

    });
};

const extractTableFromBufferForTrailBalance = (fileStream) => {
    return new Promise((resolve, reject) => {
        let tableDataByPage = [];
        let currentPage = 0;
        const pageDataByPage = {}; // ✅ Store extracted text grouped by page
        let insideTable = false;
        let tableEnded = false;
        let accumulatedRows = [];
        let lastKnownGroup = null; // ✅ Persist last group across pages
        const state = { currentGroup: null, groupsWithoutTotal: new Set() };

        console.log("Starting PDF Processing...");

        new PdfReader().parseBuffer(fileStream, (err, item) => {
            if (err) {
                console.error("Error reading PDF:", err);
                return reject(err);
            }

            if (!item) {
                console.log("Finished processing PDF.");
                // ✅ Process stored pages only after parsing completes
                Object.keys(pageDataByPage).forEach(pageNum => {
                    processExtractedText(pageDataByPage[pageNum], accumulatedRows, pageNum, state);
                });
                return resolve(denormalizeGroupedData(mergeAccountsInGroups(tableDataByPage)));
            }
            if (item.page) {
                insideTable = accumulatedRows.length > 0 || insideTable;
                tableEnded = tableEnded || false;
                currentPage = item.page;
                // console.log(`Processing Page: ${currentPage}`);

                // ✅ Ensure each page has its own storage
                if (!pageDataByPage[currentPage]) {
                    pageDataByPage[currentPage] = [];
                }
            }
            else if (item.text) {
                let decodedText;
                try {
                    decodedText = decodeURIComponent(item.text);
                } catch (e) {
                    decodedText = item.text; // fallback to raw string if decoding fails
                    console.warn(`⚠ Skipped malformed URI: "${item.text}"`);
                }

                pageDataByPage[currentPage].push({ text: decodedText, x: item.x, y: item.y });
            }
        });

        function processExtractedText(pageExtractedText, accumulatedRows, pageNum, state) {
            const filteredRows = removeTableBorders(pageExtractedText);
            // console.log(filteredRows)
            const groupedRows = groupRowsByY(filteredRows);
            // console.log(groupedRows);

            const detectedHeader = detectPerRowHeader(groupedRows);
            if (detectedHeader.length === 0) return;
            console.log(`Processing Page: ${pageNum}, Detected Header: ${detectedHeader}`);


            // ✅ Extract header row Y-coordinate
            const headerRowY = extractHeaderRowY(groupedRows, detectedHeader);

            // console.log(`✅ Detected Header y position:`, headerRowY);

            if (!headerRowY) return;

            // ✅ Extract full header row based on detected Y-coordinate
            const headerRow = extractHeaderRow(filteredRows, headerRowY);

            // console.log(`✅ Detected Header row:`, headerRow);

            // ✅ Extract X-positions for headers
            const headerPositions = extractHeaderPositions(headerRow, detectedHeader);
            // console.log(`✅ Header Positions:`, headerPositions);

            const filteredTableRows = filterTableRows(groupedRows, detectedHeader);
            accumulatedRows.push(...filteredTableRows);

            // ✅ Detect if the table has explicit field separators
            const hasFieldSeparators = filteredTableRows.some(row => row.text.includes(" | "));

            const groupedByYAxis = filterRelevantRows(groupedRows, detectedHeader);
            // console.log(hasFieldSeparators);
            // console.log(groupedByYAxis);
            const formattedRows = hasFieldSeparators
                ? associateAccountsToGroups(tableDataByPage, convertToJSON(detectedHeader, formatRowsWithSeparator(accumulatedRows)), groupedRows)  // ✅ Use existing separator logic
                : groupAccounts(tableDataByPage, groupedByYAxis, filteredRows, headerPositions, state); // ✅ Use X-mapping logic
            // console.log(JSON.stringify(formattedRows, null, 2));

            tableDataByPage = formattedRows;

            accumulatedRows.length = 0; // ✅ Clear accumulated rows efficiently
            tableEnded = false; // ✅ Reset flag properly
        }

        function groupRowsByY(filteredRows) {
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
        }

        function filterTableRows(groupedRows, detectedHeader) {
            return groupedRows.filter(row => {
                const rowTextLower = row.text.toLowerCase(); // ✅ Convert row text to lowercase

                if (rowTextLower.includes("dos2usb") || rowTextLower.includes("b/f.") || rowTextLower.includes("group total") || rowTextLower.includes("end of report.")) return false; // ✅ Case-insensitive filter

                if (!insideTable && detectedHeader.every(header => rowTextLower.includes(header))) {
                    insideTable = true;
                    tableEnded = false;
                    return false; // ✅ Skip header row itself
                }

                if (insideTable && (rowTextLower.includes("total") || rowTextLower.includes("totals"))) {
                    tableEnded = true;
                    insideTable = false;
                }

                return insideTable && !tableEnded;
            });
        }

        function formatRowsWithSeparator(accumulatedRows) {
            return accumulatedRows.map(row => {
                const cleanedText = normalizeRowText(row.text);
                return cleanedText.split(" | ").map(col => col.trim());
            }).filter(row => row.some(col => col.length > 0 && col.replace(/\|/g, "").trim().length > 0));
        }

        function convertToJSON(headers, formattedRows) {
            return formattedRows.map(row => {
                const rowJson = {};
                headers.forEach((header, index) => rowJson[header.replace(/\s+/g, "_")] = row[index] || "");
                return rowJson;
            });
        }

        function mergeAccountsInGroups(tableDataByPage) {
            return tableDataByPage.map(group => {
                const accountMap = new Map();

                group.account_list.forEach(account => {
                    const accountKey = account.account_name.toLowerCase().trim();

                    if (!accountMap.has(accountKey)) {
                        accountMap.set(accountKey, {
                            account_name: account.account_name,
                            place: account.place || "",
                            debit_amount: account.debit_amount ? parseFloat(account.debit_amount.replace(/,/g, "")) : 0,
                            credit_amount: account.credit_amount ? parseFloat(account.credit_amount.replace(/,/g, "")) : 0
                        });
                    } else {
                        const existing = accountMap.get(accountKey);

                        if (account.debit_amount) {
                            existing.debit_amount += parseFloat(account.debit_amount.replace(/,/g, "")) || 0;
                        }

                        if (account.credit_amount) {
                            existing.credit_amount += parseFloat(account.credit_amount.replace(/,/g, "")) || 0;
                        }
                    }
                });

                // ✅ Replace with merged account list
                group.account_list = Array.from(accountMap.values());

                return group;
            });
        }

        function denormalizeGroupedData(tableDataByPage) {
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
        }

        function normalizeRowText(text) {
            return text
                .replace(/[^\w\s|.:&\-\(\)]/g, '')
                .replace(/^\s*\|\s*/, "")
                .replace(/\s*\|\s*$/, "")
                .replace(/\s*\|\s*/g, " | ")
                .replace(/\|{2,}/g, " | ")
                .trim();
        }

        function extractHeaderPositions(headerRow, detectedHeader) {
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
        }

        function filterRelevantRows(groupedRows, detectedHeader) {
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

        }

        function isMeaningfulRow(text) {
            const cleaned = text.replace(/[^\w\s|.:-]/g, "").trim();
            return cleaned.length > 0;
        }


        function groupAccounts(groupedData, groupedRows, filteredRows, headerPositions, state, tolerance = 0.01) {
            let { currentGroup, groupsWithoutTotal } = state;
            // console.log(currentGroup);
            // console.log(JSON.stringify(groupedData, null, 2));
            // console.log(groupsWithoutTotal);

            let groupedDataWithoutTotal = groupedData.filter(group => groupsWithoutTotal.has(group.group_name));


            // ✅ Remove all unfinalized groups before reprocessing on next page
            if (groupsWithoutTotal.size > 0) {
                groupedData = groupedData.filter(group => !groupsWithoutTotal.has(group.group_name));
            }

            // console.log(JSON.stringify(groupedData, null, 2));
            // console.log(groupedRows);
            // console.log(filteredRows);


            groupedRows.forEach(row => {
                if (row.text.toLowerCase().includes("group total")) {
                    // ✅ Finalizing group when "Group Total" is found
                    if (currentGroup) {
                        const parts = row.text.split(":")[1].trim().split(" ");
                        currentGroup.group_total = parts[0];
                        currentGroup.isCredit = parts.includes("Cr");
                        currentGroup.isDebit = parts.includes("Dr");
                        groupedData.push(currentGroup);
                        // ✅ Remove finalized group AND associated accounts from `groupsWithoutTotal`
                        groupsWithoutTotal.delete(currentGroup.group_name);
                        currentGroup.account_list.forEach(acc => groupsWithoutTotal.delete(acc.account_name));

                    }
                    currentGroup = null;
                } else if (!currentGroup) {
                    // ✅ New group detected
                    currentGroup = { group_name: row.text, account_list: [] };
                    // console.log(row.text, row.y);
                    groupsWithoutTotal.add(row.text);

                } else {
                    // ✅ Extract account details using filteredRows with tolerance matching
                    let credit_amount = "0";
                    let debit_amount = "0";
                    let account_name = row.text;
                    // console.log(row.text, row.y);

                    // ✅ Find matching words within a **small Y-axis tolerance**
                    const rowWords = filteredRows.filter(word => Math.abs(word.y - row.y) <= tolerance);
                    // console.log(rowWords);

                    // ✅ Extract account name (only words appearing before credit header position)
                    account_name = rowWords.filter(word => word.x < headerPositions["credit amount"])
                        .map(word => word.text)
                        .join(" ");

                    // ✅ Get remaining words as potential amounts
                    const amountWords = rowWords.filter(word => word.x >= headerPositions["credit amount"])
                        .map(word => word.text);

                    if (amountWords.length === 2) {
                        // ✅ If two amounts are present → First is Credit, Second is Debit
                        credit_amount = amountWords[0];
                        debit_amount = amountWords[1];
                    } else if (amountWords.length === 1) {
                        // ✅ If only one amount exists → Assign based on proximity
                        const textX = rowWords.find(word => word.text === amountWords[0]).x;
                        const distanceToCredit = Math.abs(textX - headerPositions["credit amount"]);
                        const distanceToDebit = Math.abs(textX - headerPositions["debit amount"]);

                        if (distanceToCredit < distanceToDebit) {
                            credit_amount = amountWords[0];
                        } else {
                            debit_amount = amountWords[0];
                        }
                    }

                    currentGroup.account_list.push({
                        account_name,
                        credit_amount,
                        debit_amount
                    });
                    groupsWithoutTotal.add(account_name); // ✅ Ensure accounts are tracked

                }
            });

            // ✅ Handle groups without "Group Total"
            groupedData.forEach(group => {
                // console.log(group);
                if (!group.group_total) { // ✅ Group missing "Group Total"
                    let creditSum = 0, debitSum = 0;

                    group.account_list.forEach(acc => {
                        creditSum += parseFloat(acc.credit_amount.replace(/,/g, "")) || 0;
                        debitSum += parseFloat(acc.debit_amount.replace(/,/g, "")) || 0;
                    });

                    // ✅ Assign correct total based on highest sum
                    group.group_total = (creditSum > debitSum ? creditSum : debitSum).toLocaleString("en-IN"); // Indian formatting
                    group.isCredit = creditSum > debitSum;
                    group.isDebit = debitSum > creditSum;
                }
            });
            // const trailBalanceContinues = isTrailBalanceContinuing(pageNum, pageDataByPage);
            state.currentGroup = currentGroup;
            // ✅ Normalize group names before persisting to state
            const normalizedGroupsWithoutTotal = new Set(
                [...groupsWithoutTotal].map(name =>
                    name.replace(/\d+[\d,.]*/g, "").trim()
                )
            );

            state.groupsWithoutTotal = normalizedGroupsWithoutTotal;

            // ✅ Clean up `groupsWithoutTotal` by removing any numeric amounts in the group name
            const cleanedGroups = new Set([...groupsWithoutTotal].map(groupName => {
                return groupName.replace(/\d+[\d,.]*/g, "").trim(); // ✅ Remove numbers from the group name
            }));

            if (groupsWithoutTotal.size > 0) {
                groupedDataWithoutTotal = groupedDataWithoutTotal.filter(group => groupsWithoutTotal.has(group.group_name));
            }

            // ✅ Add any missing groups from cleanedGroups
            cleanedGroups.forEach(groupName => {
                const alreadyExists = groupedDataWithoutTotal.some(group => group.group_name === groupName);

                if (!alreadyExists) {
                    groupedData.push({
                        group_name: groupName,
                        group_total: "Missing",
                        account_list: [],
                        isCredit: false,
                        isDebit: false
                    });
                }
            });

            // ✅ Append all existing groupedDataWithoutTotal entries
            groupedData.push(...groupedDataWithoutTotal);

            // console.log(cleanedGroups);
            // console.log(JSON.stringify(groupedData, null, 2));
            groupedData = processGroupsWithoutTotal(groupedData, groupedRows, filteredRows, headerPositions);
            return groupedData;

        }

        function processGroupsWithoutTotal(groupedData, groupedRows, filteredRows, headerPositions, tolerance = 0.01) {
            groupedData.forEach(group => {
                if (group.group_total === "Missing") {
                    let creditSum = 0, debitSum = 0;

                    // ✅ Locate all rows related to this group and sum amounts
                    groupedRows.forEach(row => {
                        if (row.text.includes(group.group_name)) {
                            const rowWords = filteredRows.filter(word => Math.abs(word.y - row.y) <= tolerance);

                            const amountWords = rowWords.filter(word => word.x >= headerPositions["credit amount"])
                                .map(word => word.text);

                            if (amountWords.length === 2) {
                                creditSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                                debitSum += parseFloat(amountWords[1].replace(/,/g, "")) || 0;
                            } else if (amountWords.length === 1) {
                                const textX = rowWords.find(word => word.text === amountWords[0]).x;
                                const distanceToCredit = Math.abs(textX - headerPositions["credit amount"]);
                                const distanceToDebit = Math.abs(textX - headerPositions["debit amount"]);

                                if (distanceToCredit < distanceToDebit) {
                                    creditSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                                } else {
                                    debitSum += parseFloat(amountWords[0].replace(/,/g, "")) || 0;
                                }
                            }
                        }
                    });

                    // ✅ Assign correct total based on highest sum
                    group.group_total = (creditSum > debitSum ? creditSum : debitSum).toLocaleString("en-IN");
                    group.isCredit = creditSum > debitSum;
                    group.isDebit = debitSum > creditSum;
                }
            });
            // console.log(JSON.stringify(groupedData, null, 2));


            return groupedData;
        }

        function associateAccountsToGroups(groupedData, accountData, groupedRows) {
            // console.log(groupedData);
            // console.log(accountData);
            // console.log(groupedRows);
            let transitionY = null;

            const cleanGroups = groupedRows.map(row => ({
                group_name: row.text.replace(/AS ON \d{2}[.-]\d{2}[.-]\d{4}/gi, "").trim().toLowerCase(),
                y_position: row.y
            }));

            // console.log(cleanGroups);

            // ✅ Find the first Y-position where a new group starts

            groupedData.forEach(group => {
                const matchedGroup = cleanGroups.find(g => g.group_name.toLowerCase() === group.group_name.toLowerCase());

                if (matchedGroup) {
                    transitionY = matchedGroup.y_position; // ✅ Assign transitionY correctly
                }
            });
            // console.log(transitionY);

            // ✅ Extract account names appearing **before** transitionY (belong to old group)
            const oldGroupAccounts = groupedRows
                .filter(row => transitionY && row.y < transitionY)
                .map(row => row.text.trim().toLowerCase());

            // console.log(oldGroupAccounts);

            const accountsForPreviousGroup = accountData.filter(acc => {

                const matchFound = oldGroupAccounts.some(account => {
                    const cleanedAccount = extractAccountName(account);
                    return cleanedAccount.includes(acc.account_name.toLowerCase());
                });

                // console.log("Checking:", acc.account_name);
                // console.log("Is in oldGroupAccounts?:", matchFound);

                return matchFound;
            });

            // console.log(accountsForPreviousGroup);

            if (accountsForPreviousGroup.length > 0) {
                // ✅ Assign previous group's accounts
                groupedData.forEach(group => {
                    if (lastKnownGroup === group.group_name) {
                        group.account_list.push(...accountsForPreviousGroup);
                    }
                });

                // ✅ Assign remaining accounts to the correct new group
                const remainingAccounts = accountData.filter(acc => !accountsForPreviousGroup.includes(acc));
                // console.log(remainingAccounts);

                groupedData.forEach(group => {
                    if (cleanGroups.some(g => g.group_name === group.group_name.toLowerCase())) {
                        group.account_list.push(...remainingAccounts);
                        lastKnownGroup = group.group_name;
                    }
                });
            } else {
                groupedData.forEach(group => {
                    if (cleanGroups.some(g => g.group_name === group.group_name.toLowerCase())) {
                        group.account_list.push(...accountData);
                        lastKnownGroup = group.group_name;
                    }
                });
            }

            return groupedData;
        }

        // ✅ Function to extract the Y-coordinate of the header row
        function extractHeaderRowY(groupedRows, detectedHeader) {
            return groupedRows.find(row =>
                detectedHeader.every(header => row.text.toLowerCase().includes(header.toLowerCase()))
            )?.y || null; // ✅ Returns Y-coordinate or null if not found
        }

        // ✅ Function to extract header row from filteredRows using detected Y-coordinate

        function extractHeaderRow(filteredRows, headerRowY, tolerance = 0.01) {
            return filteredRows.filter(row => Math.abs(row.y - headerRowY) <= tolerance);
        }

        function extractAccountName(rowText) {
            const cleanedText = normalizeRowText(rowText);
            const columns = cleanedText.includes(" | ")
                ? cleanedText.split(" | ").map(col => col.trim())
                : [cleanedText.trim()];

            // console.log("Original row:", rowText);
            // console.log("Cleaned text:", cleanedText);
            // console.log("Extracted account name:", columns[0]);

            return columns[0];  // ✅ Return only the first column as the account name
        }
    });
};

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

const cleanTableRow = (text) => {
    return text
        .replace(/[│─┬┼┌┐├┤└┘═]+/g, '')  // ✅ Remove decorative borders
        // .replace(/^\||\|$/g, '')        // ✅ Strip leading & trailing pipes
        // .replace(/\s*\|\s*\|\s*/g, ' | ') // ✅ Convert "||" into a proper separator
        .trim();
};

const mergeGroupedText = (groupedByY) => {
    const mergedLines = {};

    for (const [yKey, items] of Object.entries(groupedByY)) {
        const mergedText = items.map(item => item.text).join('');
        mergedLines[yKey] = mergedText;
    }

    return mergedLines;
};

const detectHeaderLine = (lines, headerVariants) => {
    for (const headerSet of headerVariants) {
        for (const [y, text] of Object.entries(lines)) {
            if (headerSet.every(kw => text.includes(kw))) {
                return { y, text };
            }
        }
    }
    return null;
};


const estimateHeaderXMap = (headerText, baseX = 0, charWidth = 1) => {
    const segments = headerText.split('|');
    const headerXMap = {};
    let cursor = 0;

    for (const segment of segments) {
        const header = segment.trim();
        if (header) {
            const x = baseX + cursor * charWidth;
            headerXMap[header] = x;
        }
        cursor += segment.length + 1; // +1 for the pipe
    }

    return headerXMap;
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

const removeTableBorders = (rows) => {
    return rows.map(row => ({
        text: cleanTableRow(row.text),
        y: row.y,
        x: row.x
    })).filter(row => row.text.length > 0); // ✅ Ensure empty rows are discarded
};

// Group records by Transaction Id
const groupRecordsByTransactionId = (tableDataByPage) => {
    const groupedRecords = {};

    // Flatten page-wise data and group by Transaction Id
    Object.values(tableDataByPage).flat().forEach((row) => {
        const transactionId = row["reference"];
        if (!groupedRecords[transactionId]) {
            groupedRecords[transactionId] = [];
        }
        groupedRecords[transactionId].push(row);
    });

    return groupedRecords;
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

// Function to combine multi-line rows
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

const estimateHeaderPositions = (startX, headers) => {
    const positions = {};
    let currentX = startX;

    for (const header of headers) {
        positions[header] = currentX;

        // Artificial stretch for 'Details'
        const stretchFactor = header === 'Details' ? 3 : 1;
        currentX += header.length * stretchFactor; // 0.5 is assumed char width
    }

    return positions;
};


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

const filterValidGroups = (groupedByY, expectedHeaders) => {
    let skipMode = false;
    const validGroups = {};

    const isHeaderGroup = group => {
        const combinedText = group.map(({ text }) => text.trim()).join(' ').replace(/\s+/g, ' ').toUpperCase();
        return expectedHeaders.every(header => combinedText.includes(header));
    };

    for (const [yKey, group] of Object.entries(groupedByY)) {
        if (!skipMode) {
            const containsCumulativeTotals = group.some(({ text }) =>
                /Cumulative Totals:/i.test(text.trim())
            );

            if (containsCumulativeTotals) {
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


const extractPreviousBalance = (groupedByY) => {
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

const updateGroupsWithChequeNo = (groupedByY, headerXMap) => {
    Object.entries(groupedByY).forEach(([yKey, items]) => {
        const yFloat = parseFloat(yKey);

        for (const item of items) {
            const match = item.text.match(/CHQ\s*NO\s*(.+)/i);
            if (match && match[1]) {
                groupedByY[yKey].push({
                    text: match[1].trim(),
                    x: headerXMap["CHEQUE NO"],
                    y: yFloat
                });
                break; // Add only one Cheque No per row
            }
        }
    });
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
const cleanChequeNoFromAmount = (groupedByY, headerXMap, epsilon = 0.01) => {
    Object.entries(groupedByY).forEach(([yKey, items]) => {
        const yFloat = parseFloat(yKey);

        const chequeNoItem = items.find(i =>
            Math.abs(i.x - headerXMap["CHEQUE NO"]) < epsilon &&
            i.y === yFloat
        );

        if (!chequeNoItem) return;

        const chequeValue = chequeNoItem.text.trim();

        const amountItem = items.find(i =>
            i.y === yFloat &&
            (Math.abs(i.x - headerXMap["DEBIT"]) < epsilon || Math.abs(i.x - headerXMap["CREDIT"]) < epsilon) &&
            i.text.includes(chequeValue)
        );

        if (!amountItem) return;

        // Remove Cheque No fragment from amount field text
        const cleanedText = amountItem.text.replace(chequeValue, '').trim();

        amountItem.text = cleanedText;
    });
};

const detectAlignmentFromText = (text) => {
    const t = text.trim();

    if (/^(Debit|Credit|Balance|Amount|Withdrawal|Deposit|Instrument No)$/i.test(t)) return 'right'; // numerical columns
    if (/^(Date|Sr No|Remarks|Description)$/i.test(t)) return 'left'; // typical text fields
    if (/^[A-Z\s]+$/.test(t) && t.length < 20) return 'center'; // maybe labels

    return 'left'; // safe fallback
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

const estimatedDataWidth = (text, width) => {
    return text.trim().length * width;
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


const refineRefNoAndNarration = (
    item,
    narrationX,
    refNoX
) => {

    const isValidRefNo = text => {
        const cleaned = text.trim();
        return (
            /^\d{16}$/.test(cleaned) || // regular 16-digit Ref.No.
            /^[A-Z]{1,3}[A-Z\d]{13,15}$/.test(cleaned) || // 16-char alphanumeric with 1–3 letter prefix
            cleaned === "000000000000000" // special 15-digit all-zero override
        );
    };

    if (item.x === refNoX && !isValidRefNo(item.text)) {
        // Mis-snapped narration at Ref.No. position
        return { ...item, x: narrationX };
    }
    return item;
};

const refineChequeAndNarration = (
    item,
    narrationX,
    chequeX
) => {
    const isValidChequeNo = text => {
        const cleaned = text.trim();
        return /^\d{6}$/.test(cleaned); // 6-digit numeric cheque number
    };

    if (item.x === chequeX && !isValidChequeNo(item.text)) {
        // Mis-snapped narration at cheque position
        return { ...item, x: narrationX };
    }

    return item;
};

const refineBranchAndNarration = (
    item,
    narrationX,
    branchX
) => {
    const isValidBranchCode = text => {
        const cleaned = text.trim();
        return /^\d{4}$/.test(cleaned); // 4-digit numeric branch code
    };

    if (item.x === branchX && !isValidBranchCode(item.text)) {
        // Mis-snapped narration at branch position
        return { ...item, x: narrationX };
    }

    return item;
};


const refineTransactionIdAndRemarks = (item, narrationX, refNoX) => {
    const isValidRefNo = text => {
        const cleaned = text.trim();

        return (
            (cleaned.startsWith("S") && cleaned.length >= 6 && cleaned.length <= 9) ||
            (cleaned.startsWith("A") && cleaned.length >= 6 && cleaned.length <= 8)
        );
    };

    if (item.x === refNoX && !isValidRefNo(item.text)) {
        // Mis-snapped narration at Ref.No. position
        return { ...item, x: narrationX };
    }

    return item;
};


const refineDateAndParticulars = (
    item,
    ParticularsX,
    dateX
) => {
    const isValidDate = text =>
        /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(text.trim()); // e.g., 01-FEB-2025

    if (item.x === dateX && !isValidDate(item.text)) {
        // Mis-snapped narration or non-date at Date position
        return { ...item, x: ParticularsX };
    }

    return item;
};

function snapXCoordinate(items, sourceX, targetX, epsilon) {

    return items.map(item => {
        if (Math.abs(item.x - sourceX) < epsilon) {
            return { ...item, x: targetX };
        }
        return item;
    });
}


const refineValueDateAndParticulars = (
    item,
    ParticularsX,
    dateX
) => {
    const isValidDate = text =>
        /^\d{2}\/\d{2}\/\d{2}$/.test(text.trim()); // e.g., 01/02/2025

    if (item.x === dateX && !isValidDate(item.text)) {
        // Mis-snapped narration or non-date at Date position
        return { ...item, x: ParticularsX };
    }

    return item;
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


// Function to convert rows to JSON using headers
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

module.exports = { extractTableFromBufferForBankStatement, extractTableFromBufferForTrailBalance, groupRecordsByTransactionId };