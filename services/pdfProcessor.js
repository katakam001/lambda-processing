const { spawn } = require("child_process");
const fs = require("fs");
const { extractTableFromBuffer, groupRecordsByTransactionId, extractTableFromBufferForBankStatement, extractTableFromBufferForTrailBalance } = require("../utils/tableParser");
// Helper function to compress PDFs
async function compressPDF(fileBuffer, requestId) {
    const inputFilePath = `/tmp/input-${requestId}.pdf`;
    const outputFilePath = `/tmp/output-${requestId}.pdf`;

    //  Convert file to correct binary format before writing
    const fileBufferBytes = await fileBuffer.transformToByteArray();
    fs.writeFileSync(inputFilePath, Buffer.from(fileBufferBytes));

    const gsPath = "/opt/bin/gs"; // Ensure this is the correct Ghostscript path inside Lambda

    return new Promise((resolve, reject) => {
        const gsProcess = spawn(gsPath, [
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dPDFSETTINGS=/ebook",
            "-dNOPAUSE",
            "-dBATCH",
            `-sOutputFile=${outputFilePath}`,
            inputFilePath
        ]);

        gsProcess.on("close", async (code) => {
            if (code === 0) {
                console.log(" PDF compression successful.");

                //  Return the readable stream for further use
                const readStream = fs.readFileSync(outputFilePath);
                resolve(readStream);

                // Cleanup temporary files after stream creation
                fs.unlinkSync(inputFilePath);
                fs.unlinkSync(outputFilePath); //  Also delete compressed output
            } else {
                reject(new Error(`Ghostscript exited with code ${code}`));
            }
        });


        gsProcess.stderr.on("data", (data) => {
            console.error("Ghostscript error:", data.toString());
        });
    });
}

async function processPDF(fileBuffer, requestId, statementType,bankName,userId,financialYear) {
    try {
        console.log(`Processing PDF for Request ID: ${requestId}, Type: ${statementType}`);

        // ✅ Compress PDF before further processing
        const compressedPDFBuffer = await compressPDF(fileBuffer, requestId);

        // ✅ Process based on statement type
        if (statementType === "bank") {
            const tableDataByPage = await extractTableFromBufferForBankStatement(compressedPDFBuffer,bankName,userId,financialYear);

            console.log(`Extracted Bank Statement Data:`, Object.values(tableDataByPage).reduce((sum, rows) => sum + rows.length, 0));

            return groupRecordsByTransactionId(tableDataByPage);

        } else {
            const extractedData = await extractTableFromBufferForTrailBalance(compressedPDFBuffer);

            console.log(`🔍 Trial Balance entries extracted: ${extractedData.length}`);

            return extractedData;
        }
    } catch (error) {
        console.error(`Error processing PDF for Request ID ${requestId}:`, error);
        throw error; // ✅ Properly propagate the error for handling
    }
}

module.exports = { processPDF };