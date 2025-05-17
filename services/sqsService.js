const { SQSClient, SendMessageBatchCommand } = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({ region: "ap-south-2" });
const queueUrl = "https://sqs.ap-south-2.amazonaws.com/867344430886/FinancialStatementQueue";

async function sendMessagesInBatch(groupedRecords) {
    const transactionIds = Object.keys(groupedRecords);
    const batchSize = 10;

    for (let i = 0; i < transactionIds.length; i += batchSize) {
        const batch = transactionIds.slice(i, i + batchSize).map((transactionId, index) => ({
            Id: `msg-${i + index}`,
            MessageBody: JSON.stringify({
                TransactionId: transactionId,
                Records: groupedRecords[transactionId],
            }),
        }));

        try {
            const response = await sqs.send(new SendMessageBatchCommand({ QueueUrl: queueUrl, Entries: batch }));
            console.log(`Successfully sent ${batch.length} messages in batch`);
        } catch (error) {
            console.error("Error sending batch messages:", error);
        }
    }
}

module.exports = { sendMessagesInBatch };