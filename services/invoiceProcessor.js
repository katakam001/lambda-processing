const csvParser = require("csv-parser");
const { Readable } = require("stream");

async function processCSV(buffer, selectedTaxType, invoiceType) {
    try {
        const extractedRecords = [];
        const tcsGrouped = new Map();
        const readableStream = Readable.from(buffer);
        const parser = csvParser();

        return new Promise((resolve, reject) => {
            readableStream
                .pipe(parser)
                .on("data", (row) => {
                    process.nextTick(() => {
                        try {
                            const isTCS = selectedTaxType === "tcs";
                            const invoiceKey = row["invoiceNo"];

                            if (isTCS) {
                                const amount = parseFloat(row["amount"] || "0");
                                const tax = parseFloat(row["tax"] || "0");
                                const total_amount = +(amount + tax).toFixed(2); // ✅ Add this
                                const item = {
                                    itemName: row["itemName"],
                                    unitName: row["unitName"],
                                    quantity: row["quantity"],
                                    rate: row["rate"],
                                    amount: row["amount"],
                                    taxRate: row["taxRate"],
                                    tax, // ✅ Include computed tax
                                    total_amount
                                };

                                if (!tcsGrouped.has(invoiceKey)) {
                                    tcsGrouped.set(invoiceKey, {
                                        SNo: row["sNo"],
                                        FeedNo: row["invoiceNo"],
                                        FeedDate: row["entryDate"],
                                        Name: row["name"],
                                        GstInNo: row["gstNo"],
                                        items: [item]
                                    });
                                } else {
                                    tcsGrouped.get(invoiceKey).items.push(item);
                                }
                            } else {
                                let baseFields = {
                                    SNo: row["sNo"],
                                    FeedNo: row["invoiceNo"],
                                    FeedDate: row["entryDate"],
                                    Name: row["name"],
                                    Quantity: row["quantity"],
                                    GstInNo: row["gstNo"],
                                    ItemName: row["itemName"],
                                    UnitName: row["unitName"],
                                    NetAmt: parseFloat(row["netAmt"]),
                                };

                                let gstFields = {};

                                if (invoiceType === "8") {
                                    const computeBaseAndTax = (amount, rate) => {
                                        const amt = parseFloat(amount || "0");
                                        const base = +(amt / (1 + rate / 100)).toFixed(2);
                                        const tax = +(amt - base).toFixed(2);
                                        return { base, tax };
                                    };

                                    const prefix = selectedTaxType === "cgst" ? "totAmt" : "iTotAmt";

                                    const tax0 = computeBaseAndTax(row[`${prefix}0`], 0);
                                    const tax5 = computeBaseAndTax(row[`${prefix}5`], 5);
                                    const tax12 = computeBaseAndTax(row[`${prefix}12`], 12);
                                    const tax18 = computeBaseAndTax(row[`${prefix}18`], 18);
                                    const tax28 = computeBaseAndTax(row[`${prefix}28`], 28);

                                    baseFields = {
                                        ...baseFields,
                                        GstValue0: tax0.base,
                                        GstValue5: tax5.base,
                                        GstValue12: tax12.base,
                                        GstValue18: tax18.base,
                                        GstValue28: tax28.base,
                                    };

                                    gstFields = {
                                        gst5: tax5.tax,
                                        gst12: tax12.tax,
                                        gst18: tax18.tax,
                                        gst28: tax28.tax,
                                    };
                                } else {
                                    baseFields = {
                                        ...baseFields,
                                        GstValue0: parseFloat(row["gstValue0"]),
                                        GstValue5: parseFloat(row["gstValue5"]),
                                        GstValue12: parseFloat(row["gstValue12"]),
                                        GstValue18: parseFloat(row["gstValue18"]),
                                        GstValue28: parseFloat(row["gstValue28"]),
                                    };

                                    gstFields = {
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
                                }

                                extractedRecords.push({ ...baseFields, ...gstFields });
                            }
                        } catch (err) {
                            parser.emit("error", err);
                        }
                    });
                })
                .on("end", () => {
                    if (selectedTaxType === "tcs") {
                        resolve(Array.from(tcsGrouped.values()));
                    } else {
                        resolve(extractedRecords);
                    }
                })
                .on("error", (error) => {
                    console.error("❌ CSV stream error:", error.message);
                    reject(error);
                });
        });
    } catch (error) {
        console.error("❌ Error setting up CSV parser:", error.message);
        throw error;
    }
}

module.exports = { processCSV };
