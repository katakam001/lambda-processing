const { PdfReader } = require("pdfreader");

const extractTableFromBufferForBankStatement = buffer => {
    return new Promise((resolve, reject) => {
        const tableDataByPage = {};
        let currentPage = 0;
        let headersFound = false; // Track if all headers are found
        let headerY = null; // Y-coordinate of the header row
        let tableEndY = null;
        let isAfterTable = false; // Flag to ignore rows after "Details of statement"
        const epsilon = 0.1; // Tolerance for y-position comparison
        const requiredHeaders = ["S.No", "Date", "Transaction Id", "Remarks", "Amount(Rs.)", "Balance(Rs.)"];
        let detectedHeaders = new Set(); // Store detected headers for validation

        new PdfReader().parseBuffer(buffer, (err, item) => {
            if (err) {
                reject(err);
            } else if (!item) {
                // End of buffer - process and resolve table data
                const combinedTableData = {};
                Object.keys(tableDataByPage).forEach(page => {
                    // Combine multi-line rows for each page
                    const combinedRows = combineMultiLineRows(tableDataByPage[page]);
                    // console.log(combinedRows);

                    // Convert to JSON
                    const tableJSON = convertToJSONSimple(requiredHeaders, combinedRows);
                    // console.log(`Page ${page} Table Data:`, tableJSON);
                    combinedTableData[page] = tableJSON;
                });

                resolve(combinedTableData);
            } else if (item.page) {
                // New page detected
                currentPage = item.page;
                tableDataByPage[currentPage] = [];
                headersFound = false; // Reset header detection for the new page
                headerY = null;
                tableEndY = null;
                isAfterTable = false; // Reset the flag for the new page
                detectedHeaders.clear(); // Clear detected headers
            } else if (item.text) {
                const decodedText = decodeURIComponent(item.text);

                // Detect headers
                if (requiredHeaders.includes(decodedText)) {
                    if (headerY === null) {
                        headerY = item.y; // Set the first header's y-coordinate
                    }

                    // Add header if it's within the y tolerance
                    if (Math.abs(item.y - headerY) <= epsilon) {
                        detectedHeaders.add(decodedText);
                    }

                    // Check if all required headers are detected
                    if (detectedHeaders.size === requiredHeaders.length) {
                        headersFound = true;
                        isAfterTable = false; // Reset the flag when headers are found
                        console.log(`Headers detected on Page ${currentPage} at Y: ${headerY}`);
                    }
                }

                // Identify the end of the table when "Details of statement" is detected
                if (decodedText === "Details of statement" && tableEndY === null) {
                    tableEndY = item.y;
                    isAfterTable = true; // Set the flag to ignore content after this point
                    console.log(`Page ${currentPage}: Table End Y = ${tableEndY}`);
                }

                // Skip rows if we are after the table
                if (isAfterTable) {
                    // console.log(`Ignoring text after table: "${decodedText}"`);
                    return; // Skip this row
                }

                // Add rows that are valid table rows
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
        });
    });
};

const extractTableFromBufferForTrailBalance = (buffer) => {
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

        new PdfReader().parseBuffer(buffer, (err, item) => {
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
            } else if (item.text) {
                // console.log(decodeURIComponent(item.text), item.x, item.y);

                // ✅ Store extracted text by page before processing
                pageDataByPage[currentPage].push({ text: decodeURIComponent(item.text), x: item.x, y: item.y });
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

                if (rowTextLower.includes("dos2usb") || rowTextLower.includes("b/f.") || rowTextLower.includes("group total")) return false; // ✅ Case-insensitive filter

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
            // ✅ Identify header row index dynamically using `detectedHeader`
            const headerIndex = groupedRows.findIndex(row =>
                detectedHeader.every(header => row.text.toLowerCase().includes(header.toLowerCase()))
            );

            // ✅ Identify the **final** total row index (last occurrence of "Total :-")
            const totalIndex = groupedRows.map((row, index) => row.text.toLowerCase().includes("total :-") ? index : -1)
                .filter(index => index !== -1).pop(); // ✅ Gets the last occurrence

            if (headerIndex === -1) return []; // If header not found, return empty array
            const endIndex = totalIndex !== undefined ? totalIndex : groupedRows.length; // If "Total :-" missing, extract all rows

            return groupedRows.slice(headerIndex + 1, endIndex).filter(row => isMeaningfulRow(row.text));; // ✅ Extract relevant rows until the last Total row
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
        const transactionId = row["Transaction Id"];
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

// Function to convert rows to JSON using headers
const convertToJSONSimple = (headers, parsedRows) => {
    const result = [];
    let row = {}; // Temporary row object
    let columnIndex = 0; // Track the current column index

    parsedRows.forEach((item, index) => {
        // Map the current text to the appropriate column header
        row[headers[columnIndex]] = item.text;

        // Move to the next column
        columnIndex++;

        // If we’ve filled all columns, add the row to the result and reset
        if (columnIndex === headers.length) {
            result.push(row);
            row = {}; // Start a new row
            columnIndex = 0; // Reset column index
        }
    });

    return result;
};

module.exports = { extractTableFromBufferForBankStatement, extractTableFromBufferForTrailBalance, groupRecordsByTransactionId };