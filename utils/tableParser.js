const { PdfReader } = require("pdfreader");

const extractTableFromBuffer = buffer => {
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

module.exports = { extractTableFromBuffer, groupRecordsByTransactionId };