const fs = require("fs");
const path = require("path");
const pdf = require("pdf-creator-node");

function buildHtmlTemplate() {
  const templatePath = path.join(__dirname, "..", "templates", "template.html");
  return fs.readFileSync(templatePath, "utf8");
}


const options = {
  format: "A4",
  timeout: 60000,
  orientation: "portrait",
  border: "10mm",
  paginationOffset: 10,
  footer: {
    height: "20mm",
    contents: {
      default: '<span style="color: #444;">{{page}}</span>/<span>{{pages}}</span>',
    },
  },
};

async function generatePDFToFile(data, fileName) {
  try {
    const html = buildHtmlTemplate();
    const outputPath = path.join("/tmp", fileName); // ✅ unique per Lambda
    const document = { html, data, path: outputPath, type: "" };
    await pdf.create(document, options);
    return outputPath;
  } catch (error) {
    console.error("❌ PDF generation failed:", error.message);
    throw new Error("PDF generation failed: " + error.message);
  }
}

module.exports = { generatePDFToFile };
