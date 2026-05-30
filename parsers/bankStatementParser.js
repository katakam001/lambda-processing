const { PdfReader } = require("pdfreader");
const bankConfig = require('../config/bankConfig');
const { applyTableEndFilter } = require('../utils/orchestration/tableEndFilter');
const { applyMultiPageMerge } = require('../utils/orchestration/multiPageMergePipeline');
const { applyOnePageMerge } = require('../utils/orchestration/onePageMergePipeline');
const { applyHorizontalLineMerge } = require('../utils/orchestration/horizontalLinePipeline');
const { applyHorizontalPartialLineMerge } = require('../utils/orchestration/horizontalPartialLinePipeline');
const { applyPartialWithoutHeadersMerge } = require('../utils/orchestration/partialWithoutHeadersPipeline');
const { applyPartialHeaderBalanceMerge } = require('../utils/orchestration/partialHeaderBalanceMerge');
const { applyPartialHeaderMerge } = require('../utils/orchestration/partialHeaderMerge');
const { applyMergeHeadersOnePageMultipleTimes } = require('../utils/orchestration/mergeHeadersOnePage');
const { validateHeaderWithCustomParameter } = require('../utils/orchestration/validateHeaderWithCustomParameter');
const { validateHeaderWithTransactionId } = require('../utils/orchestration/validateHeaderWithTransactionId');
const { validateHeaderWithTimeStamp } = require('../utils/orchestration/validateHeaderWithTimeStamp');
const { validateRefNoAndNarration } = require('../utils/orchestration/validateRefNoAndNarration');
const { validateHeaderWithEpsilonChange } = require('../utils/orchestration/validateHeaderWithEpsilonChange');
const { cloneHeaderPositions } = require('../utils/orchestration/cloneHeaderPositions');
const { applyAmountOffsets } = require('../utils/orchestration/applyAmountOffsets');
const { applyDebitCreditOffsets } = require('../utils/orchestration/applyDebitCreditOffsets');
const { snapXCoordinate, snapToColumn, snapToColumnWithAlignment, refineAmountSnappedToBalance, refineAmountAndBranchCode, refineYAxisOfParticularsWithDate } = require('../utils/snapUtils.js');
const { refineRefNoAndNarration, refineChequeAndNarration, refineBranchAndNarration, refineTransactionIdAndRemarks, refineDateAndParticulars, refineValueDateAndParticulars, refineValueDateWithHypenAndParticulars } = require('../utils/refineUtils.js');
const { convertToJSONSimple, convertToJSONByY } = require('../utils/convertUtils.js');
const { matchesEndMarker, matchesEndMarkerUsingFuzzyLogic } = require('../utils/markerUtils.js');
const { combineMultiLineRows, combineYAxisSameMultiLineRows, mergeNarrationLines, combineDateFragments, isHorizontalLine } = require('../utils/lineUtils.js');
const { detectAlignmentFromText, reorderHeaderPositions } = require('../utils/headerUtils.js');
const { getCarryForwardFragments, extractCarryForwardedParticulars } = require('../utils/orchestration/carryForward.js');
const { normalizeBankPDF } = require('../utils/orchestration/normalize.js');
const { combineAmountFragments, enhanceCombineWrappedAmounts } = require('../utils/balanceUtils.js');

