const fs = require("fs");
const path = require("path");
const puppeteer = require("chrome-aws-lambda");
const Handlebars = require("handlebars");

function buildHtmlTemplate(data) {
  const templatePath = path.join(__dirname, "..", "templates", "template.html");
  const rawHtml = fs.readFileSync(templatePath, "utf8");
  const compiled = Handlebars.compile(rawHtml);
  return compiled(data);
}

async function generatePDFToFile(data, fileName) {
  try {
    const html = buildHtmlTemplate(data);
    const outputPath = path.join("/tmp", fileName); // Lambda-safe path

    const browser = await puppeteer.puppeteer.launch({
      args: [
        ...puppeteer.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu'
      ],
      executablePath: path.join(__dirname, 'chromium', 'bin', 'chromium'),
      headless: true
    });
    console.log("Using Chromium binary at:", path.join(__dirname, 'chromium', 'bin', 'chromium'));



    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "10mm",
        bottom: "10mm",
        left: "10mm",
        right: "10mm"
      }
      // No headerTemplate or footerTemplate needed — your HTML handles layout
    });

    fs.writeFileSync(outputPath, pdfBuffer);
    await browser.close();

    return outputPath;
  } catch (error) {
    console.error("❌ PDF generation failed:", error.message);
    throw new Error("PDF generation failed: " + error.message);
  }
}

module.exports = { generatePDFToFile };
