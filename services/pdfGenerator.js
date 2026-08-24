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
      const accountRows = [];

      group.accounts.forEach(account => {
        const hasDebit = account.debit !== 0 && account.debit != null;
        const hasCredit = account.credit !== 0 && account.credit != null;

        if (hasDebit || hasCredit) {
          accountRows.push([
            { text: account.accountName, margin: [10, 0, 0, 0] },
            {
              text: hasDebit
                ? account.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "",
              alignment: "right"
            },
            {
              text: hasCredit
                ? account.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "",
              alignment: "right"
            }
          ]);
        }
      });

      if (accountRows.length > 0) {
        unifiedBody.push([
          { text: group.groupName, bold: true, decoration: "underline" },
          { text: "", alignment: "right" },
          { text: "", alignment: "right" }
        ]);

        unifiedBody.push(...accountRows);

        unifiedBody.push([
          { text: "Group Total", bold: true, margin: [10, 0, 0, 0] },
          {
            text: groupDebitTotal !== 0
              ? groupDebitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right",
            bold: true
          },
          {
            text: groupCreditTotal !== 0
              ? groupCreditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right",
            bold: true
          }
        ]);
      }
    }
  });

  // 📋 High-Volume Summary Section
  if (highVolumeSummaries.length > 0) {
    highVolumeSummaries.forEach(summary => {
      const hasDebit = summary.debitTotal !== 0 && summary.debitTotal != null;
      const hasCredit = summary.creditTotal !== 0 && summary.creditTotal != null;

      unifiedBody.push([
        { text: summary.groupName },
        {
          text: hasDebit
            ? summary.debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
          alignment: "right",
          bold: true
        },
        {
          text: hasCredit
            ? summary.creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
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
    const accountRows = [];

    summary.accounts.forEach(account => {
      const hasDebit = account.debit !== 0 && account.debit != null;
      const hasCredit = account.credit !== 0 && account.credit != null;

      if (hasDebit || hasCredit) {
        accountRows.push([
          { text: account.accountName },
          {
            text: hasDebit
              ? account.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right"
          },
          {
            text: hasCredit
              ? account.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : "",
            alignment: "right"
          }
        ]);
      }
    });

    // Only proceed if there are valid account rows
    if (accountRows.length > 0) {
      body.push(...accountRows);

      body.push([
        { text: "Total", bold: true },
        {
          text: summary.debitTotal !== 0
            ? summary.debitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
          alignment: "right",
          bold: true
        },
        {
          text: summary.creditTotal !== 0
            ? summary.creditTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "",
          alignment: "right",
          bold: true
        }
      ]);

      content.push({
        text: summary.groupName,
        style: "groupHeader",
        decoration: "underline",
        margin: [0, 10, 0, 4]
      });

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
    }
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

function buildTradingAccountOrPAndLDocDefinition(data) {
  const content = [];

  // 🏢 Header
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle, style: "reportTitle" },
    { text: `For the year ending ${formatDate(data.reportDate)}`, style: "infoHeader" },
    { text: "", margin: [0, 6] }
  );

  const debitRowCount = countGroupRows(data.debitGroups);
  const creditRowCount = countGroupRows(data.creditGroups);
  const maxRowCount = Math.max(debitRowCount, creditRowCount);

  // 🔄 Render both sides
  // 🔄 Render both sides side-by-side
  content.push({
    columns: [
      {
        width: '48%',
        stack: renderTradingSide(data.debitGroups, {
          showHeader: true,
          showSummary: data.grossResult.label === 'Gross Profit' || data.grossResult.label === 'Net Profit',
          summaryLabel: data.grossResult.label,
          summaryValue: data.grossResult.amount,
          totalQuantity: data.debitTotalQuantity,
          totalAmount: data.debitTotalAmount
        }, maxRowCount)
      },
      {
        width: '48%',
        stack: renderTradingSide(data.creditGroups, {
          showHeader: true,
          showSummary: data.grossResult.label === 'Gross Loss' || data.grossResult.label === 'Net Loss',
          summaryLabel: data.grossResult.label,
          summaryValue: data.grossResult.amount,
          totalQuantity: data.creditTotalQuantity,
          totalAmount: data.creditTotalAmount
        }, maxRowCount)
      }
    ],
    columnGap: 12
  });

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [15, 25, 15, 25],  // Previously [20, 30, 20, 30]
    content,
    styles: {
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      infoHeader: { fontSize: 9, alignment: "center", margin: [0, 2] },
      tableHeader: { fillColor: "#f2f2f2", bold: true, alignment: "center", fontSize: 8 },
      summaryProfit: {
        fillColor: "#e6ffe6",
        bold: true,
        fontSize: 8
      },
      summaryLoss: {
        fillColor: "#ffe6e6",
        bold: true,
        fontSize: 8
      }
    },
    header: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "right",
      fontSize: 8,
      margin: [0, 10, 20, 0]
    }),
    watermark: {
      text: "TAXSERVICE4U",
      color: "gray",
      opacity: 0.1,
      bold: true,
      italics: false
    }
  };
}

function renderReportSection(data, { showTableHeader = true } = {}) {
  const section = [];

  const debitRowCount = countGroupRows(data.debitGroups);
  const creditRowCount = countGroupRows(data.creditGroups);
  const maxRowCount = Math.max(debitRowCount, creditRowCount);

  section.push({
    columns: [
      {
        width: '48%',
        stack: renderTradingSide(data.debitGroups, {
          showHeader: showTableHeader,
          showSummary: data.grossResult.label === 'Gross Profit' || data.grossResult.label === 'Net Profit',
          summaryLabel: data.grossResult.label,
          summaryValue: data.grossResult.amount,
          totalQuantity: data.debitTotalQuantity,
          totalAmount: data.debitTotalAmount
        }, maxRowCount)
      },
      {
        width: '48%',
        stack: renderTradingSide(data.creditGroups, {
          showHeader: showTableHeader,
          showSummary: data.grossResult.label === 'Gross Loss' || data.grossResult.label === 'Net Loss',
          summaryLabel: data.grossResult.label,
          summaryValue: data.grossResult.amount,
          totalQuantity: data.creditTotalQuantity,
          totalAmount: data.creditTotalAmount
        }, maxRowCount)
      }
    ],
    columnGap: 12
  });

  return section;
}

function buildCombinedTradingAndPAndLDocDefinition(data) {
  const content = [];

  // 🔹 Shared Header (only once)
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle, style: "reportTitle" },
    { text: `For the year ending ${formatDate(data.reportDate)}`, style: "infoHeader" },
    { text: "", margin: [0, 6] }
  );

  // 🔹 Trading Account Section
  content.push(...renderReportSection(data.trading, { showTableHeader: true }));

  // 🔹 Page Break
  content.push({ text: "", pageBreak: "before" });

  // 🔹 Profit and Loss Section (no header, no table header)
  content.push(...renderReportSection(data.profitAndLoss, { showTableHeader: false }));

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [15, 25, 15, 25],
    content,
    styles: {
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      infoHeader: { fontSize: 9, alignment: "center", margin: [0, 2] },
      tableHeader: { fillColor: "#f2f2f2", bold: true, alignment: "center", fontSize: 8 },
      summaryProfit: { fillColor: "#e6ffe6", bold: true, fontSize: 8 },
      summaryLoss: { fillColor: "#ffe6e6", bold: true, fontSize: 8 }
    },
    header: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "right",
      fontSize: 8,
      margin: [0, 10, 20, 0]
    }),
    watermark: {
      text: "TAXSERVICE4U",
      color: "gray",
      opacity: 0.1,
      bold: true,
      italics: false
    }
  };
}

