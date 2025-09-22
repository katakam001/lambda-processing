const csvParser = require("csv-parser");
const { Readable } = require("stream");

async function processCSV(buffer, selectedTaxType) {
    try {
        const extractedRecords = [];

        const readableStream = Readable.from(buffer);

        return new Promise((resolve, reject) => {
            readableStream
                .pipe(csvParser())
                .on("data", (row) => {
                    const baseFields = {
                        SNo: row["sNo"],
                        FeedNo: row["invoiceNo"],
                        FeedDate: row["entryDate"],
                        Name: row["name"],
                        Quantity: row["quantity"],
                        GstInNo: row["gstNo"],
                        ItemName: row["itemName"],
                        GstValue0: parseFloat(row["gstValue0"]),
                        GstValue5: parseFloat(row["gstValue5"]),
                        GstValue12: parseFloat(row["gstValue12"]),
                        GstValue18: parseFloat(row["gstValue18"]),
                        GstValue28: parseFloat(row["gstValue28"]),
                        NetAmt: parseFloat(row["netAmt"]),
                    };

                    const gstFields = {
                        gst5: parseFloat(
                            selectedTaxType === "cgst" ? row["gst5"] : row["igst5"]
                        ),
                        gst12: parseFloat(
                            selectedTaxType === "cgst" ? row["gst12"] : row["igst12"]
                        ),
                        gst18: parseFloat(
                            selectedTaxType === "cgst" ? row["gst18"] : row["igst18"]
                        ),
                        gst28: parseFloat(
                            selectedTaxType === "cgst" ? row["gst28"] : row["igst28"]
                        ),
                    };

                    extractedRecords.push({ ...baseFields, ...gstFields });
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