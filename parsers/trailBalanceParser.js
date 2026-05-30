const { PdfReader } = require("pdfreader");

const { detectPerRowHeader, extractHeaderRowY, extractHeaderRow, extractHeaderPositions } = require('../utils/headerUtils.js');
const { removeTableBorders } = require('../utils/tableUtils.js');
const { groupRowsByY } = require('../utils/lineUtils.js');
const { filterRelevantRows } = require('../utils/orchestration/filters.js');
const { normalizeRowText, denormalizeGroupedData, formatRowsWithSeparator, convertToJSON } = require('../utils/convertUtils.js');
const { extractAccountName, mergeAccountsInGroups } = require('../utils/accountUtils.js');
const { processGroupsWithoutTotal, groupAccounts } = require('../utils/orchestration/enrich.js');

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

        const filterTableRows = (groupedRows, detectedHeader) => {
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
        };

    });
};
module.exports = { extractTableFromBufferForTrailBalance };