const extractTableFromBufferForBankStatement = (fileStream, bankName, userId, financialYear, accountId) => {
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

        let requiredHeaders = [];
        const headerVariants = bankConfig.bankHeaders[bankName] || [];
        const exclusivePairs = bankConfig.bankExclusivePairs[bankName] || [];
        const excludeConfigs = bankConfig.excludeHeader[bankName] || [];
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

                // Apply table end filter to remove rows beyond the detected table boundary.
                // -------------------------------------------------------------------------
                // Purpose:
                //   Some banks include extra footer or noise rows after the actual table ends.
                //   This function trims those rows based on Y‑coordinate cutoffs (tableEndYByPage).

                if (bankConfig.banksToFilterUnnecessaryDataWithtableEndY.includes(bankName)) {
                    applyTableEndFilter(tableDataByPage, tableEndYByPage);
                }

                //   Multi-page merge pipeline
                //   -------------------------
                //   Purpose:
                //     Orchestrates header merging, balance carry-forward, and transaction parsing
                //     when fuzzy logic is enabled for a bank.

                if (isAFuzzyLogic && bankConfig.banksToIncludeMergeHeaders.includes(bankName)) {
                    applyMultiPageMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName);
                }

                //   One-page merge pipeline (non-fuzzy strategy)
                //   -------------------------
                //   Purpose:
                //     Applies Page 1 headers across all pages when fuzzy logic is disabled
                //     but the bank requires one-page header merging.


                if (!isAFuzzyLogic && alignments["Post Date"] &&
                    bankConfig.banksToIncludeMergeHeadersInOnePage.includes(bankName)) {
                    applyOnePageMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage);
                }

                //   Horizontal line merge pipeline
                //   ------------------------------
                //   Purpose:
                //     Handles banks that print transaction tables separated by horizontal rules.
                //     Uses Page 1 headers as canonical positions and applies them across all pages.

                if (isHorizontalLineDetected && bankConfig.banksToIncludeHorizontalLine.includes(bankName)) {
                    applyHorizontalLineMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName, headerVariants);
                }

                //   Horizontal Partial Line Merge Pipeline
                //   --------------------------------------
                //   Purpose:
                //     Handles banks that require partial merge with horizontal line detection.

                if (alignments["BALANCE"] && isHorizontalLineDetected &&
                    bankConfig.banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    applyHorizontalPartialLineMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName);
                }

                //   Partial Merge Headers Without Partial Headers Pipeline
                //   ------------------------------------------------------
                //   Purpose:
                //     Coordinates parsing for banks in the "without partial headers" config.
                //     Assumes caller has already checked alignments["NARRATION"] and bankConfig.

                if (alignments["NARRATION"] &&
                    bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName)) {
                    applyPartialWithoutHeadersMerge(tableDataByPage, rawItemsByPage, headerPositionsByPage, bankName);
                }

                if (alignments["Balance"] && isParitalHeader && bankConfig.banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    if (alignments["Serial"] && bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName))
                        isParitalHeader = false;
                    if ((alignments["Branch"] || alignments["BRANCH"] || alignments["Deposits"]) && bankConfig.banksToIncludeMergeHeadersInOnePageMultipleTimes.includes(bankName))
                        isParitalHeader = false;
                }

                //   Orchestration: Partial Header Merge with Balance alignment
                //   ----------------------------------------------------------
                //   Purpose:
                //     - Fix cases where Debit, Credit, and Balance headers are misaligned
                //       (all snapped to the same X position).
                //     - Detect a valid transaction row group to infer correct Balance/ Credit positions.
                //     - Apply consistent header positions across all pages.
                //     - Clean and merge fragmented amount/balance items into usable rows.

                if (alignments["Balance"] && isParitalHeader &&
                    bankConfig.banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    applyPartialHeaderBalanceMerge(tableDataByPage, headerPositionsByPage);
                }

                //   Orchestration: Partial Header Merge
                //   -----------------------------------
                //   Purpose:
                //     - Detect a valid transaction row group on the first page.
                //     - Use that group to infer header positions (including Details).
                //     - Propagate corrected header positions across all pages.


                if (alignments["Balance"] && isParitalHeader &&
                    bankConfig.banksToIncludeParitalHeaders.includes(bankName)) {
                    applyPartialHeaderMerge(tableDataByPage, headerPositionsByPage);
                }


                //   Orchestration: Merge Headers (One Page, Multiple Times)
                //   -------------------------------------------------------
                //   Purpose:
                //    - Infer header positions once from the first page.
                //    - Apply those positions across all pages.
                //    - Use fuzzy-logic skip mode to filter valid groups.
                //    - Parse transactions with fuzzy logic.


                if (
                    alignments['Balance'] &&
                    isParitalHeader &&
                    bankConfig.banksToIncludeMergeHeadersInOnePageMultipleTimes.includes(bankName)
                ) {
                    applyMergeHeadersOnePageMultipleTimes(tableDataByPage, rawItemsByPage, headerPositionsByPage);
                }


                if (!isAFuzzyLogic && bankConfig.bankshasHeadersInOnePage.includes(bankName)) {

                    Object.entries(rawItemsByPage).forEach(([page, items]) => {

                        //  Purpose:
                        //   - Handles special header validation cases for certain banks.
                        //   - Realigns the "Narration" header when strict row group patterns are detected.
                        //   - Injects a fallback table when header detection fails but a loose row group pattern exists.

                        if (bankConfig.bankToIncludeValidateHeaderWithCustomParameter.includes(bankName)) {
                            validateHeaderWithCustomParameter(
                                page,
                                items,
                                alignments,
                                tableDataByPage,
                                headerPositionsByPage,
                                bankName
                            );
                        }

                        //  Purpose:
                        //   - Handles banks where transaction IDs appear in statement rows.
                        //   - Detects semantic transaction ID patterns (e.g., S1234 5678, S1234567).
                        //   - Injects fallback table whenever a valid transaction group is found.

                        if (bankConfig.bankToIncludeValidateHeaderWithTransactionId.includes(bankName)) {
                            validateHeaderWithTransactionId(page, rawItemsByPage, tableDataByPage);
                        }

                        //  Purpose:
                        //   - Handles banks where transaction rows include a timestamp (dd-MM-yyyy HH:mm:ss).
                        //   - Detects valid row groups containing timestamp patterns.
                        //   - Flattens those groups into tableDataByPage for parsing.


                        if (bankConfig.bankToIncludeValidateHeaderWithTimeStamp.includes(bankName) && alignments["Instrument No"]) {
                            validateHeaderWithTimeStamp(page, rawItemsByPage, tableDataByPage);
                        }

                        //  Purpose:
                        //   - Refines RefNo and Narration rows.
                        //   - Groups items by Y-axis with tolerance 0.3
                        //   - Filters onward groups and flattens into tableDataByPage


                        if (bankConfig.banksToIncludeRefineRefNoAndNarration.includes(bankName) && alignments["Withdrawal Amount"]) {
                            validateRefNoAndNarration(page, items, tableDataByPage);
                        }

                        //  Purpose:
                        //   - Handles epsilon header shifts with two dates.
                        //   - Groups items by Y-axis with tolerance 0.55
                        //   - Filters onward groups (loose mode)
                        //   - Flattens and removes rows with dates in parentheses

                        if (bankConfig.banksToIncludeHeadernWithEpsilionChangeWithTwoDates.includes(bankName) && alignments["Balance(Rs)"]) {
                            validateHeaderWithEpsilonChange(page, items, tableDataByPage);
                        }


                        if (bankConfig.banksToIncludeMergeHeadersInOnePage.includes(bankName) && alignments["Inst. No"]) {
                            tableDataByPage[page] = parseInt(page) === 1 ? tableDataByPage[page] : items;
                        }
                    });


                    // Iterate through all parsed pages and normalize header positions.
                    // Purpose: ensures consistent header alignment across multi‑page statements,
                    //          correcting small positional shifts while retaining custom overrides.
                    Object.keys(tableDataByPage).forEach(page => {
                        cloneHeaderPositions(page, headerPositionsByPage, bankName);
                        applyAmountOffsets(page, headerPositionsByPage);
                        applyDebitCreditOffsets(page, headerPositionsByPage);
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
                    if (bankConfig.banksToIncludeChangeHeadersAlign.includes(bankName)) {
                        alignments["Deposit"] = 'left';
                        alignments["Balance"] = 'left';
                        width = 0.5
                    }
                    if (bankConfig.banksToIncludeChangeHeadersAlignWithAmounts.includes(bankName)) {
                        alignments["Debit"] = 'left';
                        alignments["Credit"] = 'left';
                        alignments["Balance"] = 'left';
                        alignments["BALANCE"] = 'left';
                        alignments["VALUE DATE"] = 'left';
                        alignments["TXN DATE"] = 'left';
                        width = 0.2
                    }

                    if (bankConfig.banksToIncludeHeadersAlign.includes(bankName)) {
                        snappedTableData = tableDataByPage[page].map(item =>
                            snapToColumnWithAlignment(item, columnXMap, alignments, width)
                        );
                    } else {
                        snappedTableData = tableDataByPage[page].map(item =>
                            snapToColumn(item, columnXMap)
                        );
                    }
                    // console.log(snappedTableData);

                    if (bankConfig.banksToIncludeHeadersAlignChangeXAxis.includes(bankName)) {
                        snappedTableData = snapXCoordinate(snappedTableData, columnXMap["Chq No"], columnXMap["Particulars"], 0.1);
                    }

                    if (bankConfig.banksToIncludeRefineCreditAndBalance.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineAmountSnappedToBalance(item, columnXMap["Credit"], columnXMap["Balance"])
                        );
                    }

                    if (bankConfig.banksToIncludeRefineChequeAndAccountDescription.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineChequeAndNarration(item, columnXMap["Account Description"], columnXMap["Cheque"])
                        );
                    }

                    if (bankConfig.banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Transaction Details"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineValueDateAndParticulars(item, columnXMap["Transaction Details"], columnXMap["Value Date"])
                        );
                    }

                    if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && columnXMap["Description"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineValueDateAndParticulars(item, columnXMap["Description"], columnXMap["Value Date"])
                        );
                    }

                    if (bankConfig.banksToIncludeRefineBranchAndParticulars.includes(bankName) && columnXMap["Brn"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineBranchAndNarration(item, columnXMap["Particulars"], columnXMap["Brn"])
                        );
                    }

                    if (bankConfig.banksToIncludeOrderChangeOfRemarks.includes(bankName) && columnXMap["Remarks"]) {

                        snappedTableData = [
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Remarks"]) >= epsilon),
                            ...snappedTableData.filter(item => Math.abs(item.x - columnXMap["Remarks"]) <= epsilon)
                        ].sort((a, b) => a.y - b.y); // optional: restore order
                    }

                    if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && columnXMap["Details"]) {

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

                    if (bankConfig.banksToIncludeRefineTransactionIdAndNarration.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineTransactionIdAndRemarks(item, columnXMap["Remarks"], columnXMap["Transaction Id"])
                        );
                    }

                    if (bankConfig.banksToIncludeRefineRefNoAndNarration.includes(bankName)) {

                        snappedTableData = snappedTableData.map(item =>
                            refineRefNoAndNarration(item, columnXMap["Narration"], columnXMap["Chq./Ref.No."])
                        );
                    }
                    if (bankConfig.banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Particulars"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineDateAndParticulars(item, columnXMap["Particulars"], columnXMap["Date"])
                        );
                    }
                    if (bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName) && columnXMap["NARRATION"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineValueDateWithHypenAndParticulars(item, columnXMap["NARRATION"], columnXMap["DATE"])
                        );
                    }

                    if (bankConfig.bankToIncludeValidateHeaderWithTransactionId.includes(bankName) && columnXMap["Particulars"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineValueDateWithHypenAndParticulars(item, columnXMap["Particulars"], columnXMap["Date"])
                        );
                    }

                    if (bankConfig.banksToIncludeRefineDateAndDetails.includes(bankName) && columnXMap["Details"]) {
                        const dateColumn = columnXMap["Date"] || columnXMap["Value Date"];
                        if (dateColumn) {
                            snappedTableData = snappedTableData.map(item =>
                                refineValueDateAndParticulars(item, columnXMap["Details"], dateColumn)
                            );
                        }
                    }
                    if (bankConfig.banksToIncludeRefineDateAndNarration.includes(bankName) && columnXMap["Particulars"]) {

                        snappedTableData = snappedTableData.map(item =>
                            refineDateAndParticulars(item, columnXMap["Particulars"], columnXMap["Value Date"])
                        );
                    }
                    if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && columnXMap["Txn"]) {

                        snappedTableData = enhanceCombineWrappedAmounts(snappedTableData).map(item =>
                            refineAmountAndBranchCode(item, columnXMap["Branch"], columnXMap["Debit"])
                        );

                    }

                    if (bankConfig.banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward.includes(bankName) && columnXMap["DR"]) {
                        snappedTableData = combineAmountFragments(snappedTableData, columnXMap["DR"]);
                    }

                    const mergedDates = combineDateFragments(snappedTableData);

                    // console.log(mergedDates);
                    // 👉 use nextPage if it exists
                    const hasBroughtForward = snappedTableData.some(
                        item => item.text.toLowerCase().includes("brought forward")
                    );
                    if (nextPage && !bankConfig.banksToExcludeCarryForward.includes(bankName)) {
                        if (!(hasBroughtForward && bankConfig.banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward.includes(bankName))) {

                            const nextColumnXMap = headerPositionsByPage[nextPage]; // Your existing header position map
                            // console.log(tableDataByPage[nextPage]);

                            let nextSnappedTableData = tableDataByPage[nextPage].map(item =>
                                snapToColumn(item, nextColumnXMap)
                            );

                            if (bankConfig.banksToIncludeRefineDateAndNarration.includes(bankName)) {

                                nextSnappedTableData = nextSnappedTableData.map(item =>
                                    refineValueDateAndParticulars(item, columnXMap["Transaction Details"], columnXMap["Value Date"])
                                );
                            }

                            // console.log(nextSnappedTableData);
                            let nextMergedDates = combineDateFragments(nextSnappedTableData);
                            // console.log(nextMergedDates);

                            if (bankConfig.banksToIncludeMergeTransactionDetails.includes(bankName)) {
                                nextMergedDates = nextMergedDates.map(item =>
                                    refineYAxisOfParticularsWithDate(item, columnXMap["Trans Date and"], columnXMap["Transaction Details"], nextMergedDates, 0.9)
                                );
                            }

                            let carryForwardRows = getCarryForwardFragments(columnXMap, nextMergedDates);

                            if (bankConfig.banksToIncludeRefineRefNoAndNarration.includes(bankName)) {

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

                            if (bankConfig.banksToIncludeCarryForwardLogicToreplaceYAxis.includes(bankName)) {
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

                            if (bankConfig.banksToIncludeRefineRefNoAndNarration.includes(bankName) && alignments["Withdrawal Amount"]) {
                                carryForwardRows = [];
                            }

                            if (bankConfig.banksToIncludeHeadernWithBroughtForwardToExcludeCarryForward.includes(bankName) && (alignments["Remitter"] || alignments["Credit Amount"])) {
                                carryForwardRows = [];
                            }

                            if (bankConfig.bankToIncludeValidateHeaderWithTransactionId.includes(bankName) && alignments["MODE**"]) {
                                carryForwardRows = [];
                            }

                            console.log(carryForwardRows);
                            mergedDates.push(...carryForwardRows);
                        }

                    }
                    // console.log(mergedDates);

                    let combinedRows = null;
                    if (bankConfig.banksToIncludeMergeNarrationLines.includes(bankName) && alignments["Withdrawal"]) {

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
                    } else if (bankConfig.banksToIncludeMergeTransactionDetails.includes(bankName)) {

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
                    else if (bankConfig.banksToIncludeOrderChangeOfBalance.includes(bankName) && columnXMap["Particulars"]) {

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
                    if (!isAFuzzyLogic && bankConfig.banksToIncludeYAxisInJsonConversion.includes(bankName)) {
                        tableJSON = convertToJSONByY(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    } else if (bankConfig.banksToIncludeYAxisInJsonConversionGeneric.includes(bankName) && columnXMap["Transaction Details"]) {
                        tableJSON = convertToJSONByY(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    } else {
                        tableJSON = convertToJSONSimple(Object.keys(headerPositionsByPage[page]), combinedRows, headerPositionsByPage[page]);
                    }

                    // Convert to JSON
                    // console.log(`Page ${page} Table Data:`, tableJSON);
                    combinedTableData[page] = normalizeBankPDF(tableJSON, accountId, userId, financialYear);
                    console.log(combinedTableData[page]);
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

                if (bankConfig.banksToIncludeMergeHeaders.includes(bankName)) {
                    for (const headerSet of headerVariants) {
                        // Count how many headers from headerSet are found inside decodedText
                        const matchCount = headerSet.filter(h =>
                            decodedText.toUpperCase().includes(h.toUpperCase())
                        ).length;

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
                if (bankConfig.banksToIncludeHeadersInMultipleLines.includes(bankName)) {
                    epsilon = 0.675;
                }
                if (bankConfig.banksToIncludeHeadernWithEpsilionVaration.includes(bankName)) {
                    epsilon = 0.3;
                }
                if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName)) {
                    epsilon = 0.575;
                }
                if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithTwoTypesOfHeaders.includes(bankName)) {
                    epsilon = 0.675;
                }
                if (bankConfig.banksToIncludeHeadernWithEpsilionChangeWithTwoDates.includes(bankName)) {
                    epsilon = 0.55;
                }
                if (bankConfig.banksToIncludeParitalMergeHeaders.includes(bankName)) {
                    for (const headerSet of headerVariants) {
                        const trimmedText = decodedText.trim();
                        let splitHeaders = null;

                        if (bankConfig.banksToIncludeParitalMergeHeadersWithDifferentSpaces.includes(bankName)) {
                            splitHeaders = trimmedText.split(/\s+/).map(h => h.trim()).filter(Boolean);
                        } else {
                            splitHeaders = trimmedText.split(/\s{2,}/).map(h => h.trim()).filter(Boolean);
                        }

                        // Split merged headers by whitespace

                        for (const header of splitHeaders) {
                            if (headerSet.includes(header)) {
                                if (headerY === null) {
                                    headerY = item.y;
                                }

                                if (Math.abs(item.y - headerY) <= epsilon) {
                                    detectedHeaders.add(header);

                                    if (bankConfig.banksToIncludeHeadersInMultipleLines.includes(bankName)) {
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

                            headerPositionsByPage[currentPage] = reorderHeaderPositions(
                                headerPositionsByPage[currentPage],
                                headerSet
                            );

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
                        if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && !isFirstHeaderDetected && headerY && (bankConfig.headerYForBank[bankName].includes(decodedText.trim()))) {
                            headerY = null;
                            detectedHeaders.clear();
                            headerPositionsByPage[currentPage] = {};
                        }
                        if (headerY === null) {
                            if (bankConfig.banksToIncludeHeadernWithEpsilionVarationWithLatestFormat.includes(bankName) && bankConfig.sbifirstHeaders.includes(decodedText.trim())) {
                                isFirstHeaderDetected = true;

                                if (detectedHeaders.size === 0) {
                                    const bankMap = bankConfig.headerBootstrapByBank[bankName];
                                    if (bankMap && bankMap[decodedText.trim()]) {
                                        const fullSet = bankMap[decodedText.trim()];
                                        for (const header of fullSet) {
                                            detectedHeaders.add(header);
                                            headerPositionsByPage[currentPage][header] = item.x;
                                            alignments[header] = detectAlignmentFromText(header);
                                        }
                                        requiredHeaders = fullSet;
                                        headersFound = true;
                                        isParitalHeader = true;
                                        isAfterTable = false;
                                        tableEndY = null;
                                        console.log(`Bootstrap headers for ${bankName} on Page ${currentPage} via starter "${decodedText.trim()}":`, fullSet);
                                        break;
                                    }
                                }
                            }
                            headerY = item.y; // First header detected
                            // console.log(headerY);
                        }

                        if (Math.abs(item.y - headerY) <= epsilon) {
                            detectedHeaders.add(decodedText.trim());
                            if (bankConfig.banksToIncludeHeadersInMultipleLines.includes(bankName)) {
                                if (!headerPositionsByPage[currentPage].hasOwnProperty(decodedText.trim())) {
                                    headerPositionsByPage[currentPage][decodedText.trim()] = item.x;
                                }
                            } else {
                                headerPositionsByPage[currentPage][decodedText.trim()] = item.x;
                            }
                        }

                        for (const [keep, remove] of exclusivePairs) {
                            if (detectedHeaders.has(keep) && detectedHeaders.has(remove)) {
                                detectedHeaders.delete(remove);
                            }
                        }

                        // 🔹 Exclude logic
                        for (const config of excludeConfigs) {
                            const [validHeader, excludeHeaders] = config;

                            // Step 1: ensure all valid headers are detected
                            const hasAllValid = validHeader.every(h => detectedHeaders.has(h));

                            if (hasAllValid) {
                                // Step 2: remove any exclude headers
                                for (const ex of excludeHeaders) {
                                    if (detectedHeaders.has(ex)) {
                                        detectedHeaders.delete(ex);

                                        // 🔹 Also remove from headerPositionsByPage
                                        if (headerPositionsByPage[currentPage] &&
                                            headerPositionsByPage[currentPage].hasOwnProperty(ex)) {
                                            delete headerPositionsByPage[currentPage][ex];
                                        }

                                        console.log(`Excluded header "${ex}" for ${bankName} on Page ${currentPage}`);
                                    }
                                }
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
                const isTableEnd = isAFuzzyLogic ? matchesEndMarkerUsingFuzzyLogic(bankConfig.bankEndMarkers, bankName, decodedText) : matchesEndMarker(bankConfig.bankEndMarkers, bankName, decodedText);
                if (isTableEnd && tableEndY === null) {
                    tableEndY = item.y;
                    tableEndYByPage[currentPage] = tableEndY;
                    isAfterTable = true; // Set the flag to ignore content after this point
                    console.log(`Page ${currentPage}: Table End Y = ${tableEndY}`);
                }

                if (bankConfig.banksToIncludeParitalMergeHeadersWithoutParitalHeaders.includes(bankName) || bankConfig.banksToIncludeMergeHeadersInOnePageMultipleTimes.includes(bankName)) {

                    rawItemsByPage[currentPage].push({
                        text: decodedText,
                        x: item.x,
                        y: item.y,
                    });
                }

                // Skip rows if we are after the table
                if (isAfterTable) {
                    // console.log(`Ignoring text after table: "${decodedText}"`);
                    return; // Skip this row
                }

                // Add rows that are valid table rows
                if (bankConfig.banksToIncludeHeadernWithEpsilionVaration.includes(bankName)) {
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
                if (bankConfig.bankshasHeadersInOnePage.includes(bankName) || bankConfig.banksToIncludeParitalMergeHeadersWithDifferentSpaces.includes(bankName)) {

                    rawItemsByPage[currentPage].push({
                        text: decodedText,
                        x: item.x,
                        y: item.y,
                    });
                }
            }
        });

    });
};

module.exports = { extractTableFromBufferForBankStatement };