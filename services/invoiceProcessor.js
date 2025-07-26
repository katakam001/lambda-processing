const csvParser = require("csv-parser");
const { Readable } = require("stream");

async function processCSV(buffer) {
    try {
        const extractedRecords = [];

        // Convert buffer to readable stream
        const readableStream = Readable.from(buffer);

        return new Promise((resolve, reject) => {
            readableStream
                .pipe(csvParser())
                .on("data", (row) => {
                    extractedRecords.push({
                        SNo: row["sNo"],
                        FeedNo: row["invoiceNo"],
                        FeedDate: row["entryDate"],
                        Name: row["name"],
                        GstInNo: row["gstNo"],
                        ItemName: row["itemName"],
                        GstValue0: parseFloat(row["gstValue0"]),
                        GstValue5: parseFloat(row["gstValue5"]),
                        GstValue12: parseFloat(row["gstValue12"]),
                        GstValue18: parseFloat(row["gstValue18"]),
                        GstValue28: parseFloat(row["gstValue28"]),
                        NetAmt: parseFloat(row["netAmt"]),
                    });
                })
                .on("end", () => resolve(extractedRecords))
                .on("error", (error) => reject(error));
        });

    } catch (error) {
        console.error("Error processing CSV file:", error);
        throw error;
    }
}
module.exports = { processCSV };