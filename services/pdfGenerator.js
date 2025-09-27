const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");

// Define fonts from your local fonts folder
const fonts = {
  Roboto: {
    normal: path.join(__dirname, "..", "fonts", "Roboto-Regular.ttf"),
    bold: path.join(__dirname, "..", "fonts", "Roboto-Bold.ttf"),
    italics: path.join(__dirname, "..", "fonts", "Roboto-Italic.ttf"),
    bolditalics: path.join(__dirname, "..", "fonts", "Roboto-BoldItalic.ttf")
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

function buildAccountCopyDocDefinition(data) {
  const content = [];

  // 🏢 Company Header (first)
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle || "Account Copy", style: "reportTitle" }
  );

  // 🧾 Account Info Block (after company header)
  const formattedStart = formatDate(data.startDate);
  const formattedEnd = formatDate(data.endDate);

  content.push(
    { text: `Account Name: ${data.accountName}`, style: "infoHeader" },
    { text: `Date Range: ${formattedStart} - ${formattedEnd}`, style: "infoHeader" },
    { text: "", margin: [0, 4] }
  );

  // 📄 Table Header
  const body = [
    [
      { text: "Date", style: "tableHeader" },
      { text: "Narration", style: "tableHeader" },
      { text: "Credit", style: "tableHeader" },
      { text: "Debit", style: "tableHeader" },
      { text: "Balance", style: "tableHeader" }
    ]
  ];

  // 📌 Ledger Rows
  data.fullLedger.forEach(entry => {
    const isCredit = entry.type === true;
    const credit = isCredit ? entry.amount : "";
    const debit = !isCredit ? entry.amount : "";

    if (entry.row_type === "summary") {
      body.push([
        { text: entry.date, alignment: "center", bold: true },
        { text: entry.narration, bold: true },
        { text: entry.overall_credit, alignment: "right", bold: true },
        { text: entry.overall_debit, alignment: "right", bold: true },
        { text: entry.balance, alignment: "right", bold: true }
      ]);
    } else if (entry.row_type === "opening") {
      body.push([
        { text: entry.date, alignment: "center", italics: true },
        { text: entry.narration, italics: true },
        { text: credit, alignment: "right", italics: true },
        { text: debit, alignment: "right", italics: true },
        { text: entry.balance, alignment: "right", italics: true }
      ]);
    } else {
      body.push([
        { text: entry.date, alignment: "center" },
        { text: entry.narration },
        { text: credit, alignment: "right" },
        { text: debit, alignment: "right" },
        { text: entry.balance, alignment: "right" }
      ]);
    }
  });

  // 🧾 Table Layout
  content.push({
    table: {
      headerRows: 1,
      widths: [70, '*', 70, 70, 70],
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

  return {
    pageSize: "A4",
    pageMargins: [20, 30, 20, 30],
    content,
    styles: {
      infoHeader: { fontSize: 10, alignment: "center", margin: [0, 2] },
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
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

function buildLedgerDocDefinition(data) {
  const content = [];

  // 🏢 Global Header
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle || "Ledger", style: "reportTitle" },
    { text: "", margin: [0, 6] }
  );

  // 📄 Loop through each account
  data.filteredEntries.forEach(account => {
    content.push({ text: `Account Name: ${account.accountName}`, style: "accountHeader" });
    content.push({ text: `Date Range: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}`, style: "infoHeader" });


    const body = [
      [
        { text: "Date", style: "tableHeader" },
        { text: "Narration", style: "tableHeader" },
        { text: "Credit", style: "tableHeader" },
        { text: "Debit", style: "tableHeader" },
        { text: "Balance", style: "tableHeader" }
      ]
    ];

    account.entries.forEach(entry => {
      const isCredit = entry.type === true;
      const credit = isCredit ? entry.amount : "";
      const debit = !isCredit ? entry.amount : "";

      if (entry.row_type === "summary") {
        body.push([
          { text: entry.date, alignment: "center", bold: true },
          { text: entry.narration, bold: true },
          { text: entry.overall_credit, alignment: "right", bold: true },
          { text: entry.overall_debit, alignment: "right", bold: true },
          { text: entry.balance, alignment: "right", bold: true }
        ]);
      } else if (entry.row_type === "opening") {
        body.push([
          { text: entry.date, alignment: "center", italics: true },
          { text: entry.narration, italics: true },
          { text: credit, alignment: "right", italics: true },
          { text: debit, alignment: "right", italics: true },
          { text: entry.balance, alignment: "right", italics: true }
        ]);
      } else {
        body.push([
          { text: entry.date, alignment: "center" },
          { text: entry.narration },
          { text: credit, alignment: "right" },
          { text: debit, alignment: "right" },
          { text: entry.balance, alignment: "right" }
        ]);
      }
    });

    content.push({
      table: {
        headerRows: 1,
        widths: [70, '*', 70, 70, 70],
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
      infoHeader: { fontSize: 10, alignment: "center", margin: [0, 2] },
      accountHeader: { fontSize: 11, bold: true, alignment: "center", margin: [0, 10, 0, 4] },
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

function buildTrialBalanceDocDefinition(data) {
  const content = [];

  // 🏢 Header
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle || "Trial Balance", style: "reportTitle" },
    { text: `As on ${formatDate(data.reportDate)}`, style: "infoHeader" },
    { text: "", margin: [0, 6] }
  );

  const highVolumeGroups = ["Sundry Creditors", "Sundry Debtors", "Sundry FARMERS"];
  const unifiedBody = [
    [
      { text: "Account Name", style: "tableHeader" },
      { text: "Debit Amount", style: "tableHeader" },
      { text: "Credit Amount", style: "tableHeader" }
    ]
  ];

  const highVolumeSummaries = [];

  // 📊 Unified Table: Regular + High-Volume Summary
  data.groupedAccounts.forEach(group => {
    const isHighVolume = highVolumeGroups.includes(group.groupName);
    const groupDebitTotal = group.accounts.reduce((sum, acc) => sum + (acc.debit || 0), 0);
    const groupCreditTotal = group.accounts.reduce((sum, acc) => sum + (acc.credit || 0), 0);

    if (isHighVolume) {
      highVolumeSummaries.push({
        groupName: group.groupName,
        debitTotal: groupDebitTotal,
        creditTotal: groupCreditTotal,
        accounts: group.accounts
      });
    } else {
      // Group Name
      unifiedBody.push([
        { text: group.groupName, bold: true, decoration: "underline" },
        { text: "", alignment: "right" },
        { text: "", alignment: "right" }
      ]);

      group.accounts.forEach(account => {
        unifiedBody.push([
          { text: account.accountName, margin: [10, 0, 0, 0] },
          {
            text: account.debit
              ? account.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right"
          },
          {
            text: account.credit
              ? account.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right"
          }
        ]);
      });

      // Group Total

      unifiedBody.push([
        { text: "Group Total", bold: true, margin: [10, 0, 0, 0] },
        {
          text: groupDebitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          alignment: "right",
          bold: true
        },
        {
          text: groupCreditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          alignment: "right",
          bold: true
        }
      ]);
    }
  });

  // 📋 High-Volume Summary Section
  if (highVolumeSummaries.length > 0) {

    highVolumeSummaries.forEach(summary => {

      unifiedBody.push([
        { text: summary.groupName },
        {
          text: summary.debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          alignment: "right",
          bold: true
        },
        {
          text: summary.creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          alignment: "right",
          bold: true
        }
      ]);
    });
  }

  // ✅ Grand Total
  unifiedBody.push([
    { text: "Total", bold: true },
    {
      text: data.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      alignment: "right",
      bold: true
    },
    {
      text: data.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      alignment: "right",
      bold: true
    }
  ]);

  // 📋 Unified Table Output
  content.push({
    table: {
      headerRows: 1,
      widths: ['*', 100, 100],
      body: unifiedBody
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 2,
      paddingRight: () => 2,
      paddingTop: () => 1,
      paddingBottom: () => 1
    },
    margin: [0, 0, 0, 10]
  });

  // 📊 Full Tables for High-Volume Groups
  highVolumeSummaries.forEach(summary => {
    const body = [
      [
        { text: "Account Name", style: "tableHeader" },
        { text: "Debit Amount", style: "tableHeader" },
        { text: "Credit Amount", style: "tableHeader" }
      ]
    ];

    summary.accounts.forEach(account => {
      body.push([
        { text: account.accountName },
        {
          text: account.debit
            ? account.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
          alignment: "right"
        },
        {
          text: account.credit
            ? account.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
          alignment: "right"
        }
      ]);
    });

    body.push([
      { text: "Total", bold: true },
      {
        text: summary.debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        alignment: "right",
        bold: true
      },
      {
        text: summary.creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        alignment: "right",
        bold: true
      }
    ]);
    content.push({ text: summary.groupName, style: "groupHeader", decoration: "underline", margin: [0, 10, 0, 4] });

    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 100, 100],
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
      margin: [0, 0, 0, 10]
    });
  });

  return {
    pageSize: "A4",
    pageMargins: [20, 30, 20, 30],
    content,
    styles: {
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      infoHeader: { fontSize: 10, alignment: "center", margin: [0, 2] },
      groupHeader: { fontSize: 13, bold: true },
      tableHeader: { fillColor: "#f2f2f2", bold: true, alignment: "center", fontSize: 9 }
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

// 📅 Date formatter
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// Generate PDF and write to /tmp
async function generatePDFToFile(data, fileType, fileName) {
  let docDefinition;

  if (fileType === "accountCopy") {
    docDefinition = buildAccountCopyDocDefinition(data);
  } else if (fileType === "daybook") {
    docDefinition = buildDocDefinition(data);
  } else if (fileType === "ledger") {
    docDefinition = buildLedgerDocDefinition(data);
  } else if (fileType === "trailBalanceExport") {
    docDefinition = buildTrialBalanceDocDefinition(data);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

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
