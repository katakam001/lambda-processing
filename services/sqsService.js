const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: "ap-south-2" });
const queueUrl = "https://sqs.ap-south-2.amazonaws.com/867344430886/FinancialStatementQueue";


async function sendMessagesInBatch(records, metadata, fileType) {
    const batchSize = 10;
    let entries = [];

    //  Check if it's a PDF or CSV file
    if (fileType === "pdf" && metadata.statementtype === "bank") {
        const transactionIds = Object.keys(records);

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
                    financialYear: { DataType: "String", StringValue: metadata.financialyear }
                }
            }));

            entries.push(...batch);
        }
    } else if (fileType === "pdf" && metadata.statementtype === "trialBalance") {
        //  CSV contains individual records, process each separately
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize).map((record, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify(record), // Each CSV row as a separate message
                MessageAttributes: {
                    statementType: { DataType: "String", StringValue: metadata.statementtype },
                    userId: { DataType: "String", StringValue: metadata.userid },
                    financialYear: { DataType: "String", StringValue: metadata.financialyear }
                }
            }));

            entries.push(...batch);
        }
    } else if (fileType === "csv") {
        //  CSV contains individual records, process each separately
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize).map((record, index) => ({
                Id: `msg-${i + index}`,
                MessageBody: JSON.stringify(record), // Each CSV row as a separate message
                MessageAttributes: {
                    userId: { DataType: "String", StringValue: metadata.userid },
                    financialYear: { DataType: "String", StringValue: metadata.financialyear },
                    type: { DataType: "String", StringValue: metadata.type }
                }
            }));

            entries.push(...batch);
        }
    }

    //  Send messages to SQS in batches
    try {
        for (let i = 0; i < entries.length; i += batchSize) {
            const response = await sqs.send(new SendMessageBatchCommand({
                QueueUrl: queueUrl,
                Entries: entries.slice(i, i + batchSize)
            }));
            console.log(`Successfully sent ${Math.min(batchSize, entries.length - i)} messages`);
        }
    } catch (error) {
        console.error("Error sending batch messages:", error);
    }
}


module.exports = { sendMessagesInBatch };