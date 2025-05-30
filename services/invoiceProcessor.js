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
                    const extractedData = {
                        FeedNo: row["FeedNo"],
                        FeedDate: row["FeedDate"],
                        Name: row["Name"],
                        GstInNo: row["GstInNo"],
                        GstValue0: parseFloat(row["GstValue0"]),
                        GstValue5: parseFloat(row["GstValue5"]),
                        Gst5: parseFloat(row["Gst5"]),
                        GstValue12: parseFloat(row["GstValue12"]),
                        Gst12: parseFloat(row["Gst12"]),
                        GstValue18: parseFloat(row["GstValue18"]),
                        Gst18: parseFloat(row["Gst18"]),
                        GstValue28: parseFloat(row["GstValue28"]),
                        Gst28: parseFloat(row["Gst28"]),
                        CGst: parseFloat(row["CGst"]),
                        SGst: parseFloat(row["SGst"]),
                        TotGst: parseFloat(row["TotGst"]),
                        NetAmt: parseFloat(row["NetAmt"]),
                    };

                    // ✅ Apply the same validation logic
                    let isValid = true;
                    const taxTolerance = 0.02;

                    // Validation for different GST values
                    const validateGST = (gstValue, gstRate, gstFieldName) => {
                        const calculatedGst = parseFloat((gstValue * gstRate).toFixed(2));
                        const gstDifference = Math.abs(extractedData[gstFieldName] - calculatedGst).toFixed(2);
                        if (parseFloat(gstDifference) > taxTolerance) {
                            console.error(`Mismatch in ${gstFieldName} at row ${row["rowNumber"]}: Expected ${calculatedGst}, Found ${extractedData[gstFieldName]}`);
                            isValid = false;
                        }
                    };

                    validateGST(extractedData.GstValue5, 0.05, "Gst5");
                    validateGST(extractedData.GstValue12, 0.12, "Gst12");
                    validateGST(extractedData.GstValue18, 0.18, "Gst18");
                    validateGST(extractedData.GstValue28, 0.28, "Gst28");

                    // ✅ Validate total GST sum
                    const calculatedGstSum = parseFloat(
                        (extractedData.GstValue5 * 0.05) +
                        (extractedData.GstValue12 * 0.12) +
                        (extractedData.GstValue18 * 0.18) +
                        (extractedData.GstValue28 * 0.28)
                    ).toFixed(2);

                    const calculatedCgstSgstSum = parseFloat((extractedData.CGst + extractedData.SGst).toFixed(2));
                    const tolerance = 0.05;

                    if (Math.abs(calculatedGstSum - extractedData.TotGst) > tolerance ||
                        Math.abs(calculatedCgstSgstSum - extractedData.TotGst) > tolerance) {
                        console.error(`Mismatch in total GST at row ${row["rowNumber"]}`);
                        isValid = false;
                    }

                    // ✅ Remove unnecessary fields if valid
                    if (isValid) {
                        delete extractedData.Gst5;
                        delete extractedData.Gst12;
                        delete extractedData.Gst18;
                        delete extractedData.Gst28;
                        delete extractedData.CGst;
                        delete extractedData.SGst;
                        delete extractedData.TotGst;
                        extractedRecords.push(extractedData);
                    }
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