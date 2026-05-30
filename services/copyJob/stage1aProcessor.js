const { streamToString } = require("../../utils/streamUtils");

/**
 * Stage1a Processor
 * Reads the Stage1a bundle JSON and generates structured records
 * @param {Object} fileData - S3 file data (Body + Metadata)
 * @param {Object} metadata - S3 object metadata
 * @param {string} s3Key - actual S3 object key (from event.Records[0].s3.object.key)
 * @returns {Array} records - array of messages ready for SQS
 */
async function processStageBundle(fileData, metadata, s3Key) {
    console.log("📦 Processing Stage1a Copy Job JSON...");

    // ✅ Safely convert stream to string
    const rawJson = await streamToString(fileData.Body);
    const jsonContent = JSON.parse(rawJson);

    const records = [];

    for (const [tableName, rows] of Object.entries(jsonContent)) {
        for (const row of rows) {
            // Extract source_id from row.id and remove it from row_data
            const { id, user_id, ...rest } = row;

            records.push({
                job_id: metadata.job_id,
                stage: metadata.stage,
                source_user_id: metadata.source_user_id,
                target_user_id: metadata.target_user_id,
                table_name: tableName,
                source_id: id,       // ✅ original source PK
                s3_key: s3Key,       // ✅ actual S3 key from event
                chunk_index:metadata.chunk_index,
                row_data: {
                    ...rest,
                    user_id: metadata.target_user_id // override with target
                }
            });
        }
    }

    return records;
}

module.exports = { processStageBundle };
