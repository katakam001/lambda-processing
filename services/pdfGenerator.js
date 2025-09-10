const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");

// Define fonts from your local fonts folder
const fonts = {
  Roboto: {
    normal: path.join(__dirname, "..", "fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "..", "fonts", "Roboto-Bold.ttf")
  }
};

const printer = new PdfPrinter(fonts);

// Build the PDF layout from structured JSON
function buildDocDefinition(data) {
  const content = [];

  // 🏢 Add Company Name, City, and Report Title at the top
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] }, // Empty line
    { text: "", margin: [0, 4] }, // Empty line
    { text: data.reportTitle || "Daybook", style: "reportTitle" },
  );

  data.filteredEntries.forEach(entry => {
    content.push({ text: entry.date, style: "dateHeader" });

    const body = [
      [
        { text: "Cash Credit", style: "tableHeader" },
        { text: "Journal Credit", style: "tableHeader" },
        { text: "Particular (Account Name)", style: "tableHeader" },
        { text: "Journal Debit", style: "tableHeader" },
        { text: "Cash Debit", style: "tableHeader" }
      ]
    ];

    entry.entries.forEach(row => {
      body.push([
        { text: row.cashCredit, alignment: "right" },
        { text: row.journalCredit, alignment: "right" },
        { text: row.particular },
        { text: row.journalDebit, alignment: "right" },
        { text: row.cashDebit, alignment: "right" }
      ]);
    });

    body.push([
      { text: entry.totalCashCredit, alignment: "right", bold: true },
      { text: entry.totalJournalCredit, alignment: "right", bold: true },
      "",
      { text: entry.totalJournalDebit, alignment: "right", bold: true },
      { text: entry.totalCashDebit, alignment: "right", bold: true }
    ]);

    body.push([
      { text: entry.totalCashDebit, alignment: "right" },
      { text: entry.totalJournalDebit, alignment: "right" },
      "", "", ""
    ]);

    body.push([
      { text: entry.balanceCarryForward, alignment: "right", bold: true },
      { text: entry.journalBalanceCarryForward, alignment: "right", bold: true },
      { text: "Balance Carry forward" }, "", ""
    ]);

    content.push({
      table: {
        headerRows: 1,
        widths: [70, 70, '*', 70, 70],
        body
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingLeft: () => 2,
        paddingRight: () => 2,
        paddingTop: () => 1,
        paddingBottom: () => 1
      },
      margin: [0, 5, 0, 10]
    });
  });

  return {
    pageSize: "A4",
    pageMargins: [20, 30, 20, 30],
    content,
    styles: {
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      dateHeader: { fontSize: 10, bold: true, alignment: "center", margin: [0, 6, 0, 4] },
      tableHeader: { fillColor: "#f2f2f2", bold: true, alignment: "center", fontSize: 8 }
    },
    header: function (currentPage, pageCount) {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right",
        fontSize: 8,
        margin: [0, 10, 20, 0]
      };
    },
    watermark: {
      text: "TAXSERVICE4U",
      color: "gray",
      opacity: 0.1,
      bold: true,
      italics: false
    }
  };
}

// Generate PDF and write to /tmp
async function generatePDFToFile(data, fileName = "daybook.pdf") {
  const docDefinition = buildDocDefinition(data);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const outputPath = path.join("/tmp", fileName);

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outputPath);
    pdfDoc.pipe(stream);
    pdfDoc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return outputPath;
}

module.exports = { generatePDFToFile };
