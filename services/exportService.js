const fs = require("fs");
const { streamToString } = require("../utils/streamUtils");
const { generatePDFToFile } = require("./pdfGenerator");
const { uploadFileToS3 } = require("./s3Service");

async function exportDaybookToPDF({ fileData, metadata, awsRequestId, bucketName }) {
  try {
    const rawJson = await streamToString(fileData.Body);
    const jsonContent = JSON.parse(rawJson);

    const fileName = `daybook_${metadata.financialyear}_${awsRequestId}.pdf`;
    const outputPath = await generatePDFToFile(jsonContent, fileName);
    const pdfStream = fs.createReadStream(outputPath);

    const s3Key = `pdf-outputs/${metadata.userid}/${fileName}`;

    await uploadFileToS3(bucketName, s3Key, pdfStream, "application/pdf", {
      userId: metadata.userid,
      fileType: metadata.filetype,
      financialYear: metadata.financialyear,
      exportId: metadata.exportid
    });

    await fs.promises.unlink(outputPath);

    return {
      success: true,
      fileName,
      outputKey: s3Key,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error("❌ Export failed:", err);
    return {
      success: false,
      fileName: '',
      outputKey: '',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { exportDaybookToPDF };
