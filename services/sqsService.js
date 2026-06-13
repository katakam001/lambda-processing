const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: process.env.AWS_REGION });

/**
 * Recursively walk row_data and count all tables
 */
function countTables(rowData, tableCounts) {
    for (const [tableName, value] of Object.entries(rowData)) {
        if (Array.isArray(value)) {
            // array of child rows
            tableCounts[tableName] = (tableCounts[tableName] || 0) + value.length;

            // recurse into each child row if it's an object
            value.forEach(v => {
                if (typeof v === "object" && v !== null) {
                    countTables(v, tableCounts);
                }
            });
        } else if (typeof value === "object" && value !== null) {
            // single parent row object
            tableCounts[tableName] = (tableCounts[tableName] || 0) + 1;

            // recurse into nested children
            countTables(value, tableCounts);
        }
    }
}

async function sendMessagesInBatch(records, metadata, fileType) {
    const batchSize = 10;
    let entries = [];
    let totalMessages = 0;

    // PDF - Bank Statement
    if (fileType === "pdf" && metadata.statementtype === "bank") {
        const transactionIds = Object.keys(records);
        totalMessages = transactionIds.length;

        for (let i = 0; i < transactionIds.length; i += batchSize) {
            const batch = transactionIds.slice(i, i + batchSize).map((transactionId, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify({
                    TransactionId: transactionId,
                    Records: records[transactionId]
                }),
                MessageAttributes: {
                    statementType: { DataType: "String", StringValue: metadata.statementtype },
                    bankName: { DataType: "String", StringValue: metadata.bankname },
                    accountId: { DataType: "String", StringValue: metadata.accountid },
                    userId: { DataType: "String", StringValue: metadata.userid },
                    financialYear: { DataType: "String", StringValue: metadata.financialyear },
                    batchId: { DataType: "String", StringValue: metadata.batchid }
                }
            }));

            entries.push(...batch);
        }
        // PDF - Trial Balance
    } else if (fileType === "pdf" && metadata.statementtype === "trailBalance") {
        totalMessages = records.length;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize).map((record, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify(record),
                MessageAttributes: {
                    statementType: { DataType: "String", StringValue: metadata.statementtype },
                    userId: { DataType: "String", StringValue: metadata.userid },
                    financialYear: { DataType: "String", StringValue: metadata.financialyear },
                    batchId: { DataType: "String", StringValue: metadata.batchid }
                }
            }));

            entries.push(...batch);
        }
        // CSV
    } else if (fileType === "csv") {
        totalMessages = records.length;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize).map((record, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify(record),
                MessageAttributes: {
                    userId: { DataType: "String", StringValue: metadata.userid },
                    financialYear: { DataType: "String", StringValue: metadata.financialyear },
                    type: { DataType: "String", StringValue: metadata.type },
                    taxType: { DataType: "String", StringValue: metadata.taxtype },
                    saleMode: { DataType: "String", StringValue: metadata.salemode },
                    batchId: { DataType: "String", StringValue: metadata.batchid }
                }
            }));

            entries.push(...batch);
        }

        // JSON (already tracked separately)
    } else if (fileType === "json" && metadata.job_id) {
        const resolvedFileType = metadata.filetype;
        totalMessages = records.length;

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize).map((record, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify(record),
                MessageAttributes: {
                    batchId: { DataType: "String", StringValue: metadata.job_id },
                    stage: { DataType: "String", StringValue: metadata.stage }, // ✅ dynamic
                    fileType: { DataType: "String", StringValue: resolvedFileType },
                    userId: { DataType: "String", StringValue: metadata.target_user_id },
                    financialYear: { DataType: "String", StringValue: metadata.financial_year }
                }

            }));
            console.log(batch);
            entries.push(...batch);
        }


        // inside Lambda after building records[]
        const tableCounts = {};

        records.forEach(r => {
            if (r.table_name) {
                // independent table
                tableCounts[r.table_name] = (tableCounts[r.table_name] || 0) + 1;
            } else if (r.table_group) {
                // group bundle → recurse into row_data
                countTables(r.row_data, tableCounts);
            }
        });


        const summaryMessage = {
            Id: `summary-${Date.now()}`,
            MessageBody: JSON.stringify({
                jobId: metadata.job_id,
                stage: metadata.stage,
                status: metadata.status, // success
                chunk_index: metadata.chunk_index,
                timestamp: new Date().toISOString(),
                tables: Object.entries(tableCounts).map(([tableName, count]) => ({
                    tableName,
                    generatedCount: count
                }))
            }),
            MessageAttributes: {
                messageType: { DataType: "String", StringValue: "summary" },
                batchId: { DataType: "String", StringValue: metadata.job_id },
                stage: { DataType: "String", StringValue: metadata.stage },
                userId: { DataType: "String", StringValue: metadata.target_user_id },
                financialYear: { DataType: "String", StringValue: metadata.financial_year },
                fileType: { DataType: "String", StringValue: resolvedFileType }
            }
        };
        console.log(summaryMessage);

        entries.push(summaryMessage);
    } else if (fileType === "json" && metadata.exportid) {
        const message = {
            Id: "msg-0",
            MessageBody: JSON.stringify(records[0]),
            MessageAttributes: {
                userId: { DataType: "String", StringValue: metadata.userid },
                fileType: { DataType: "String", StringValue: metadata.filetype },
                financialYear: { DataType: "String", StringValue: metadata.financialyear },
                exportId: { DataType: "String", StringValue: metadata.exportid }
            }
        };

        entries.push(message);
    }

    // ✅ Append success summary message (if not JSON)
    if (fileType !== "json" && (totalMessages > 0 || metadata.status === 6)) {
        const resolvedFileType = metadata.filetype;

        const summaryMessage = {
            Id: `summary-${Date.now()}`,
            MessageBody: JSON.stringify({
                batchId: metadata.batchid,
                totalMessages,
                status: metadata.status,
                errorMessage: metadata.errorMessage, // optional: include if status === 6
                timestamp: new Date().toISOString()
            }),
            MessageAttributes: {
                messageType: { DataType: "String", StringValue: "summary" },
                batchId: { DataType: "String", StringValue: metadata.batchid },
                userId: { DataType: "String", StringValue: metadata.userid },
                financialYear: { DataType: "String", StringValue: metadata.financialyear },
                fileType: { DataType: "String", StringValue: resolvedFileType },
            }
        };

        entries.push(summaryMessage);
    }

    if (fileType !== "json" && (metadata.status === 3)) {
        const resolvedFileType = metadata.filetype;

        const summaryMessage = {
            Id: `summary-${Date.now()}`,
            MessageBody: JSON.stringify({
                jobId: metadata.job_id,
                stage: metadata.stage,
                status: metadata.status,
                errorMessage: metadata.errorMessage, // optional: include if status === 3
                chunk_index: metadata.chunk_index,
                timestamp: new Date().toISOString(),
                tables: [] // ✅ explicitly empty on failure
            }),
            MessageAttributes: {
                messageType: { DataType: "String", StringValue: "summary" },
                batchId: { DataType: "String", StringValue: metadata.job_id },
                stage: { DataType: "String", StringValue: metadata.stage },
                userId: { DataType: "String", StringValue: metadata.target_user_id },
                financialYear: { DataType: "String", StringValue: metadata.financial_year },
                fileType: { DataType: "String", StringValue: resolvedFileType }
            }
        };

        entries.push(summaryMessage);
    }

    // 🚀 Send messages to SQS in batches
    try {
        for (let i = 0; i < entries.length; i += batchSize) {
            await sqs.send(new SendMessageBatchCommand({
                QueueUrl: process.env.SQS_QUEUE_URL,
                Entries: entries.slice(i, i + batchSize)
            }));
            console.log(`✅ Sent ${Math.min(batchSize, entries.length - i)} messages`);
        }
    } catch (error) {
        console.error("❌ Error sending batch messages:", error);
    }
}

module.exports = { sendMessagesInBatch };