function buildBalanceSheetDocDefinition(data) {
  const content = [];

  // 🏢 Header
  content.push(
    { text: `${data.companyName}, ${data.cityName}`, style: "companyHeader" },
    { text: "", margin: [0, 4] },
    { text: data.reportTitle, style: "reportTitle" },
    { text: `For the year ending ${formatDate(data.reportDate)}`, style: "infoHeader" },
    { text: "", margin: [0, 6] }
  );

  const leftRowCount = data.leftGroups.length;
  const rightRowCount = data.rightGroups.length;
  const maxRowCount = Math.max(leftRowCount, rightRowCount);

  // 🔄 Render both sides side-by-side
  content.push({
    columns: [
      {
        width: '48%',
        stack: renderBalanceSide(data.leftGroups, {
          headerLabel: "Liabilities",
          totalValue: data.leftTotal
        }, maxRowCount)
      },
      {
        width: '48%',
        stack: renderBalanceSide(data.rightGroups, {
          headerLabel: "Assets",
          totalValue: data.rightTotal
        }, maxRowCount)
      }
    ],
    columnGap: 12
  });

  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [15, 25, 15, 25],
    content,
    styles: {
      companyHeader: { fontSize: 14, bold: true, alignment: "center" },
      reportTitle: { fontSize: 12, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
      infoHeader: { fontSize: 9, alignment: "center", margin: [0, 2] },
      tableHeader: { fillColor: "#f2f2f2", bold: true, alignment: "center", fontSize: 8 },
      totalRow: { bold: true, fontSize: 8 }
    },
    header: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: "right",
      fontSize: 8,
      margin: [0, 10, 20, 0]
    }),
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

function getBlankRows(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push([
      {
        text: "\u00A0",
        colSpan: 4,
        fontSize: 8,
        border: [true, true, true, false],
        color: "white"
      },
      { text: "\u00A0", fontSize: 8 },
      { text: "\u00A0", fontSize: 8 },
      { text: "\u00A0", fontSize: 8 }
    ]);
  }
  return rows;
}

