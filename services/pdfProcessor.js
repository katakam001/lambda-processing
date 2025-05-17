const { exec } = require("child_process");
const fs = require("fs");
const { extractTableFromBuffer, groupRecordsByTransactionId } = require("../utils/tableParser");
// Helper function to compress PDFs
async function compressPDF(fileBuffer, requestId) {
    const inputFilePath = `/tmp/input-${requestId}.pdf`;
    const outputFilePath = `/tmp/output-${requestId}.pdf`;

    const fileBufferBytes = await fileBuffer.transformToByteArray();
    fs.writeFileSync(inputFilePath, Buffer.from(fileBufferBytes));

    const gsPath = "/opt/bin/gs"; // Correct Ghostscript path inside Lambda layer
    const command = `${gsPath} -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dBATCH -sOutputFile=${outputFilePath} ${inputFilePath}`;

    await new Promise((resolve, reject) => {
        exec(command, (error) => {
            if (error) {
                console.error("Compression error:", error);
                reject(error);
            } else {
                resolve();
            }
        });
    });

    console.log("PDF compression successful.");

    const compressedBuffer = fs.readFileSync(outputFilePath);

    // Clean up temporary files
    fs.unlinkSync(inputFilePath);
    fs.unlinkSync(outputFilePath);

    return compressedBuffer;
}

async function processPDF(fileBuffer, requestId) {
    const compressedPDFBuffer = await compressPDF(fileBuffer, requestId);
    const tableDataByPage = await extractTableFromBuffer(compressedPDFBuffer);
    return groupRecordsByTransactionId(tableDataByPage);
}

module.exports = { processPDF };