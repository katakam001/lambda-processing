const path = require('path');
const dotenv = require('dotenv');
const env = process.env.NODE_ENV || 'development';
const envPath = path.resolve(__dirname, `.env.${env}`);
dotenv.config({ path: envPath });
const { processPDF } = require("./services/pdfProcessor");
const { processCSV } = require("./services/invoiceProcessor");
const { sendMessagesInBatch } = require("./services/sqsService");
const { getFileFromS3 } = require("./services/s3Service");
const { exportDaybookToPDF } = require("./services/exportService");

exports.handler = async (event, context) => {
    console.log(`🧪 Loaded environment with no node modules: ${env}`);
    let fileType = "unknown";
    try {
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const fileName = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        console.log("Reading file:", fileName);

        const fileData = await getFileFromS3(bucketName, fileName);
        const metadata = fileData.Metadata;

        if (fileName.endsWith(".pdf")) {
            fileType = "pdf";
            console.log("Processing PDF...");
            console.log("Statement Type:", metadata.statementtype);
            console.log("Bank Name:", metadata.bankname);
            console.log("Account ID", metadata.accountid);
            console.log("User ID", metadata.userid);
            console.log("Financial Year:", metadata.financialyear);
            console.log("File Size:", metadata.filesize);
            try {
                const groupedRecords = await processPDF(fileData.Body, context.awsRequestId, metadata.statementtype, metadata.bankname, metadata.userid, metadata.financialyear, metadata.filesize);
                if (!groupedRecords || Object.keys(groupedRecords).length === 0) {
                    console.warn("⚠️ No records extracted from PDF.");

                    metadata.status = 6; // Treat as failure
                    metadata.errorMessage = "No data processed";

                    const failureSummary = [{
                        batchId: metadata.batchid,
                        totalMessages: 0,
                        status: 6,
                        errorMessage: metadata.errorMessage,
                        timestamp: new Date().toISOString()
                    }];

                    await sendMessagesInBatch(failureSummary, metadata, "summary");
                } else {
                    metadata.status = 5;
                    await sendMessagesInBatch(groupedRecords, metadata, fileType);
                }
            } catch (error) {
                console.error("PDF processing failed:", error.message);

                const failureSummary = [{
                    batchId: metadata.batchid,
                    totalMessages: 0,
                    status: 6,
                    errorMessage: error.message,
                    timestamp: new Date().toISOString()
                }];
                metadata.status = 6;
                metadata.errorMessage = error.message;
                await sendMessagesInBatch(failureSummary, metadata, "summary");
            }
        } else if (fileName.endsWith(".csv")) {
            fileType = "csv";
            console.log("Processing CSV...");
            console.log("User ID", metadata.userid);
            console.log("Financial Year:", metadata.financialyear);
            console.log("Type:", metadata.type);
            console.log("Tax Type:", metadata.taxtype);
            console.log("Mode:", metadata.salemode);

            try {
                const extractedRecords = await processCSV(fileData.Body, metadata.taxtype);
                metadata.status = 5;
                await sendMessagesInBatch(extractedRecords, metadata, fileType);
            } catch (error) {
                console.error("CSV parsing failed:", error.message);

                const failureSummary = [{
                    batchId: metadata.batchid,
                    totalMessages: 0,
                    status: 6,
                    errorMessage: error.message,
                    timestamp: new Date().toISOString()
                }];
                metadata.status = 6;
                metadata.errorMessage = error.message;
                await sendMessagesInBatch(failureSummary, metadata, "summary");
            }

        } else if (fileName.endsWith(".json")) {
            fileType = "json";
            console.log("🧾 Generating PDF from JSON...");

            const result = await exportDaybookToPDF({ fileData, metadata, awsRequestId: context.awsRequestId, bucketName });

            const status = result.success ? 2 : 6;

            await sendMessagesInBatch([
                {
                    exportId: metadata.exportid,
                    fileName: result.fileName,
                    status,
                    outputKey: result.outputKey,
                    timestamp: result.timestamp
                }
            ], metadata, fileType);
        }


        return { statusCode: 200, body: "File processed successfully" };
    } catch (error) {
        console.error("Error processing file:", error);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};