function getBlankRowsForBalanceSheet(count) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push([
      {
        text: "\u00A0",
        colSpan: 3,
        fontSize: 8,
        border: [true, true, true, false],
        color: "white"
      },
      { text: "\u00A0", fontSize: 8 },
      { text: "\u00A0", fontSize: 8 },
    ]);
  }
  return rows;
}


function countGroupRows(groups) {
  return groups.reduce((count, group) => count + group.items.length, 0);
}

function renderTradingSide(groups, { showHeader, showSummary, summaryLabel, summaryValue, totalQuantity, totalAmount }, maxRowCount) {
  const body = [];

  if (showHeader) {
    body.push([
      { text: "Particulars", style: "tableHeader" },
      { text: "Item", style: "tableHeader" },
      { text: "Quantity", style: "tableHeader" },
      { text: "Amount (₹)", style: "tableHeader" }
    ]);
  }

  groups.forEach(group => {
    group.items.forEach((item, i) => {
      const isStructured = group.groupMode === 'structured';
      const showGroupLabel = isStructured && i === 0;

      body.push([
        { text: showGroupLabel ? group.group : isStructured ? "\u00A0" : item.label, fontSize: 8, noWrap: true },
        { text: isStructured ? item.label : "\u00A0", fontSize: 8, noWrap: true },
        {
          text: item.quantity != null
            ? Number(item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "\u00A0", fontSize: 8,
          alignment: "right"
        },
        {
          text: item.amount != null
            ? Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "\u00A0", fontSize: 8,
          alignment: "right"
        }
      ]);
    });
  });

  const currentRowCount = body.length - 1;
  const paddingNeeded = maxRowCount - currentRowCount;

  if (paddingNeeded > 0) {
    body.push(...getBlankRows(paddingNeeded));
  }

  // Summary Row
  if (showSummary) {
    const summaryStyle = summaryLabel.toLowerCase().includes("loss")
      ? "summaryLoss"
      : "summaryProfit";


    body.push([
      { text: summaryLabel, colSpan: 3, style: summaryStyle },
      { text: "\u00A0", style: summaryStyle },
      { text: "\u00A0", style: summaryStyle },
      {
        text: summaryValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
        alignment: "right",
        style: summaryStyle
      }
    ]);
  } else {
    body.push([{ text: "\u00A0", colSpan: 4, fontSize: 8 }, { text: "\u00A0", fontSize: 8 }, { text: "\u00A0", fontSize: 8 }, { text: "\u00A0", fontSize: 8 }]);
  }

  // Totals Row
  body.push([
    { text: "\u00A0", colSpan: 2, fontSize: 8 }, { text: "\u00A0", fontSize: 8 },
    {
      text: totalQuantity.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      alignment: "right",
      bold: true,
      fontSize: 8
    },
    {
      text: totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      alignment: "right",
      bold: true,
      fontSize: 8
    }
  ]);

  return [{
    table: {
      headerRows: showHeader ? 1 : 0,
      widths: [100, 150, 55, 70],
      body
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 1,
      paddingRight: () => 1,
      paddingTop: () => 2,
      paddingBottom: () => 2
    },
    margin: [0, 0, 0, 10]
  }];
}

function renderBalanceSide(groups, { headerLabel, totalValue }, maxRowCount) {
  const body = [];

  // Header row
  body.push([
    { text: headerLabel, style: "tableHeader" },
    { text: "Inner Amount (₹)", style: "tableHeader", alignment: "right" },
    { text: "Outer Amount (₹)", style: "tableHeader", alignment: "right" }
  ]);

  groups.forEach(group => {
    body.push([
      { text: group.label, fontSize: 8, noWrap: true },
      {
        text: group.innerAmount ? Number(group.innerAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "",
        alignment: "right",
        fontSize: 8
      },
      {
        text: group.outerAmount ? Number(group.outerAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "",
        alignment: "right",
        fontSize: 8
      }
    ]);
  });

  // Pad rows to equalize both sides
  const paddingNeeded = maxRowCount - groups.length;
  if (paddingNeeded > 0) {
    body.push(...getBlankRowsForBalanceSheet(paddingNeeded));
  }


  // Totals row
  body.push([
    { text: "Total", colSpan: 2, style: "totalRow" },
    {},
    {
      text: totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
      alignment: "right",
      style: "totalRow"
    }
  ]);

  return [{
    table: {
      headerRows: 1,
      widths: [215, 80, 80],
      body
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft: () => 1,
      paddingRight: () => 1,
      paddingTop: () => 2,
      paddingBottom: () => 2
    },
    margin: [0, 0, 0, 10]
  }];
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
  } else if (fileType === "tradingAccount" || fileType === "profitAndLoss") {
    docDefinition = buildTradingAccountOrPAndLDocDefinition(data);
  } else if (fileType === "tradingAccountProfitAndLoss") {
    docDefinition = buildCombinedTradingAndPAndLDocDefinition(data);
  } else if (fileType === "horizontalBalanceSheet") {
    docDefinition = buildBalanceSheetDocDefinition(data);
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
