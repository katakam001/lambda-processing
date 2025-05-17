const { processPDF } = require("./services/pdfProcessor");
const { sendMessagesInBatch } = require("./services/sqsService");
const { getFileFromS3 } = require("./services/s3Service");

exports.handler = async (event, context) => {
    try {
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const fileName = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        console.log("Reading file:", fileName);

        const fileData = await getFileFromS3(bucketName, fileName);

        // If file is a PDF, compress it
        if (fileName.endsWith(".pdf")) {
            const groupedRecords = await processPDF(fileData.Body, context.awsRequestId);
            await sendMessagesInBatch(groupedRecords);
        }

        return { statusCode: 200, body: "File processed successfully" };
    } catch (error) {
        console.error("Error processing file:", error);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};