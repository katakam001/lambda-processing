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

module.exports = { groupRecordsByTransactionId };