const { processPDF } = require("./services/pdfProcessor");
const { processCSV } = require("./services/invoiceProcessor"); // ✅ Import CSV processing function
const { sendMessagesInBatch } = require("./services/sqsService");
const { getFileFromS3, uploadFileToS3 } = require("./services/s3Service");
const { generatePDFToFile } = require("./services/pdfGenerator");
const { streamToString } = require("./utils/streamUtils");


exports.handler = async (event, context) => {
    try {
        const record = event.Records[0];
        const bucketName = record.s3.bucket.name;
        const fileName = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

        console.log("Reading file:", fileName);

        const fileData = await getFileFromS3(bucketName, fileName);

        // Read & decrypt metadata
        const metadata = fileData.Metadata;

        // If file is a PDF, compress it
        if (fileName.endsWith(".pdf")) {
            fileType = "pdf";
            console.log("Processing PDF...");
            console.log("Statement Type:", metadata.statementtype);
            console.log("Bank Name:", metadata.bankname);
            console.log("Account ID", metadata.accountid);
            console.log("User ID", metadata.userid);
            console.log("Financial Year:", metadata.financialyear);
            console.log("File Size:", metadata.filesize);
            const groupedRecords = await processPDF(fileData.Body, context.awsRequestId, metadata.statementtype, metadata.bankname, metadata.userid, metadata.financialyear, metadata.filesize);
            await sendMessagesInBatch(groupedRecords, metadata, fileType);
        } else if (fileName.endsWith(".csv")) {
            fileType = "csv";
            console.log("Processing CSV...");
            console.log("User ID", metadata.userid);
            console.log("Financial Year:", metadata.financialyear);
            console.log("Type:", metadata.type);
            console.log("Tax Type:", metadata.taxtype);
            const extractedRecords = await processCSV(fileData.Body);
            await sendMessagesInBatch(extractedRecords, metadata, fileType);
        } else if (fileName.endsWith(".json")) {
            fileType = "json";
            console.log("🧾 Generating PDF from JSON...");

            const rawJson = await streamToString(fileData.Body);
            const jsonContent = JSON.parse(rawJson);
            const fileName = `daybook_${context.awsRequestId}.pdf`;
            const outputPath = await generatePDFToFile(jsonContent, fileName);
            const pdfStream = fs.createReadStream(outputPath);

            const outputKey = fileName
                .replace("daybook_", "")
                .replace(".pdf", "")
                .replace(context.awsRequestId, metadata.userid + "_" + metadata.filetype + "_" + metadata.financialyear) + ".pdf";

            await uploadFileToS3(bucketName, `pdf-outputs/${metadata.userid}/${outputKey}`, pdfStream, "application/pdf", {
                userId: metadata.userid,
                fileType: metadata.filetype,
                financialYear: metadata.financialyear
            });

            console.log("✅ PDF uploaded to:", outputKey);

            await sendMessagesInBatch([
                {
                    fileName,
                    status: "PDF generated",
                    outputKey: `pdf-outputs/${metadata.userid}/${outputKey}`,
                    timestamp: new Date().toISOString()
                }
            ], metadata, fileType);
        }


        return { statusCode: 200, body: "File processed successfully" };
    } catch (error) {
        console.error("Error processing file:", error);
        return { statusCode: 500, body: "Internal Server Error" };
    }
};