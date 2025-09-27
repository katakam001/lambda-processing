const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: process.env.AWS_REGION });

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
    } else if (fileType === "json") {
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
