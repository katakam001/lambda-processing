const { streamToString } = require("../../utils/streamUtils");

/**
 * CarryForward Processor
 * Reads the carryForwardAccounts JSON and generates structured records
 * @param {Object} fileData - S3 file data (Body + Metadata)
 * @param {Object} metadata - S3 object metadata
 * @param {string} s3Key - actual S3 object key (from event.Records[0].s3.object.key)
 * @returns {Array} records - array of messages ready for SQS
 */
async function processCarryForwardBundle(fileData, metadata, s3Key) {
    console.log("📂 Processing CarryForwardAccounts JSON...");

    // ✅ Safely convert stream to string
    const rawJson = await streamToString(fileData.Body);
    const jsonContent = JSON.parse(rawJson);

    const accountsByGroup = jsonContent.accountsByGroup || {};
    const records = [];

    for (const [groupName, accounts] of Object.entries(accountsByGroup)) {
        for (const acc of accounts) {
            records.push({
                groupName: groupName,
                accountName: acc.accountName,
                debit: acc.debit || 0,
                credit: acc.credit || 0
            });
        }
    }

    return records;
}

module.exports = { processCarryForwardBundle };
